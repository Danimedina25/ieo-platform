import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/infrastructure/persistence/db";
import { login } from "@/application/authentication";
import { createAssessment } from "@/application/workspace";
import { closeAssessment, freezeAssessment, processAssessment, recordExclusion, recordQuality, saveChecklist } from "@/application/closure";
import { listQualitative, readResults, recordDisclosure, recordPattern, reviewQualitative } from "@/application/results";
import { decryptOpenText } from "@/infrastructure/participant/crypto";
import { insertParticipant } from "../fixtures/participants";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";

const tag = randomUUID().slice(0, 8);
const tokens: Record<"consultant" | "coordinator" | "otherConsultant", string> = { consultant: "", coordinator: "", otherConsultant: "" };
let assessmentId = "", runId = "";
const sessions: Record<string, { invitationId: string; sessionId: string; openResponseId: string | null }> = {};

async function participant(name: string, perspectiveCode: "DIR" | "COL", value: number, status: "SUBMITTED" | "STARTED", openText: string | null) {
  sessions[name] = await insertParticipant(assessmentId, `${name}-${tag}@example.test`, perspectiveCode, value, status, openText);
}

beforeAll(async () => {
  const password = seedEnvironment().SEED_USER_PASSWORD;
  for (const [key, email] of [["consultant", "consultor@ieo.local"], ["coordinator", "coordinador@ieo.local"], ["otherConsultant", "consultor2@ieo.local"]] as const) {
    const result = await login({ email, password });
    if (!result.ok) throw new Error("Login fixture inválido");
    tokens[key] = result.token;
  }
  assessmentId = (await createAssessment(tokens.consultant, { organization: { kind: "existing", id: demoIds.organizationA }, name: `Resultados ${tag}`, period: "2026", objective: null })).id;
  for (const code of ["DIR", "ESP", "LID", "COL", "CLI"] as const) await db().assessmentPerspective.updateMany({ where: { assessmentId, perspectiveCode: code }, data: { applicability: code === "DIR" || code === "COL" ? "APPLICABLE" : "NOT_APPLICABLE" } });
  await db().assessment.update({ where: { id: assessmentId }, data: { status: "OPEN", openedAt: new Date() } });
  await participant("col1", "COL", 4, "SUBMITTED", `Comentario ficticio uno ${tag}`);
  await participant("col2", "COL", 2, "SUBMITTED", `Comentario ficticio dos ${tag}`);
  await participant("col3", "COL", 5, "SUBMITTED", `Comentario del excluido ${tag}`);
  await participant("draft", "COL", 1, "STARTED", `Comentario del borrador ${tag}`);
  await participant("dir1", "DIR", 5, "SUBMITTED", null);
  await participant("dir2", "DIR", 3, "SUBMITTED", null);
  await closeAssessment(tokens.consultant, assessmentId);
  await recordExclusion(tokens.consultant, assessmentId, { invitationId: sessions.col3.invitationId, reasonCode: "DUPLICATE", description: "Duplicado de prueba" });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: null, elementCode: null, verdict: "A", reservations: null });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "COL", elementCode: null, verdict: "A", reservations: null });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "DIR", elementCode: null, verdict: "B", reservations: "Sólo dos directivos." });
  await saveChecklist(tokens.consultant, assessmentId, { items: Array.from({ length: 16 }, (_, index) => ({ item: index + 1, answer: "YES", observation: null })) });
  await freezeAssessment(tokens.consultant, assessmentId);
  runId = (await processAssessment(tokens.consultant, assessmentId)).runId;
});
afterAll(async () => {
  const runIds = (await db().processingRun.findMany({ where: { assessmentId }, select: { id: true } })).map(run => run.id);
  await db().assessment.update({ where: { id: assessmentId }, data: { currentRunId: null } });
  for (const model of [db().triangulationPattern, db().qualitativeReview, db().disclosureReview, db().globalResult, db().perspectiveIndexResult, db().elementResult, db().perspectiveElementResult] as unknown as { deleteMany: (args: unknown) => Promise<unknown> }[]) await model.deleteMany({ where: { runId: { in: runIds } } });
  await db().processingRun.deleteMany({ where: { assessmentId } });
  await db().frozenSnapshot.deleteMany({ where: { assessmentId } });
  await db().closureRecord.deleteMany({ where: { assessmentId } });
  await db().qualityAssessment.deleteMany({ where: { assessmentId } });
  await db().exclusion.deleteMany({ where: { assessmentId } });
  await db().surveyResponse.deleteMany({ where: { responseSession: { assessmentId } } });
  await db().participantAccessBinding.deleteMany({ where: { invitation: { assessmentId } } });
  await db().responseSession.deleteMany({ where: { assessmentId } });
  await db().invitation.deleteMany({ where: { assessmentId } });
  await db().auditLog.deleteMany({ where: { assessmentId } });
  await db().assessmentPerspective.deleteMany({ where: { assessmentId } });
  await db().assessment.delete({ where: { id: assessmentId } });
  await db().$disconnect();
});

it("P6-INT-01 the consultant reads the matrix, indexes and Global of the current run, without individual PI", async () => {
  const results = await readResults(tokens.consultant, assessmentId);
  if (!results.available) throw new Error("Sin resultados");
  expect(results.run).toMatchObject({ id: runId, isCurrent: true, publishable: true, isTest: true, revisionNumber: 1 });
  expect(results.global).toMatchObject({ status: "COMPLETE", valueExact: "125/2", displayScore: 62, healthLabel: "En erosión", trafficLight: "ORANGE" });
  expect(results.perspectiveElements).toHaveLength(40);
  expect(results.perspectiveElements.find(row => row.perspectiveCode === "COL" && row.elementCode === "E03")).toMatchObject({ status: "VALID", rpExact: "50/1", validPiCount: 2 });
  expect(results.perspectiveElements.find(row => row.perspectiveCode === "ESP" && row.elementCode === "E03")).toMatchObject({ status: "NP", reason: "NOT_APPLIED" });
  expect(results.analyzed).toMatchObject({ COL: 2, DIR: 2, ESP: 0 });
  expect(results.elements[0]).toMatchObject({ riStatus: "INTEGRATED", riExact: "125/2", btDisplay: 25, btClass: "RELEVANT_GAP", maxPerspectives: ["DIR"], minPerspectives: ["COL"] });
  expect(results.perspectiveIndexes.find(row => row.perspectiveCode === "DIR")).toMatchObject({ status: "COMPLETE", displayScore: 75 });
  expect(results.verdicts).toEqual(expect.arrayContaining([expect.objectContaining({ perspectiveCode: "DIR", verdict: "B", reservations: "Sólo dos directivos." })]));
  const serialized = JSON.stringify(results);
  for (const session of Object.values(sessions)) expect(serialized).not.toContain(session.sessionId);
  expect(serialized).not.toMatch(/sessionElements|"pi"|example\.test/);
});
it("P6-INT-02 the coordinator and another organization cannot read results or open answers", async () => {
  await expect(readResults(tokens.coordinator, assessmentId)).rejects.toThrow();
  await expect(readResults(tokens.otherConsultant, assessmentId)).rejects.toThrow();
  await expect(listQualitative(tokens.coordinator, assessmentId, { runId, perspectiveCode: null, elementCode: null })).rejects.toThrow();
});
it("P6-INT-03 open answers come only from analyzed sessions, decrypted, without identifiers", async () => {
  const items = await listQualitative(tokens.consultant, assessmentId, { runId, perspectiveCode: null, elementCode: null });
  expect(items.map(item => item.text).sort()).toEqual([`Comentario ficticio dos ${tag}`, `Comentario ficticio uno ${tag}`]);
  expect(items.every(item => item.perspectiveCode === "COL" && item.elementCode === "E01" && item.status === "REVIEW_PENDING")).toBe(true);
  const serialized = JSON.stringify(items);
  for (const session of Object.values(sessions)) expect(serialized).not.toContain(session.sessionId);
  expect(await listQualitative(tokens.consultant, assessmentId, { runId, perspectiveCode: "DIR", elementCode: null })).toHaveLength(0);
  expect(await listQualitative(tokens.consultant, assessmentId, { runId, perspectiveCode: "COL", elementCode: "E02" })).toHaveLength(0);
});
it("P6-INT-04 a redacted quote keeps the original untouched; excluded or draft answers cannot be reviewed", async () => {
  const target = sessions.col1.openResponseId!;
  await expect(reviewQualitative(tokens.consultant, assessmentId, { runId, surveyResponseId: target, status: "REDACTED", redactedText: null })).rejects.toThrow();
  await reviewQualitative(tokens.consultant, assessmentId, { runId, surveyResponseId: target, status: "REDACTED", redactedText: "Comentario ficticio [redactado]" });
  const original = await db().surveyResponse.findUniqueOrThrow({ where: { id: target } });
  expect(decryptOpenText(original.textCiphertext!)).toBe(`Comentario ficticio uno ${tag}`);
  const review = await db().qualitativeReview.findFirstOrThrow({ where: { surveyResponseId: target } });
  expect(review.redactedCiphertext).not.toContain("redactado");
  const item = (await listQualitative(tokens.consultant, assessmentId, { runId, perspectiveCode: null, elementCode: null })).find(row => row.id === target)!;
  expect(item).toMatchObject({ status: "REDACTED", redactedText: "Comentario ficticio [redactado]", text: `Comentario ficticio uno ${tag}` });
  await expect(reviewQualitative(tokens.consultant, assessmentId, { runId, surveyResponseId: sessions.col3.openResponseId!, status: "DO_NOT_QUOTE", redactedText: null })).rejects.toThrow();
  await expect(reviewQualitative(tokens.consultant, assessmentId, { runId, surveyResponseId: sessions.draft.openResponseId!, status: "DO_NOT_QUOTE", redactedText: null })).rejects.toThrow();
});
it("P6-INT-05 patterns are registered by the consultant, keep their history and require a justification", async () => {
  await expect(recordPattern(tokens.consultant, assessmentId, { runId, elementCode: "E01", patternCode: "PERCEPTION_GAP", justification: " " })).rejects.toThrow();
  await recordPattern(tokens.consultant, assessmentId, { runId, elementCode: "E01", patternCode: "MIXED_RESULT", justification: "Primera lectura." });
  await recordPattern(tokens.consultant, assessmentId, { runId, elementCode: "E01", patternCode: "PERCEPTION_GAP", justification: "Dirección 75 frente a Colaboradores 50; BT relevante." });
  await expect(recordPattern(tokens.coordinator, assessmentId, { runId, elementCode: "E02", patternCode: "MIXED_RESULT", justification: "x" })).rejects.toThrow();
  const results = await readResults(tokens.consultant, assessmentId);
  if (!results.available) throw new Error();
  expect(results.patterns).toEqual([expect.objectContaining({ elementCode: "E01", patternCode: "PERCEPTION_GAP", versions: 2 })]);
});
it("P6-INT-06 hiding a perspective warns it is deducible and never changes RI, BT or Global", async () => {
  const before = await readResults(tokens.consultant, assessmentId);
  await expect(recordDisclosure(tokens.consultant, assessmentId, { runId, perspectiveCode: "ESP", decision: "NOT_REPORTABLE", reason: "x" })).rejects.toMatchObject({ status: 422 });
  await recordDisclosure(tokens.consultant, assessmentId, { runId, perspectiveCode: "DIR", decision: "NOT_REPORTABLE", reason: "Sólo dos directivos: riesgo de identificación." });
  const after = await readResults(tokens.consultant, assessmentId);
  if (!before.available || !after.available) throw new Error();
  expect(after.disclosures).toEqual([expect.objectContaining({ perspectiveCode: "DIR", decision: "NOT_REPORTABLE" })]);
  expect(after.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ perspectiveCode: "DIR", kind: "FEW_PEOPLE" }), expect.objectContaining({ perspectiveCode: "DIR", kind: "DEDUCIBLE_FROM_INTEGRATION", elements: ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"] })]));
  expect(after.global).toEqual(before.global);
  expect(after.elements).toEqual(before.elements);
});
it("P6-INT-07 a new run starts without disclosure decisions or patterns; earlier runs stay readable", async () => {
  const second = await processAssessment(tokens.consultant, assessmentId);
  const current = await readResults(tokens.consultant, assessmentId);
  if (!current.available) throw new Error();
  expect(current.run).toMatchObject({ id: second.runId, isCurrent: true });
  expect(current.disclosures).toHaveLength(0);
  expect(current.patterns).toHaveLength(0);
  const previous = await readResults(tokens.consultant, assessmentId, runId);
  if (!previous.available) throw new Error();
  expect(previous.run).toMatchObject({ id: runId, isCurrent: false });
  expect(previous.disclosures).toHaveLength(1);
  expect(current.runs).toHaveLength(2);
});
