import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/infrastructure/persistence/db";
import { requireAuthenticatedUser, AccessDeniedError } from "./authorization";
import { sendPendingInvitations } from "./participant/invitations";
import { decryptEmail } from "@/infrastructure/participant/crypto";
import { canPerform, type AssessmentStatus, type LifecycleAction } from "@/domain/closure/lifecycle";
import { CHECKLIST_ITEMS, type ChecklistAnswer } from "@/domain/closure/checklist";
import { checklistSchema, exclusionSchema, incidentSchema, qualitySchema, qualityScopeKey, reopenSchema } from "@/domain/closure/schemas";
import { buildSnapshot, engineInputFromSnapshot, SNAPSHOT_SCHEMA_VERSION, type SnapshotPayload } from "@/domain/closure/snapshot";
import { buildActa } from "@/domain/closure/acta";
import { runEngine, ENGINE_VERSION, type EngineOutput } from "@/domain/ieo-engine";

// Phase 5B: lifecycle, closure record, freeze and processing. Only an active IEO_CONSULTANT of the organization acts.
export class LifecycleError extends Error { constructor(message: string, readonly status = 409) { super(message); } }
type Tx = Prisma.TransactionClient;
const PERSPECTIVES = ["DIR", "ESP", "LID", "COL", "CLI"] as const;

async function lockForConsultant(tx: Tx, userId: string, assessmentId: string) {
  if (!z.uuid().safeParse(assessmentId).success) throw new AccessDeniedError();
  await tx.$queryRaw`SELECT id FROM Assessment WHERE id = ${assessmentId} FOR UPDATE`;
  const assessment = await tx.assessment.findFirst({
    where: { id: assessmentId, organization: { status: "ACTIVE", memberships: { some: { userId, role: "IEO_CONSULTANT", active: true, user: { status: "ACTIVE" } } } } },
    include: { organization: { select: { name: true } }, perspectives: true },
  });
  if (!assessment) throw new AccessDeniedError();
  return assessment;
}
function requireAction(action: LifecycleAction, status: AssessmentStatus) {
  if (!canPerform(action, status)) throw new LifecycleError("La acción no está disponible en el estado actual del diagnóstico.");
}
function requireClosed(status: AssessmentStatus) { if (status !== "CLOSED") throw new LifecycleError("El cierre sólo se documenta con el diagnóstico cerrado."); }
async function audit(tx: Tx, assessment: { id: string; organizationId: string }, actorUserId: string, action: Prisma.AuditLogCreateInput["action"], entityType: string, entityId: string, metadataJson?: Prisma.InputJsonValue) {
  await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId: assessment.id, actorUserId, action, entityType, entityId, metadataJson } });
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────────────
export async function openAssessment(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  await db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireAction("OPEN", assessment.status);
    if (!assessment.methodologyPackageId) throw new LifecycleError("El diagnóstico no tiene paquete metodológico.");
    if (assessment.perspectives.length !== 5 || assessment.perspectives.some(row => !row.applicability)) throw new LifecycleError("Clasifica las cinco perspectivas antes de abrir.");
    if (!assessment.perspectives.some(row => row.applicability === "APPLICABLE")) throw new LifecycleError("Al menos una perspectiva debe ser aplicable.");
    await tx.assessment.update({ where: { id: assessment.id }, data: { status: "OPEN", openedAt: new Date(), closedAt: null } });
    await audit(tx, assessment, user.id, "ASSESSMENT_OPENED", "Assessment", assessment.id, { revisionNumber: assessment.revisionNumber });
  });
  const delivery = await sendPendingInvitations(assessmentId);
  return { status: "OPEN" as const, invitationsSent: delivery.sent };
}
export async function closeAssessment(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireAction("CLOSE", assessment.status);
    await tx.assessment.update({ where: { id: assessment.id }, data: { status: "CLOSED", closedAt: new Date() } });
    await tx.closureRecord.upsert({ where: { assessmentId_revisionNumber: { assessmentId: assessment.id, revisionNumber: assessment.revisionNumber } }, create: { assessmentId: assessment.id, revisionNumber: assessment.revisionNumber }, update: {} });
    await audit(tx, assessment, user.id, "ASSESSMENT_CLOSED", "Assessment", assessment.id, { revisionNumber: assessment.revisionNumber });
    return { status: "CLOSED" as const };
  });
}
/** Reopening never alters the previous revision: its acta, snapshot and runs stay as they were. */
export async function reopenAssessment(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = reopenSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireAction("REOPEN", assessment.status);
    const revisionNumber = assessment.revisionNumber + 1;
    await tx.assessment.update({ where: { id: assessment.id }, data: { status: "OPEN", revisionNumber, openedAt: new Date(), closedAt: null, currentRunId: null } });
    await audit(tx, assessment, user.id, "ASSESSMENT_REOPENED", "Assessment", assessment.id, { fromStatus: assessment.status, fromRevision: assessment.revisionNumber, revisionNumber, reason: data.reason });
    return { status: "OPEN" as const, revisionNumber };
  });
}

// ── Closure inputs (CLOSED only) ───────────────────────────────────────────────────────
export async function recordExclusion(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = exclusionSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireClosed(assessment.status);
    // The consultant picks the invitation; the session is resolved here without exposing any answer.
    const binding = await tx.participantAccessBinding.findFirst({ where: { invitationId: data.invitationId, invitation: { assessmentId } }, include: { responseSession: { select: { id: true, status: true } } } });
    if (!binding || binding.responseSession.status !== "SUBMITTED") throw new LifecycleError("Sólo se excluyen cuestionarios enviados.", 422);
    const key = { assessmentId_revisionNumber_responseSessionId: { assessmentId, revisionNumber: assessment.revisionNumber, responseSessionId: binding.responseSession.id } };
    const values = { reasonCode: data.reasonCode, description: data.description, authorizedById: user.id, authorizedAt: new Date(), revokedAt: null, revokedById: null };
    const row = await tx.exclusion.upsert({ where: key, create: { assessmentId, revisionNumber: assessment.revisionNumber, responseSessionId: binding.responseSession.id, ...values }, update: values });
    await audit(tx, assessment, user.id, "EXCLUSION_RECORDED", "Exclusion", row.id, { reasonCode: data.reasonCode, revisionNumber: assessment.revisionNumber });
    return { id: row.id };
  });
}
export async function revokeExclusion(token: string | undefined, assessmentId: string, exclusionId: string) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(exclusionId).success) throw new AccessDeniedError();
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireClosed(assessment.status);
    const updated = await tx.exclusion.updateMany({ where: { id: exclusionId, assessmentId, revisionNumber: assessment.revisionNumber, revokedAt: null }, data: { revokedAt: new Date(), revokedById: user.id } });
    if (!updated.count) throw new AccessDeniedError();
    await audit(tx, assessment, user.id, "EXCLUSION_REVOKED", "Exclusion", exclusionId);
    return { id: exclusionId };
  });
}
export async function recordIncident(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = incidentSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireClosed(assessment.status);
    const row = await tx.incident.create({ data: { assessmentId, revisionNumber: assessment.revisionNumber, occurredOn: new Date(`${data.occurredOn}T00:00:00Z`), perspectiveCode: data.perspectiveCode, description: data.description, impact: data.impact, action: data.action, responsible: data.responsible, createdById: user.id } });
    await audit(tx, assessment, user.id, "INCIDENT_RECORDED", "Incident", row.id, { perspectiveCode: data.perspectiveCode });
    return { id: row.id };
  });
}
export async function recordQuality(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = qualitySchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireClosed(assessment.status);
    if (data.perspectiveCode && assessment.perspectives.find(row => row.perspectiveCode === data.perspectiveCode)?.applicability !== "APPLICABLE") throw new LifecycleError("El dictamen por perspectiva sólo aplica a perspectivas aplicables.", 422);
    const scopeKey = qualityScopeKey(data.perspectiveCode, data.elementCode);
    const values = { verdict: data.verdict, reservations: data.verdict === "A" ? data.reservations || null : data.reservations, reviewedById: user.id, reviewedAt: new Date() };
    const row = await tx.qualityAssessment.upsert({
      where: { assessmentId_revisionNumber_scopeKey: { assessmentId, revisionNumber: assessment.revisionNumber, scopeKey } },
      create: { assessmentId, revisionNumber: assessment.revisionNumber, scopeKey, perspectiveCode: data.perspectiveCode, elementCode: data.elementCode, ...values }, update: values,
    });
    await audit(tx, assessment, user.id, "QUALITY_RECORDED", "QualityAssessment", row.id, { scopeKey, verdict: data.verdict });
    return { id: row.id };
  });
}
export async function saveChecklist(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = checklistSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireClosed(assessment.status);
    const items = [...data.items].sort((a, b) => a.item - b.item);
    const record = await tx.closureRecord.update({ where: { assessmentId_revisionNumber: { assessmentId, revisionNumber: assessment.revisionNumber } }, data: { checklistJson: items } });
    await audit(tx, assessment, user.id, "CHECKLIST_SAVED", "ClosureRecord", record.id);
    return { id: record.id };
  });
}

// ── Gathering data for acta and snapshot ───────────────────────────────────────────────
async function closureData(tx: Tx, assessment: Awaited<ReturnType<typeof lockForConsultant>>) {
  const revisionNumber = assessment.revisionNumber;
  const [record, verdicts, exclusions, incidents, invitations, sessions, pkg] = await Promise.all([
    tx.closureRecord.findUnique({ where: { assessmentId_revisionNumber: { assessmentId: assessment.id, revisionNumber } } }),
    tx.qualityAssessment.findMany({ where: { assessmentId: assessment.id, revisionNumber }, orderBy: { scopeKey: "asc" } }),
    tx.exclusion.findMany({ where: { assessmentId: assessment.id, revisionNumber, revokedAt: null }, include: { responseSession: { select: { perspective: { select: { perspectiveCode: true } }, binding: { select: { invitationId: true } } } } } }),
    tx.incident.findMany({ where: { assessmentId: assessment.id, revisionNumber }, orderBy: { occurredOn: "asc" } }),
    tx.invitation.findMany({ where: { assessmentId: assessment.id, status: { not: "CANCELLED" } }, select: { id: true, emailCiphertext: true, status: true, perspective: { select: { perspectiveCode: true } }, binding: { select: { responseSession: { select: { id: true, status: true } } } } } }),
    tx.responseSession.findMany({ where: { assessmentId: assessment.id }, select: { id: true, status: true, perspective: { select: { perspectiveCode: true } } } }),
    assessment.methodologyPackageId ? tx.methodologyPackage.findUniqueOrThrow({ where: { id: assessment.methodologyPackageId }, include: { instruments: { include: { instrumentVersion: { include: { questions: { where: { kind: "QUANT" }, orderBy: { displayOrder: "asc" } } } } } } } }) : null,
  ]);
  const excludedIds = new Set(exclusions.map(row => row.responseSessionId));
  const participation = PERSPECTIVES.map(perspectiveCode => {
    const own = sessions.filter(row => row.perspective.perspectiveCode === perspectiveCode);
    return {
      perspectiveCode, applicability: assessment.perspectives.find(row => row.perspectiveCode === perspectiveCode)?.applicability ?? null,
      invited: invitations.filter(row => row.perspective.perspectiveCode === perspectiveCode).length,
      submitted: own.filter(row => row.status === "SUBMITTED").length,
      drafts: own.filter(row => row.status === "STARTED").length,
      excluded: own.filter(row => excludedIds.has(row.id)).length,
    };
  });
  return { record, verdicts, exclusions, incidents, invitations, participation, pkg };
}

export async function readClosure(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    const data = await closureData(tx, assessment);
    const [snapshot, runs] = await Promise.all([
      tx.frozenSnapshot.findUnique({ where: { assessmentId_revisionNumber: { assessmentId, revisionNumber: assessment.revisionNumber } }, select: { id: true, sha256: true, frozenAt: true, schemaVersion: true } }),
      tx.processingRun.findMany({ where: { assessmentId }, orderBy: { requestedAt: "desc" }, select: { id: true, status: true, publishable: true, engineVersion: true, inputHash: true, outputHash: true, errorMessage: true, requestedAt: true, snapshot: { select: { revisionNumber: true } }, global: { select: { status: true } } } }),
    ]);
    return {
      status: assessment.status, revisionNumber: assessment.revisionNumber, openedAt: assessment.openedAt, closedAt: assessment.closedAt, plannedClosesAt: assessment.plannedClosesAt, currentRunId: assessment.currentRunId,
      perspectives: assessment.perspectives.map(row => ({ perspectiveCode: row.perspectiveCode, applicability: row.applicability })),
      participation: data.participation,
      submittedInvitations: data.invitations.filter(row => row.binding?.responseSession.status === "SUBMITTED").map(row => ({ id: row.id, email: decryptEmail(row.emailCiphertext), perspectiveCode: row.perspective.perspectiveCode })),
      exclusions: data.exclusions.map(row => ({ id: row.id, invitationId: row.responseSession.binding?.invitationId ?? null, perspectiveCode: row.responseSession.perspective.perspectiveCode, reasonCode: row.reasonCode, description: row.description })),
      incidents: data.incidents.map(row => ({ id: row.id, occurredOn: row.occurredOn.toISOString().slice(0, 10), perspectiveCode: row.perspectiveCode, description: row.description, impact: row.impact, action: row.action, responsible: row.responsible })),
      verdicts: data.verdicts.map(row => ({ perspectiveCode: row.perspectiveCode, elementCode: row.elementCode, verdict: row.verdict, reservations: row.reservations })),
      checklist: (data.record?.checklistJson as ChecklistAnswer[] | null) ?? null,
      acta: data.record?.actaJson ?? null, actaHash: data.record?.actaHash ?? null,
      snapshot, runs: runs.map(run => ({ ...run, revisionNumber: run.snapshot.revisionNumber, globalStatus: run.global?.status ?? null })),
    };
  });
}

// ── Freeze ─────────────────────────────────────────────────────────────────────────────
export async function freezeAssessment(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireAction("FREEZE", assessment.status);
    const data = await closureData(tx, assessment);
    const checklist = data.record?.checklistJson as ChecklistAnswer[] | null;
    if (!data.record || !checklist || checklist.length !== CHECKLIST_ITEMS.length) throw new LifecycleError("Completa el checklist oficial de 16 puntos.", 422);
    if (!data.verdicts.some(row => !row.perspectiveCode)) throw new LifecycleError("Falta el dictamen global.", 422);
    const missing = assessment.perspectives.filter(row => row.applicability === "APPLICABLE" && !data.verdicts.some(verdict => verdict.perspectiveCode === row.perspectiveCode && !verdict.elementCode));
    if (missing.length) throw new LifecycleError(`Falta el dictamen de: ${missing.map(row => row.perspectiveCode).join(", ")}.`, 422);
    if (!data.pkg || data.pkg.instruments.length !== 5) throw new LifecycleError("Paquete metodológico incompleto.");
    const submitted = await tx.responseSession.findMany({ where: { assessmentId, status: "SUBMITTED" }, select: { id: true, perspective: { select: { perspectiveCode: true } }, responses: { select: { itemKey: true, itemType: true, answerState: true, numericValue: true } } } });
    const instruments = data.pkg.instruments.map(row => ({
      instrumentCode: row.instrumentVersion.instrumentCode, version: row.instrumentVersion.version, perspectiveCode: row.perspectiveCode, contentHash: row.instrumentVersion.contentHash,
      questions: row.instrumentVersion.questions.map(question => ({ code: question.code, elementCode: question.elementCode!, orientation: question.orientation!, allowNA: question.allowNA })),
    }));
    const { payload, sha256 } = buildSnapshot({
      assessment: { id: assessmentId, revisionNumber: assessment.revisionNumber, isTest: true },
      methodologyPackage: { code: data.pkg.code, version: data.pkg.version },
      instruments,
      scopes: assessment.perspectives.map(row => ({ perspectiveCode: row.perspectiveCode, applicability: row.applicability! })),
      verdicts: data.verdicts.map(row => ({ perspectiveCode: row.perspectiveCode, elementCode: row.elementCode, verdict: row.verdict })),
      submitted: submitted.map(row => ({ sessionId: row.id, perspectiveCode: row.perspective.perspectiveCode, responses: row.responses })),
      excludedSessionIds: data.exclusions.map(row => row.responseSessionId),
    });
    const consultant = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true } });
    const authorizedAt = new Date();
    const { acta, actaHash } = buildActa({
      organization: assessment.organization.name, assessment: assessment.name, period: assessment.period, revisionNumber: assessment.revisionNumber, isTest: true,
      objective: assessment.objective, scopeUnits: assessment.scopeUnitsText, sponsor: assessment.sponsorName,
      instruments: instruments.map(row => ({ perspectiveCode: row.perspectiveCode, instrumentCode: row.instrumentCode, version: row.version, contentHash: row.contentHash })),
      openedAt: assessment.openedAt!, closedAt: assessment.closedAt!,
      participation: data.participation.map(row => ({ ...row, applicability: row.applicability! })),
      verdicts: data.verdicts.map(row => ({ perspectiveCode: row.perspectiveCode, elementCode: row.elementCode, verdict: row.verdict, reservations: row.reservations })),
      incidents: data.incidents.map(row => ({ occurredOn: row.occurredOn.toISOString().slice(0, 10), perspectiveCode: row.perspectiveCode, description: row.description, impact: row.impact, action: row.action, responsible: row.responsible })),
      exclusions: data.exclusions.map(row => ({ perspectiveCode: row.responseSession.perspective.perspectiveCode, reasonCode: row.reasonCode, description: row.description })),
      checklist, consultant, authorizedAt,
    });
    await tx.closureRecord.update({ where: { id: data.record.id }, data: { actaJson: acta, actaHash, authorizedById: user.id, authorizedAt } });
    const snapshot = await tx.frozenSnapshot.create({ data: { assessmentId, revisionNumber: assessment.revisionNumber, closureRecordId: data.record.id, schemaVersion: SNAPSHOT_SCHEMA_VERSION, payloadJson: payload as unknown as Prisma.InputJsonValue, sha256, frozenById: user.id, frozenAt: authorizedAt } });
    await tx.assessment.update({ where: { id: assessmentId }, data: { status: "FROZEN" } });
    await audit(tx, assessment, user.id, "ASSESSMENT_FROZEN", "FrozenSnapshot", snapshot.id, { revisionNumber: assessment.revisionNumber, sha256, actaHash, sessions: payload.sessions.length, excluded: payload.excludedSessionIds.length });
    return { snapshotId: snapshot.id, sha256, actaHash };
  }, { timeout: 30_000 });
}

// ── Process ────────────────────────────────────────────────────────────────────────────
const decimal = (value: { toDecimal: (digits?: number) => string } | null) => (value ? value.toDecimal(18) : null);
const exact = (value: { num: bigint; den: bigint } | null) => (value ? `${value.num}/${value.den}` : null);
function resultRows(runId: string, output: EngineOutput) {
  return {
    perspectiveElements: output.perspectiveElements.map(row => ({ runId, perspectiveCode: row.perspectiveCode, elementCode: row.elementCode, status: row.status, reason: row.reason, validPiCount: row.validPiCount, rpExact: exact(row.rp), rpDecimal: decimal(row.rp) })),
    elements: output.integrated.map(row => {
      const gap = output.gaps.find(item => item.elementCode === row.elementCode)!;
      return { runId, elementCode: row.elementCode, riStatus: row.status, riExact: exact(row.ri), riDecimal: decimal(row.ri), validPerspectiveCount: row.validPerspectiveCount, perspectivesJson: row.perspectives, btStatus: gap.status, btExact: exact(gap.gap), btDecimal: decimal(gap.gap), btDisplay: gap.displayGap, btClass: gap.gapClass, maxPerspectivesJson: gap.maxPerspectives, minPerspectivesJson: gap.minPerspectives };
    }),
    perspectiveIndexes: output.perspectiveIndexes.map(row => ({ runId, perspectiveCode: row.perspectiveCode, status: row.status, validElementCount: row.validElementCount, valueExact: exact(row.value), valueDecimal: decimal(row.value), displayScore: row.classification?.displayScore ?? null, healthLevel: row.classification?.health.level ?? null, trafficLight: row.classification?.light ?? null })),
    global: { runId, status: output.global.status, reason: output.global.reason, valueExact: exact(output.global.value), valueDecimal: decimal(output.global.value), displayScore: output.global.classification?.displayScore ?? null, healthLevel: output.global.classification?.health.level ?? null, healthLabel: output.global.classification?.health.label ?? null, trafficLight: output.global.classification?.light ?? null, integratedElementCount: output.global.integratedElementCount, limitedElementsJson: output.global.limitedElements },
  };
}
/** Runs the engine on the frozen snapshot only. A failure is recorded as FAILED and publishes nothing. */
export async function processAssessment(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  return db().$transaction(async tx => {
    const assessment = await lockForConsultant(tx, user.id, assessmentId);
    requireAction("PROCESS", assessment.status);
    const snapshot = await tx.frozenSnapshot.findUniqueOrThrow({ where: { assessmentId_revisionNumber: { assessmentId, revisionNumber: assessment.revisionNumber } } });
    const payload = snapshot.payloadJson as unknown as SnapshotPayload;
    const requestedAt = new Date();
    let output: EngineOutput | null = null, errorMessage: string | null = null;
    try { output = runEngine(engineInputFromSnapshot(payload)); }
    catch (error) { errorMessage = (error instanceof Error ? error.message : "Error del motor").slice(0, 500); }
    const publishable = !!output && payload.globalVerdict !== "C"; // GAP-009: a global C keeps the run for audit only
    const run = await tx.processingRun.create({ data: {
      assessmentId, snapshotId: snapshot.id, engineVersion: ENGINE_VERSION, status: output ? "SUCCEEDED" : "FAILED", publishable,
      inputHash: output?.inputHash ?? null, outputHash: output?.outputHash ?? null, outputJson: output ? JSON.parse(JSON.stringify(output)) : undefined, errorMessage,
      requestedById: user.id, requestedAt, finishedAt: new Date(),
    } });
    if (!output) {
      await audit(tx, assessment, user.id, "PROCESSING_FAILED", "ProcessingRun", run.id, { engineVersion: ENGINE_VERSION });
      return { runId: run.id, status: "FAILED" as const, errorMessage };
    }
    const rows = resultRows(run.id, output);
    await tx.perspectiveElementResult.createMany({ data: rows.perspectiveElements });
    await tx.elementResult.createMany({ data: rows.elements });
    await tx.perspectiveIndexResult.createMany({ data: rows.perspectiveIndexes });
    await tx.globalResult.create({ data: rows.global });
    await tx.assessment.update({ where: { id: assessmentId }, data: { status: "PROCESSED", currentRunId: run.id } });
    await audit(tx, assessment, user.id, "PROCESSING_SUCCEEDED", "ProcessingRun", run.id, { engineVersion: ENGINE_VERSION, inputHash: output.inputHash, outputHash: output.outputHash, publishable, globalStatus: output.global.status });
    return { runId: run.id, status: "SUCCEEDED" as const, publishable, outputHash: output.outputHash, globalStatus: output.global.status };
  }, { timeout: 30_000 });
}
