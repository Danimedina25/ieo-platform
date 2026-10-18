import { afterAll, beforeAll, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/infrastructure/persistence/db";
import type { Prisma } from "@/generated/prisma/client";
import { login } from "@/application/authentication";
import { createAssessment } from "@/application/workspace";
import { closeAssessment, freezeAssessment, processAssessment, recordQuality, saveChecklist } from "@/application/closure";
import { listQualitative, recordDisclosure, reviewQualitative } from "@/application/results";
import { buildExport } from "@/application/exports";
import { decideGrant, listCustodianGrants, requestGrant } from "@/application/grants";
import { verifyHistory } from "@/infrastructure/history/verify";
import { zipTextEntries } from "@/infrastructure/catalog/office-sources";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
import { insertParticipant } from "../fixtures/participants";
import { parseCsv } from "../fixtures/csv";

const tag = randomUUID().slice(0, 8);
const tokens: Record<"consultant" | "coordinator" | "otherConsultant" | "custodian", string> = { consultant: "", coordinator: "", otherConsultant: "", custodian: "" };
let assessmentId = "", runId = "";
const sessions: Record<string, Awaited<ReturnType<typeof insertParticipant>>> = {};
const unzip = (result: { buffer: Buffer }) => zipTextEntries(result.buffer);
const csv = (result: { buffer: Buffer }, name: string) => parseCsv(unzip(result).get(name)!);
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const exportOf = (token: string, code: string, variant: string) => buildExport(token, assessmentId, { code, variant });

beforeAll(async () => {
  const password = seedEnvironment().SEED_USER_PASSWORD;
  for (const [key, email] of [["consultant", "consultor@ieo.local"], ["coordinator", "coordinador@ieo.local"], ["otherConsultant", "consultor2@ieo.local"], ["custodian", "custodio@ieo.local"]] as const) {
    const result = await login({ email, password });
    if (!result.ok) throw new Error("Login fixture inválido");
    tokens[key] = result.token;
  }
  assessmentId = (await createAssessment(tokens.consultant, { organization: { kind: "existing", id: demoIds.organizationA }, name: `Exportaciones ${tag}`, period: "2026", objective: null })).id;
  for (const code of ["DIR", "ESP", "LID", "COL", "CLI"] as const) await db().assessmentPerspective.updateMany({ where: { assessmentId, perspectiveCode: code }, data: { applicability: code === "DIR" || code === "COL" ? "APPLICABLE" : "NOT_APPLICABLE" } });
  await db().assessment.update({ where: { id: assessmentId }, data: { status: "OPEN", openedAt: new Date() } });
  sessions.col1 = await insertParticipant(assessmentId, `col1-${tag}@example.test`, "COL", 4, "SUBMITTED", "=HYPERLINK(\"http://malicioso\",\"clic\")");
  sessions.col2 = await insertParticipant(assessmentId, `col2-${tag}@example.test`, "COL", 2, "SUBMITTED", `Opinión apta, con coma ${tag}`);
  sessions.dir1 = await insertParticipant(assessmentId, `dir1-${tag}@example.test`, "DIR", 5, "SUBMITTED", null);
  sessions.dir2 = await insertParticipant(assessmentId, `dir2-${tag}@example.test`, "DIR", 3, "SUBMITTED", null);
  await closeAssessment(tokens.consultant, assessmentId);
  for (const [perspectiveCode, verdict, reservations] of [[null, "A", null], ["COL", "A", null], ["DIR", "B", "Dos directivos."]] as const) await recordQuality(tokens.consultant, assessmentId, { perspectiveCode, elementCode: null, verdict, reservations });
  await saveChecklist(tokens.consultant, assessmentId, { items: Array.from({ length: 16 }, (_, index) => ({ item: index + 1, answer: "YES", observation: null })) });
  await freezeAssessment(tokens.consultant, assessmentId);
  runId = (await processAssessment(tokens.consultant, assessmentId)).runId;
});
afterAll(async () => {
  const runIds = (await db().processingRun.findMany({ where: { assessmentId }, select: { id: true } })).map(run => run.id);
  await db().assessment.update({ where: { id: assessmentId }, data: { currentRunId: null } });
  await db().exportRecord.deleteMany({ where: { assessmentId } });
  await db().sensitiveAccessGrant.deleteMany({ where: { assessmentId } });
  for (const model of [db().triangulationPattern, db().qualitativeReview, db().disclosureReview, db().globalResult, db().perspectiveIndexResult, db().elementResult, db().perspectiveElementResult] as unknown as { deleteMany: (args: unknown) => Promise<unknown> }[]) await model.deleteMany({ where: { runId: { in: runIds } } });
  await db().processingRun.deleteMany({ where: { assessmentId } });
  await db().frozenSnapshot.deleteMany({ where: { assessmentId } });
  await db().closureRecord.deleteMany({ where: { assessmentId } });
  await db().qualityAssessment.deleteMany({ where: { assessmentId } });
  await db().surveyResponse.deleteMany({ where: { responseSession: { assessmentId } } });
  await db().participantAccessBinding.deleteMany({ where: { invitation: { assessmentId } } });
  await db().responseSession.deleteMany({ where: { assessmentId } });
  await db().invitation.deleteMany({ where: { assessmentId } });
  await db().auditLog.deleteMany({ where: { assessmentId } });
  await db().assessmentPerspective.deleteMany({ where: { assessmentId } });
  await db().assessment.delete({ where: { id: assessmentId } });
  await db().$disconnect();
});

it("P7-INT-01 EXP04 metadata: manifest with file hashes, all 329 items, rules; recorded and audited; other roles denied", async () => {
  const result = await exportOf(tokens.consultant, "EXP04", "STANDARD");
  const entries = unzip(result);
  expect([...entries.keys()]).toEqual(["manifest.json", "instrumentos.csv", "reglas.csv"]);
  const manifest = JSON.parse(entries.get("manifest.json")!);
  expect(manifest).toMatchObject({ exportCode: "EXP04", variant: "STANDARD", runId, isTest: true, grantId: null });
  for (const file of manifest.files) expect(sha(entries.get(file.name)!)).toBe(file.sha256);
  expect(csv(result, "instrumentos.csv")).toHaveLength(329);
  expect(csv(result, "reglas.csv").map(row => row.rule)).toEqual(expect.arrayContaining(["rounding", "engine_version", "snapshot_sha256", "output_hash"]));
  expect(await db().exportRecord.count({ where: { assessmentId, exportCode: "EXP04" } })).toBe(1);
  expect(await db().auditLog.count({ where: { assessmentId, action: "EXPORT_GENERATED" } })).toBe(1);
  await expect(exportOf(tokens.coordinator, "EXP04", "STANDARD")).rejects.toThrow();
  await expect(exportOf(tokens.otherConsultant, "EXP04", "STANDARD")).rejects.toThrow();
  await expect(exportOf(tokens.custodian, "EXP04", "STANDARD")).rejects.toThrow();
});
it("P7-INT-02 EXP03 report requires the disclosure review and carries no individual data", async () => {
  await expect(exportOf(tokens.consultant, "EXP03", "REPORT")).rejects.toMatchObject({ status: 422 });
  for (const perspectiveCode of ["COL", "DIR"] as const) await recordDisclosure(tokens.consultant, assessmentId, { runId, perspectiveCode, decision: "REPORTABLE", reason: "Sin riesgo identificado en la prueba." });
  const result = await exportOf(tokens.consultant, "EXP03", "REPORT");
  const rows = csv(result, "resultados.csv");
  expect(rows).toHaveLength(40 + 8 + 8 + 5 + 1);
  expect(rows.find(row => row.result_type === "RP" && row.perspective_code === "COL" && row.element_code === "E01")).toMatchObject({ value_exact: "50/1", status: "VALID", valid_n: "2", analyzed_n: "2" });
  expect(rows.find(row => row.result_type === "IEO_GLOBAL")).toMatchObject({ value_exact: "125/2", display_value: "62", status: "COMPLETE" });
  expect(unzip(result).has("puntuaciones_individuales.csv")).toBe(false);
  const content = [...unzip(result).values()].join("\n");
  for (const session of Object.values(sessions)) expect(content).not.toContain(session.sessionId);
  expect(content).not.toMatch(/example\.test/);
});
it("P7-INT-03 a non-reportable perspective suppresses its RP and every RI, BT and Global it would reveal", async () => {
  await recordDisclosure(tokens.consultant, assessmentId, { runId, perspectiveCode: "DIR", decision: "NOT_REPORTABLE", reason: "Dos directivos: identificables." });
  const result = await exportOf(tokens.consultant, "EXP03", "REPORT");
  const rows = csv(result, "resultados.csv");
  expect(rows.filter(row => row.perspective_code === "DIR").every(row => row.status === "SUPRIMIDO_POR_DIVULGACION" && row.value_exact === "")).toBe(true);
  expect(rows.filter(row => row.result_type === "RI" || row.result_type === "BT").every(row => row.status === "SUPRIMIDO_POR_DIVULGACION")).toBe(true);
  expect(rows.find(row => row.result_type === "IEO_GLOBAL")).toMatchObject({ status: "SUPRIMIDO_POR_DIVULGACION", value_exact: "" });
  expect(rows.find(row => row.result_type === "RP" && row.perspective_code === "COL" && row.element_code === "E01")).toMatchObject({ value_exact: "50/1" });
  expect(JSON.parse(unzip(result).get("manifest.json")!).suppression).toMatchObject({ perspectives: ["DIR"], global: true });
  await recordDisclosure(tokens.consultant, assessmentId, { runId, perspectiveCode: "DIR", decision: "REPORTABLE", reason: "Reconsiderado para la prueba." });
});
it("P7-INT-04 EXP02 report: only reviewed apt or redacted answers, without participant pseudonym; reads are audited", async () => {
  const items = await listQualitative(tokens.consultant, assessmentId, { runId, perspectiveCode: null, elementCode: null });
  expect(await db().auditLog.count({ where: { assessmentId, action: "QUALITATIVE_READ" } })).toBe(1);
  expect(csv(await exportOf(tokens.consultant, "EXP02", "REPORT"), "cualitativas.csv")).toHaveLength(0); // all pending
  const apt = items.find(item => item.text.includes("Opinión apta"))!;
  await reviewQualitative(tokens.consultant, assessmentId, { runId, surveyResponseId: apt.id, status: "SAFE_FOR_REPORT", redactedText: null });
  const rows = csv(await exportOf(tokens.consultant, "EXP02", "REPORT"), "cualitativas.csv");
  expect(rows).toEqual([expect.objectContaining({ perspective_code: "COL", element_code: "E01", response_text: `Opinión apta, con coma ${tag}`, anonymization_status: "SAFE_FOR_REPORT" })]);
  expect(Object.keys(rows[0])).not.toContain("participant");
});
it("P7-INT-05 individual exports are refused without an approved, current grant", async () => {
  for (const [code, variant] of [["EXP01", "STANDARD"], ["EXP03", "TECHNICAL"], ["EXP02", "FULL"]]) await expect(exportOf(tokens.consultant, code, variant)).rejects.toMatchObject({ status: 403 });
  await expect(exportOf(tokens.consultant, "EXP01", "REPORT")).rejects.toMatchObject({ status: 422 });
});
it("P7-INT-06 grants: the consultant requests, cannot approve; the custodian approves; nobody self-approves", async () => {
  await expect(requestGrant(tokens.consultant, assessmentId, { scope: "RAW_RESPONSES", purpose: "Auditoría", days: 7 })).rejects.toThrow();
  await expect(requestGrant(tokens.consultant, assessmentId, { scope: "RAW_RESPONSES", purpose: "Auditoría de reprocesamiento de prueba", days: 31 })).rejects.toThrow();
  await expect(requestGrant(tokens.custodian, assessmentId, { scope: "RAW_RESPONSES", purpose: "Auditoría de reprocesamiento de prueba", days: 7 })).rejects.toThrow();
  const { id } = await requestGrant(tokens.consultant, assessmentId, { scope: "RAW_RESPONSES", purpose: "Auditoría de reprocesamiento de prueba", days: 7 });
  await expect(decideGrant(tokens.consultant, id, { action: "approve" })).rejects.toThrow();
  await expect(decideGrant(tokens.otherConsultant, id, { action: "approve" })).rejects.toThrow();
  const queue = await listCustodianGrants(tokens.custodian);
  expect(queue.find(row => row.id === id)).toMatchObject({ status: "PENDING", scope: "RAW_RESPONSES" });
  await expect(listCustodianGrants(tokens.consultant)).rejects.toThrow();
  expect(await decideGrant(tokens.custodian, id, { action: "approve", note: "Aprobado para la prueba." })).toEqual({ id, status: "ACTIVE" });
  await expect(decideGrant(tokens.custodian, id, { action: "approve" })).rejects.toThrow();
  const consultantId = (await db().user.findUniqueOrThrow({ where: { email: "consultor@ieo.local" } })).id;
  await expect(db().$executeRaw`UPDATE SensitiveAccessGrant SET decidedById = ${consultantId} WHERE id = ${id}`).rejects.toThrow(); // MySQL CHECK
});
it("P7-INT-07 with the grant, EXP01 has one row per item, per-download pseudonyms and no identifiers", async () => {
  const first = await exportOf(tokens.consultant, "EXP01", "STANDARD");
  const rows = csv(first, "respuestas_crudas.csv");
  expect(rows).toHaveLength(2 * 73 + 2 * 75);
  expect(new Set(rows.map(row => row.participant))).toEqual(new Set(["P0001", "P0002", "P0003", "P0004"]));
  expect(rows.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.submitted_on))).toBe(true);
  expect(rows.find(row => row.item_code === "COL_E01_R009")?.raw_response).toMatch(/^[24]$/); // raw, not recoded
  const content = [...unzip(first).values()].join("\n");
  for (const session of Object.values(sessions)) expect(content).not.toContain(session.sessionId);
  expect(JSON.parse(unzip(first).get("manifest.json")!).grantId).not.toBeNull();
  expect((await db().exportRecord.findFirstOrThrow({ where: { assessmentId, exportCode: "EXP01" } })).grantId).not.toBeNull();
});
it("P7-INT-08 revoked or expired grants stop the export immediately", async () => {
  const grant = await db().sensitiveAccessGrant.findFirstOrThrow({ where: { assessmentId, scope: "RAW_RESPONSES" } });
  await db().sensitiveAccessGrant.update({ where: { id: grant.id }, data: { requestedAt: new Date(Date.now() - 2 * 86400_000), expiresAt: new Date(Date.now() - 1000) } });
  await expect(exportOf(tokens.consultant, "EXP01", "STANDARD")).rejects.toMatchObject({ status: 403 });
  const { id } = await requestGrant(tokens.consultant, assessmentId, { scope: "QUALITATIVE_ORIGINAL", purpose: "Revisión cualitativa completa de prueba", days: 3 });
  await decideGrant(tokens.custodian, id, { action: "approve" });
  const full = csv(await exportOf(tokens.consultant, "EXP02", "FULL"), "cualitativas_completo.csv");
  expect(full.find(row => row.response_text.includes("HYPERLINK"))?.response_text).toBe("'=HYPERLINK(\"http://malicioso\",\"clic\")"); // formula neutralized
  await decideGrant(tokens.consultant, id, { action: "revoke" });
  await expect(exportOf(tokens.consultant, "EXP02", "FULL")).rejects.toMatchObject({ status: 403 });
});
it("P7-INT-09 historical verification reproduces every run and detects a tampered snapshot", async () => {
  expect((await verifyHistory(db())).problems).toEqual([]);
  const snapshot = await db().frozenSnapshot.findFirstOrThrow({ where: { assessmentId } });
  const payload = snapshot.payloadJson as { sessions: { answers: Record<string, unknown> }[] };
  const tampered = JSON.parse(JSON.stringify(payload));
  tampered.sessions[0].answers[Object.keys(tampered.sessions[0].answers)[0]] = 1;
  await db().frozenSnapshot.update({ where: { id: snapshot.id }, data: { payloadJson: tampered } });
  const result = await verifyHistory(db());
  expect(result.problems.join(" ")).toContain(snapshot.id);
  await db().frozenSnapshot.update({ where: { id: snapshot.id }, data: { payloadJson: payload as unknown as Prisma.InputJsonValue } });
  expect((await verifyHistory(db())).problems).toEqual([]);
});
