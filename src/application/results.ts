import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/infrastructure/persistence/db";
import { decryptOpenText, encryptOpenText } from "@/infrastructure/participant/crypto";
import { requireAuthenticatedUser, AccessDeniedError } from "./authorization";
import { LifecycleError } from "./closure";
import { disclosureWarnings } from "@/domain/results/disclosure";
import { disclosureSchema, patternSchema, qualitativeFilterSchema, qualitativeReviewSchema } from "@/domain/results/schemas";
import type { SnapshotPayload } from "@/domain/closure/snapshot";

// Phase 6: results are visible only to an active IEO_CONSULTANT of the organization (Especificaciones §39).
// Individual PI never leave the run's exact output (GAP-011); open answers carry no session or person identifier.
type Client = Prisma.TransactionClient | ReturnType<typeof db>;
async function consultantAssessment(client: Client, userId: string, assessmentId: string) {
  if (!z.uuid().safeParse(assessmentId).success) throw new AccessDeniedError();
  const assessment = await client.assessment.findFirst({ where: { id: assessmentId, organization: { status: "ACTIVE", memberships: { some: { userId, role: "IEO_CONSULTANT", active: true, user: { status: "ACTIVE" } } } } }, select: { id: true, organizationId: true, currentRunId: true, status: true } });
  if (!assessment) throw new AccessDeniedError();
  return assessment;
}
async function successfulRun(client: Client, assessmentId: string, runId: string) {
  if (!z.uuid().safeParse(runId).success) throw new AccessDeniedError();
  const run = await client.processingRun.findFirst({ where: { id: runId, assessmentId, status: "SUCCEEDED" }, include: { snapshot: { select: { revisionNumber: true, payloadJson: true } } } });
  if (!run) throw new AccessDeniedError();
  return run;
}
const latest = <T extends { recordedAt?: Date; reviewedAt?: Date }>(rows: T[], key: (row: T) => string) => {
  const map = new Map<string, T>();
  for (const row of rows) map.set(key(row), row); // rows come ordered by date ascending: the last one wins
  return map;
};

export async function readResults(token: string | undefined, assessmentId: string, requestedRunId?: string | null) {
  const user = await requireAuthenticatedUser(token);
  const assessment = await consultantAssessment(db(), user.id, assessmentId);
  const runs = await db().processingRun.findMany({ where: { assessmentId, status: "SUCCEEDED" }, orderBy: { requestedAt: "desc" }, select: { id: true, requestedAt: true, publishable: true, engineVersion: true, outputHash: true, snapshot: { select: { revisionNumber: true } } } });
  const runId = requestedRunId || assessment.currentRunId || runs[0]?.id;
  if (!runId) return { available: false as const, runs: [] };
  const run = await successfulRun(db(), assessmentId, runId);
  const payload = run.snapshot.payloadJson as unknown as SnapshotPayload;
  const [perspectiveElements, elements, perspectiveIndexes, global, verdicts, patterns, disclosures] = await Promise.all([
    db().perspectiveElementResult.findMany({ where: { runId } }),
    db().elementResult.findMany({ where: { runId }, orderBy: { elementCode: "asc" } }),
    db().perspectiveIndexResult.findMany({ where: { runId } }),
    db().globalResult.findUniqueOrThrow({ where: { runId } }),
    db().qualityAssessment.findMany({ where: { assessmentId, revisionNumber: run.snapshot.revisionNumber } }),
    db().triangulationPattern.findMany({ where: { runId }, orderBy: { recordedAt: "asc" }, include: { recordedBy: { select: { name: true, email: true } } } }),
    db().disclosureReview.findMany({ where: { runId }, orderBy: { reviewedAt: "asc" }, include: { reviewedBy: { select: { name: true, email: true } } } }),
  ]);
  const analyzed = Object.fromEntries((["DIR", "ESP", "LID", "COL", "CLI"] as const).map(code => [code, payload.sessions.filter(row => row.perspectiveCode === code).length]));
  const currentPatterns = latest(patterns, row => row.elementCode);
  const currentDisclosures = latest(disclosures, row => row.perspectiveCode);
  const elementRows = elements.map(row => ({ elementCode: row.elementCode, riStatus: row.riStatus, riExact: row.riExact, validPerspectiveCount: row.validPerspectiveCount, perspectives: row.perspectivesJson as ("DIR" | "ESP" | "LID" | "COL" | "CLI")[], btStatus: row.btStatus, btExact: row.btExact, btDisplay: row.btDisplay, btClass: row.btClass, maxPerspectives: row.maxPerspectivesJson as string[], minPerspectives: row.minPerspectivesJson as string[] }));
  const hidden = [...currentDisclosures.values()].filter(row => row.decision === "NOT_REPORTABLE").map(row => row.perspectiveCode);
  return {
    available: true as const,
    run: { id: run.id, revisionNumber: run.snapshot.revisionNumber, requestedAt: run.requestedAt, publishable: run.publishable, engineVersion: run.engineVersion, outputHash: run.outputHash, isCurrent: run.id === assessment.currentRunId, isTest: payload.assessment.isTest },
    runs: runs.map(row => ({ id: row.id, requestedAt: row.requestedAt, publishable: row.publishable, revisionNumber: row.snapshot.revisionNumber, isCurrent: row.id === assessment.currentRunId })),
    scopes: payload.perspectives.map(row => ({ perspectiveCode: row.perspectiveCode, scope: row.scope })),
    analyzed,
    global: { status: global.status, reason: global.reason, valueExact: global.valueExact, displayScore: global.displayScore, healthLevel: global.healthLevel, healthLabel: global.healthLabel, trafficLight: global.trafficLight, integratedElementCount: global.integratedElementCount, limitedElements: global.limitedElementsJson as string[] },
    perspectiveElements: perspectiveElements.map(row => ({ perspectiveCode: row.perspectiveCode, elementCode: row.elementCode, status: row.status, reason: row.reason, validPiCount: row.validPiCount, rpExact: row.rpExact })),
    elements: elementRows,
    perspectiveIndexes: perspectiveIndexes.map(row => ({ perspectiveCode: row.perspectiveCode, status: row.status, validElementCount: row.validElementCount, valueExact: row.valueExact, displayScore: row.displayScore, healthLevel: row.healthLevel, trafficLight: row.trafficLight })),
    verdicts: verdicts.map(row => ({ perspectiveCode: row.perspectiveCode, elementCode: row.elementCode, verdict: row.verdict, reservations: row.reservations })),
    patterns: [...currentPatterns.values()].map(row => ({ elementCode: row.elementCode, patternCode: row.patternCode, justification: row.justification, recordedAt: row.recordedAt, recordedBy: row.recordedBy.name ?? row.recordedBy.email, versions: patterns.filter(item => item.elementCode === row.elementCode).length })),
    disclosures: [...currentDisclosures.values()].map(row => ({ perspectiveCode: row.perspectiveCode, decision: row.decision, reason: row.reason, reviewedAt: row.reviewedAt, reviewedBy: row.reviewedBy.name ?? row.reviewedBy.email })),
    warnings: disclosureWarnings({ perspectiveElements, elements: elementRows, hidden }),
  };
}

async function audit(tx: Client, assessment: { id: string; organizationId: string }, actorUserId: string, action: "PATTERN_RECORDED" | "QUALITATIVE_REVIEWED" | "DISCLOSURE_RECORDED", entityType: string, entityId: string, metadataJson: Prisma.InputJsonValue) {
  await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId: assessment.id, actorUserId, action, entityType, entityId, metadataJson } });
}
export async function recordPattern(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = patternSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await consultantAssessment(tx, user.id, assessmentId);
    await successfulRun(tx, assessmentId, data.runId);
    const row = await tx.triangulationPattern.create({ data: { runId: data.runId, elementCode: data.elementCode, patternCode: data.patternCode, justification: data.justification, recordedById: user.id, recordedAt: new Date() } });
    await audit(tx, assessment, user.id, "PATTERN_RECORDED", "TriangulationPattern", row.id, { runId: data.runId, elementCode: data.elementCode, patternCode: data.patternCode });
    return { id: row.id };
  });
}
export async function recordDisclosure(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = disclosureSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await consultantAssessment(tx, user.id, assessmentId);
    const run = await successfulRun(tx, assessmentId, data.runId);
    const scope = (run.snapshot.payloadJson as unknown as SnapshotPayload).perspectives.find(row => row.perspectiveCode === data.perspectiveCode);
    if (scope?.scope !== "APPLICABLE") throw new LifecycleError("La divulgación sólo se revisa en perspectivas aplicadas.", 422);
    const row = await tx.disclosureReview.create({ data: { runId: data.runId, perspectiveCode: data.perspectiveCode, decision: data.decision, reason: data.reason, reviewedById: user.id, reviewedAt: new Date() } });
    await audit(tx, assessment, user.id, "DISCLOSURE_RECORDED", "DisclosureReview", row.id, { runId: data.runId, perspectiveCode: data.perspectiveCode, decision: data.decision });
    return { id: row.id };
  });
}

/** Open answers of the sessions in the run's frozen snapshot, without identifiers, in a stable shuffled order. */
export async function listQualitative(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const filter = qualitativeFilterSchema.parse(input);
  await consultantAssessment(db(), user.id, assessmentId);
  const run = await successfulRun(db(), assessmentId, filter.runId);
  const sessionIds = (run.snapshot.payloadJson as unknown as SnapshotPayload).sessions.map(row => row.sessionId);
  const rows = await db().surveyResponse.findMany({
    where: { responseSessionId: { in: sessionIds }, itemType: "TEXT", answerState: "VALUE", questionVersion: { ...(filter.elementCode ? { elementCode: filter.elementCode } : {}), ...(filter.perspectiveCode ? { instrumentVersion: { perspectiveCode: filter.perspectiveCode } } : {}) } },
    select: { id: true, textCiphertext: true, questionVersion: { select: { code: true, text: true, elementCode: true, instrumentVersion: { select: { perspectiveCode: true } } } }, qualitativeReviews: { where: { runId: run.id }, orderBy: { reviewedAt: "asc" }, select: { status: true, redactedCiphertext: true } } },
  });
  const order = (id: string) => createHash("sha256").update(`${run.id}:${id}`).digest("hex");
  return rows.sort((a, b) => order(a.id).localeCompare(order(b.id))).map(row => {
    const review = row.qualitativeReviews.at(-1);
    return {
      id: row.id, perspectiveCode: row.questionVersion!.instrumentVersion.perspectiveCode, elementCode: row.questionVersion!.elementCode, questionCode: row.questionVersion!.code, question: row.questionVersion!.text,
      text: decryptOpenText(row.textCiphertext!), status: review?.status ?? "REVIEW_PENDING", redactedText: review?.redactedCiphertext ? decryptOpenText(review.redactedCiphertext) : null,
    };
  });
}
export async function reviewQualitative(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = qualitativeReviewSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await consultantAssessment(tx, user.id, assessmentId);
    const run = await successfulRun(tx, assessmentId, data.runId);
    const sessionIds = (run.snapshot.payloadJson as unknown as SnapshotPayload).sessions.map(row => row.sessionId);
    const response = await tx.surveyResponse.findFirst({ where: { id: data.surveyResponseId, responseSessionId: { in: sessionIds }, itemType: "TEXT", answerState: "VALUE" }, select: { id: true } });
    if (!response) throw new AccessDeniedError();
    // The original answer is never modified: the redacted version is stored, encrypted, in the review.
    const row = await tx.qualitativeReview.create({ data: { runId: run.id, surveyResponseId: response.id, status: data.status, redactedCiphertext: data.redactedText ? encryptOpenText(data.redactedText) : null, reviewedById: user.id, reviewedAt: new Date() } });
    await audit(tx, assessment, user.id, "QUALITATIVE_REVIEWED", "QualitativeReview", row.id, { runId: run.id, status: data.status });
    return { id: row.id };
  });
}
