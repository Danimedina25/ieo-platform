import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { ExportCode, ExportVariant, GrantScope } from "@/generated/prisma/client";
import { db } from "@/infrastructure/persistence/db";
import { decryptOpenText } from "@/infrastructure/participant/crypto";
import { requireAuthenticatedUser, AccessDeniedError } from "./authorization";
import { LifecycleError } from "./closure";
import { activeGrant } from "./grants";
import { toCsv, NEUTRALIZATION_NOTE, type CsvCell } from "@/domain/exports/csv";
import { zip } from "@/domain/exports/zip";
import { suppressionPlan, SUPPRESSED } from "@/domain/exports/suppression";
import { ENGINE_POLICIES, type EngineOutput } from "@/domain/ieo-engine";
import type { SnapshotPayload } from "@/domain/closure/snapshot";

// Phase 7 exports (S05 12_EXPORTACIONES). Always built from a successful run and its frozen snapshot, generated at
// download time (nothing stored), recorded in ExportRecord and the audit log without content.
const VARIANTS: Record<ExportCode, Partial<Record<ExportVariant, GrantScope | null>>> = {
  EXP04: { STANDARD: null },
  EXP03: { REPORT: null, TECHNICAL: "INDIVIDUAL_SCORES" },
  EXP02: { REPORT: null, FULL: "QUALITATIVE_ORIGINAL" },
  EXP01: { STANDARD: "RAW_RESPONSES" },
};
export const exportSchema = z.object({ code: z.enum(["EXP01", "EXP02", "EXP03", "EXP04"]), variant: z.enum(["STANDARD", "REPORT", "TECHNICAL", "FULL"]), runId: z.uuid().nullable().optional() }).strict();
type Perspective = "DIR" | "ESP" | "LID" | "COL" | "CLI";
type File = { name: string; header: string[]; rows: CsvCell[][] };
const sha = (content: string) => createHash("sha256").update(content).digest("hex");
const latest = <T>(rows: T[], key: (row: T) => string) => { const map = new Map<string, T>(); for (const row of rows) map.set(key(row), row); return map; };

export async function buildExport(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = exportSchema.parse(input);
  if (!(data.variant in VARIANTS[data.code])) throw new LifecycleError("Variante de exportación no válida.", 422);
  if (!z.uuid().safeParse(assessmentId).success) throw new AccessDeniedError();
  const assessment = await db().assessment.findFirst({ where: { id: assessmentId, organization: { status: "ACTIVE", memberships: { some: { userId: user.id, role: "IEO_CONSULTANT", active: true, user: { status: "ACTIVE" } } } } }, select: { id: true, name: true, organizationId: true, currentRunId: true } });
  if (!assessment) throw new AccessDeniedError();
  const runId = data.runId ?? assessment.currentRunId;
  if (!runId) throw new LifecycleError("El diagnóstico no tiene un procesamiento vigente.");
  const run = await db().processingRun.findFirst({ where: { id: runId, assessmentId, status: "SUCCEEDED" }, include: { snapshot: true } });
  if (!run) throw new AccessDeniedError();
  const scope = VARIANTS[data.code][data.variant]!;
  const grant = scope ? await activeGrant(db(), assessmentId, user.id, scope) : null;
  if (scope && !grant) throw new LifecycleError("Esta exportación requiere un permiso excepcional aprobado y vigente.", 403);
  const payload = run.snapshot.payloadJson as unknown as SnapshotPayload;
  const exportId = randomBytes(16).toString("hex");
  // Pseudonyms are specific to this download: shuffled with a random seed, unrelated to session or invitation IDs.
  const pseudonyms = new Map([...payload.sessions].sort((a, b) => sha(`${exportId}:${a.sessionId}`).localeCompare(sha(`${exportId}:${b.sessionId}`))).map((row, index) => [row.sessionId, `P${String(index + 1).padStart(4, "0")}`]));
  const files: File[] = [];
  let suppression: ReturnType<typeof suppressionPlan> | null = null;

  if (data.code === "EXP04") {
    files.push({ name: "instrumentos.csv", header: ["perspective_code", "instrument_code", "version", "content_hash", "item_code", "element_code", "item_order", "orientation", "na_allowed"], rows: payload.instruments.flatMap(instrument => instrument.questions.map((question, index) => [instrument.perspectiveCode, instrument.instrumentCode, instrument.version, instrument.contentHash, question.code, question.elementCode, index + 1, question.orientation, question.allowNA ? 1 : 0])) });
    files.push({ name: "reglas.csv", header: ["rule", "value"], rows: [...Object.entries(ENGINE_POLICIES), ["engine_version", run.engineVersion], ["methodology_package", `${payload.methodologyPackage.code} ${payload.methodologyPackage.version}`], ["snapshot_sha256", run.snapshot.sha256], ["input_hash", run.inputHash], ["output_hash", run.outputHash]] });
  }
  if (data.code === "EXP03") {
    const [perspectiveElements, elements, indexes, global, disclosures] = await Promise.all([
      db().perspectiveElementResult.findMany({ where: { runId }, orderBy: [{ perspectiveCode: "asc" }, { elementCode: "asc" }] }),
      db().elementResult.findMany({ where: { runId }, orderBy: { elementCode: "asc" } }),
      db().perspectiveIndexResult.findMany({ where: { runId }, orderBy: { perspectiveCode: "asc" } }),
      db().globalResult.findUniqueOrThrow({ where: { runId } }),
      db().disclosureReview.findMany({ where: { runId }, orderBy: { reviewedAt: "asc" } }),
    ]);
    if (data.variant === "REPORT") {
      if (!run.publishable) throw new LifecycleError("El procesamiento no es publicable (dictamen C global).");
      const decisions = latest(disclosures, row => row.perspectiveCode);
      const applied = payload.perspectives.filter(row => row.scope === "APPLICABLE").map(row => row.perspectiveCode);
      const pending = applied.filter(code => !decisions.has(code));
      if (pending.length) throw new LifecycleError(`Revisa la divulgación de: ${pending.join(", ")}.`, 422);
      suppression = suppressionPlan({ hidden: [...decisions.values()].filter(row => row.decision === "NOT_REPORTABLE").map(row => row.perspectiveCode), elements: elements.map(row => ({ elementCode: row.elementCode, perspectives: row.perspectivesJson as Perspective[] })) });
    }
    const analyzed = (code: string) => payload.sessions.filter(row => row.perspectiveCode === code).length;
    const hideRp = (code: string) => !!suppression?.perspectives.has(code as Perspective);
    const hideElement = (code: string) => !!suppression?.elements.has(code);
    const header = ["result_type", "perspective_code", "element_code", "value_exact", "value_decimal", "display_value", "status", "reason", "classification", "valid_n", "analyzed_n", "detail"];
    const rows: CsvCell[][] = [];
    for (const row of perspectiveElements) rows.push(hideRp(row.perspectiveCode) ? ["RP", row.perspectiveCode, row.elementCode, null, null, null, SUPPRESSED, null, null, null, null, null] : ["RP", row.perspectiveCode, row.elementCode, row.rpExact, row.rpDecimal?.toString() ?? null, null, row.status, row.reason, null, row.validPiCount, analyzed(row.perspectiveCode), null]);
    for (const row of elements) {
      const hidden = hideElement(row.elementCode);
      rows.push(hidden ? ["RI", null, row.elementCode, null, null, null, SUPPRESSED, null, null, null, null, null] : ["RI", null, row.elementCode, row.riExact, row.riDecimal?.toString() ?? null, null, row.riStatus, null, null, row.validPerspectiveCount, null, (row.perspectivesJson as string[]).join(" ")]);
      rows.push(hidden ? ["BT", null, row.elementCode, null, null, null, SUPPRESSED, null, null, null, null, null] : ["BT", null, row.elementCode, row.btExact, row.btDecimal?.toString() ?? null, row.btDisplay, row.btStatus, null, row.btClass, null, null, `max=${(row.maxPerspectivesJson as string[]).join(" ")};min=${(row.minPerspectivesJson as string[]).join(" ")}`]);
    }
    for (const row of indexes) rows.push(hideRp(row.perspectiveCode) ? ["IEO_PERSPECTIVE", row.perspectiveCode, null, null, null, null, SUPPRESSED, null, null, null, null, null] : ["IEO_PERSPECTIVE", row.perspectiveCode, null, row.valueExact, row.valueDecimal?.toString() ?? null, row.displayScore, row.status, null, row.healthLevel ? `nivel ${row.healthLevel};${row.trafficLight}` : null, row.validElementCount, null, null]);
    rows.push(suppression?.global ? ["IEO_GLOBAL", null, null, null, null, null, SUPPRESSED, null, null, null, null, null] : ["IEO_GLOBAL", null, null, global.valueExact, global.valueDecimal?.toString() ?? null, global.displayScore, global.status, global.reason, global.healthLabel ? `${global.healthLabel};${global.trafficLight}` : null, global.integratedElementCount, null, (global.limitedElementsJson as string[]).length ? `limitados=${(global.limitedElementsJson as string[]).join(" ")}` : null]);
    files.push({ name: "resultados.csv", header, rows });
    if (data.variant === "TECHNICAL") {
      const output = run.outputJson as unknown as EngineOutput & { sessionElements: { sessionId: string; perspectiveCode: string; elementCode: string; coverage: { totalItems: number; validItems: number; naItems: number; missingItems: number; applicableItems: number; coverage: { exact: string } | null; coverageStatus: string }; score: { pi: { exact: string; decimal: string } | null; status: string; reason: string | null } }[] };
      files.push({ name: "puntuaciones_individuales.csv", header: ["participant", "perspective_code", "element_code", "total_items", "valid_items", "na_items", "missing_items", "applicable_items", "coverage_exact", "coverage_status", "pi_exact", "pi_decimal", "pi_status", "reason"],
        rows: [...output.sessionElements].sort((a, b) => `${pseudonyms.get(a.sessionId)}${a.elementCode}`.localeCompare(`${pseudonyms.get(b.sessionId)}${b.elementCode}`)).map(row => [pseudonyms.get(row.sessionId)!, row.perspectiveCode, row.elementCode, row.coverage.totalItems, row.coverage.validItems, row.coverage.naItems, row.coverage.missingItems, row.coverage.applicableItems, row.coverage.coverage?.exact ?? null, row.coverage.coverageStatus, row.score.pi?.exact ?? null, row.score.pi?.decimal ?? null, row.score.status, row.score.reason]) });
    }
  }
  if (data.code === "EXP02") {
    const [responses, disclosures] = await Promise.all([
      db().surveyResponse.findMany({ where: { responseSessionId: { in: payload.sessions.map(row => row.sessionId) }, itemType: "TEXT", answerState: "VALUE" }, select: { id: true, responseSessionId: true, textCiphertext: true, questionVersion: { select: { code: true, text: true, elementCode: true, instrumentVersion: { select: { perspectiveCode: true } } } }, qualitativeReviews: { where: { runId }, orderBy: { reviewedAt: "asc" }, select: { status: true, redactedCiphertext: true } } } }),
      db().disclosureReview.findMany({ where: { runId }, orderBy: { reviewedAt: "asc" } }),
    ]);
    const order = (id: string) => sha(`${exportId}:${id}`);
    const sorted = responses.sort((a, b) => order(a.id).localeCompare(order(b.id)));
    if (data.variant === "REPORT") {
      const hidden = new Set([...latest(disclosures, row => row.perspectiveCode).values()].filter(row => row.decision === "NOT_REPORTABLE").map(row => row.perspectiveCode as string));
      files.push({ name: "cualitativas.csv", header: ["perspective_code", "element_code", "open_item_code", "question", "response_text", "anonymization_status"], rows: sorted.flatMap(row => {
        const review = row.qualitativeReviews.at(-1);
        const perspective = row.questionVersion!.instrumentVersion.perspectiveCode;
        if (!review || hidden.has(perspective) || (review.status !== "SAFE_FOR_REPORT" && review.status !== "REDACTED")) return [];
        return [[perspective, row.questionVersion!.elementCode, row.questionVersion!.code, row.questionVersion!.text, review.status === "REDACTED" ? decryptOpenText(review.redactedCiphertext!) : decryptOpenText(row.textCiphertext!), review.status]];
      }) });
    } else {
      files.push({ name: "cualitativas_completo.csv", header: ["participant", "perspective_code", "element_code", "open_item_code", "question", "response_text", "anonymization_status", "redacted_text"], rows: sorted.map(row => {
        const review = row.qualitativeReviews.at(-1);
        return [pseudonyms.get(row.responseSessionId)!, row.questionVersion!.instrumentVersion.perspectiveCode, row.questionVersion!.elementCode, row.questionVersion!.code, row.questionVersion!.text, decryptOpenText(row.textCiphertext!), review?.status ?? "REVIEW_PENDING", review?.redactedCiphertext ? decryptOpenText(review.redactedCiphertext) : null];
      }) });
    }
  }
  if (data.code === "EXP01") {
    const submitted = new Map((await db().responseSession.findMany({ where: { id: { in: payload.sessions.map(row => row.sessionId) } }, select: { id: true, submittedAt: true } })).map(row => [row.id, row.submittedAt?.toISOString().slice(0, 10) ?? null]));
    const rows: CsvCell[][] = [];
    for (const session of [...payload.sessions].sort((a, b) => pseudonyms.get(a.sessionId)!.localeCompare(pseudonyms.get(b.sessionId)!))) {
      const instrument = payload.instruments.find(row => row.perspectiveCode === session.perspectiveCode)!;
      for (const question of instrument.questions) {
        const raw = session.answers[question.code];
        rows.push([pseudonyms.get(session.sessionId)!, session.perspectiveCode, instrument.instrumentCode, question.code, question.elementCode, raw === undefined || raw === null ? null : String(raw), raw === undefined || raw === null ? "MISSING" : raw === "NA" ? "NA" : "VALUE", submitted.get(session.sessionId) ?? null]);
      }
    }
    files.push({ name: "respuestas_crudas.csv", header: ["participant", "perspective_code", "instrument_code", "item_code", "element_code", "raw_response", "answer_state", "submitted_on"], rows });
  }

  const generatedAt = new Date();
  const csvFiles = files.map(file => ({ name: file.name, content: toCsv(file.header, file.rows), rows: file.rows.length }));
  const manifest = {
    schemaVersion: 1, exportCode: data.code, variant: data.variant, isTest: payload.assessment.isTest,
    assessment: { id: assessment.id, name: assessment.name }, revisionNumber: payload.assessment.revisionNumber,
    runId: run.id, engineVersion: run.engineVersion, snapshotSha256: run.snapshot.sha256, inputHash: run.inputHash, outputHash: run.outputHash,
    grantId: grant?.id ?? null, generatedAt: generatedAt.toISOString(), generatedBy: user.email,
    csv: { encoding: "UTF-8 con BOM", separator: ",", lineEnding: "CRLF", neutralization: NEUTRALIZATION_NOTE },
    suppression: suppression ? { perspectives: [...suppression.perspectives], elements: [...suppression.elements], global: suppression.global, marker: SUPPRESSED } : null,
    files: csvFiles.map(file => ({ name: file.name, rows: file.rows, sha256: sha(file.content) })),
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  const manifestHash = sha(manifestJson);
  const rowCount = csvFiles.reduce((sum, file) => sum + file.rows, 0);
  await db().$transaction(async tx => {
    const record = await tx.exportRecord.create({ data: { assessmentId, runId: run.id, exportCode: data.code, variant: data.variant, grantId: grant?.id ?? null, requestedById: user.id, requestedAt: generatedAt, rowCount, manifestHash } });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "EXPORT_GENERATED", entityType: "ExportRecord", entityId: record.id, metadataJson: { exportCode: data.code, variant: data.variant, rowCount, manifestHash, grantId: grant?.id ?? null, runId: run.id } } });
  });
  const buffer = zip([{ name: "manifest.json", content: manifestJson }, ...csvFiles.map(file => ({ name: file.name, content: file.content }))], generatedAt);
  return { filename: `IEO_${data.code}_${data.variant}_${generatedAt.toISOString().slice(0, 10)}.zip`, buffer, manifest };
}

export async function listExports(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(assessmentId).success) throw new AccessDeniedError();
  const assessment = await db().assessment.findFirst({ where: { id: assessmentId, organization: { status: "ACTIVE", memberships: { some: { userId: user.id, role: "IEO_CONSULTANT", active: true, user: { status: "ACTIVE" } } } } }, select: { id: true, currentRunId: true } });
  if (!assessment) throw new AccessDeniedError();
  const rows = await db().exportRecord.findMany({ where: { assessmentId }, orderBy: { requestedAt: "desc" }, take: 50, select: { id: true, exportCode: true, variant: true, rowCount: true, manifestHash: true, requestedAt: true, grantId: true, requestedBy: { select: { name: true, email: true } } } });
  return { currentRunId: assessment.currentRunId, records: rows.map(row => ({ ...row, requestedBy: row.requestedBy.name ?? row.requestedBy.email })) };
}
