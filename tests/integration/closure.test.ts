import { afterAll, beforeAll, expect, it } from "vitest";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/infrastructure/persistence/db";
import { login } from "@/application/authentication";
import { createAssessment } from "@/application/workspace";
import { createInvitation } from "@/application/participant/invitations";
import { startAccess, verifyOtp } from "@/application/participant/access";
import { acceptIntro, readSurvey, saveSurvey, submitSurvey } from "@/application/participant/survey";
import { closeAssessment, freezeAssessment, openAssessment, processAssessment, readClosure, recordExclusion, recordIncident, recordQuality, reopenAssessment, revokeExclusion, saveChecklist } from "@/application/closure";
import { engineInputFromSnapshot, type SnapshotPayload } from "@/domain/closure/snapshot";
import { sha256Canonical } from "@/domain/canonical";
import { runEngine } from "@/domain/ieo-engine";
import { officialCatalogs } from "@/infrastructure/catalog/load";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";

const mailbox = join(tmpdir(), `ieo-p5b-mail-${process.pid}-${randomUUID()}.jsonl`);
const prior = { provider: process.env.EMAIL_PROVIDER, mode: process.env.E2E_MODE, path: process.env.E2E_MAILBOX_PATH };
const tag = randomUUID().slice(0, 8);
const tokens: Record<"consultant" | "coordinator" | "otherConsultant", string> = { consultant: "", coordinator: "", otherConsultant: "" };
let assessmentId = "";
const invitations: Record<string, string> = {};
const bearers: Record<string, string> = {};
const checklist = { items: Array.from({ length: 16 }, (_, index) => ({ item: index + 1, answer: "YES" as const, observation: null })) };
function mail(kind: "link" | "otp", recipient: string) { return readFileSync(mailbox, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as { kind: string; value: string; to: string }).filter(row => row.kind === kind && row.to.includes(recipient)).at(-1)?.value; }
/** Every quantitative item answered so each score is the same: reverse items get 6 − value. */
function uniform(perspectiveCode: "DIR" | "COL", value: 1 | 2 | 3 | 4 | 5) {
  return officialCatalogs.find(item => item.perspectiveCode === perspectiveCode)!.questions.filter(question => question.kind === "QUANT").map(question => ({ itemKey: question.code, answerState: "VALUE" as const, numericValue: question.orientation === "REVERSE" ? 6 - value : value }));
}
async function invite(name: string, perspectiveCode: "DIR" | "COL") {
  const email = `${name}-${tag}@example.test`;
  invitations[name] = (await createInvitation(tokens.consultant, assessmentId, { email, perspectiveCode, expiresAt: new Date(Date.now() + 86400_000).toISOString() })).id;
  return email;
}
async function enter(name: string, email: string) {
  const context = (await startAccess(mail("link", email)!.split("/").at(-1)!)).bearer;
  bearers[name] = (await verifyOtp(context, mail("otp", email)!)).bearer;
  await acceptIntro(bearers[name]);
}
async function answer(name: string, answers: unknown[], submit = true) {
  const survey = await readSurvey(bearers[name]);
  if (survey.submitted) throw new Error("ya enviado");
  const { revision } = await saveSurvey(bearers[name], { expectedRevision: survey.revision, answers });
  if (submit) await submitSurvey(bearers[name], { expectedRevision: revision });
}

beforeAll(async () => {
  process.env.EMAIL_PROVIDER = "file"; process.env.E2E_MODE = "true"; process.env.E2E_MAILBOX_PATH = mailbox;
  writeFileSync(mailbox, "", { mode: 0o600 });
  const password = seedEnvironment().SEED_USER_PASSWORD;
  for (const [key, email] of [["consultant", "consultor@ieo.local"], ["coordinator", "coordinador@ieo.local"], ["otherConsultant", "consultor2@ieo.local"]] as const) {
    const result = await login({ email, password });
    if (!result.ok) throw new Error("Login fixture inválido");
    tokens[key] = result.token;
  }
  assessmentId = (await createAssessment(tokens.consultant, { organization: { kind: "existing", id: demoIds.organizationA }, name: `Cierre ${tag}`, period: "2026", objective: "Prueba de cierre" })).id;
});
afterAll(async () => {
  const runs = await db().processingRun.findMany({ where: { assessmentId }, select: { id: true } });
  const runIds = runs.map(run => run.id);
  await db().assessment.update({ where: { id: assessmentId }, data: { currentRunId: null } });
  await db().globalResult.deleteMany({ where: { runId: { in: runIds } } });
  await db().perspectiveIndexResult.deleteMany({ where: { runId: { in: runIds } } });
  await db().elementResult.deleteMany({ where: { runId: { in: runIds } } });
  await db().perspectiveElementResult.deleteMany({ where: { runId: { in: runIds } } });
  await db().processingRun.deleteMany({ where: { assessmentId } });
  await db().frozenSnapshot.deleteMany({ where: { assessmentId } });
  await db().closureRecord.deleteMany({ where: { assessmentId } });
  await db().qualityAssessment.deleteMany({ where: { assessmentId } });
  await db().exclusion.deleteMany({ where: { assessmentId } });
  await db().incident.deleteMany({ where: { assessmentId } });
  const bindings = await db().participantAccessBinding.findMany({ where: { invitation: { assessmentId } } });
  await db().participantAuthSession.deleteMany({ where: { accessBindingId: { in: bindings.map(row => row.id) } } });
  await db().surveyResponse.deleteMany({ where: { responseSession: { assessmentId } } });
  await db().participantAccessBinding.deleteMany({ where: { id: { in: bindings.map(row => row.id) } } });
  await db().responseSession.deleteMany({ where: { assessmentId } });
  await db().accessChallenge.deleteMany({ where: { invitation: { assessmentId } } });
  await db().invitation.deleteMany({ where: { assessmentId } });
  await db().auditLog.deleteMany({ where: { assessmentId } });
  await db().assessmentPerspective.deleteMany({ where: { assessmentId } });
  await db().assessment.delete({ where: { id: assessmentId } });
  await db().$disconnect();
  unlinkSync(mailbox);
  for (const [key, value] of Object.entries({ EMAIL_PROVIDER: prior.provider, E2E_MODE: prior.mode, E2E_MAILBOX_PATH: prior.path })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

it("P5B-INT-01 opening requires the five perspectives classified and at least one applicable", async () => {
  await expect(openAssessment(tokens.consultant, assessmentId)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Clasifica") });
  await db().assessmentPerspective.updateMany({ where: { assessmentId }, data: { applicability: "NOT_APPLICABLE" } });
  await expect(openAssessment(tokens.consultant, assessmentId)).rejects.toMatchObject({ message: expect.stringContaining("aplicable") });
  for (const [code, applicability] of [["DIR", "APPLICABLE"], ["COL", "APPLICABLE"], ["LID", "NOT_AVAILABLE"]] as const) await db().assessmentPerspective.updateMany({ where: { assessmentId, perspectiveCode: code }, data: { applicability } });
});
it("P5B-INT-02 an invitation created in DRAFT waits unsent; the coordinator and another organization cannot open", async () => {
  const email = await invite("col1", "COL");
  expect((await db().invitation.findUniqueOrThrow({ where: { id: invitations.col1 } })).status).toBe("CREATED");
  expect(mail("link", email)).toBeUndefined();
  await expect(openAssessment(tokens.coordinator, assessmentId)).rejects.toThrow();
  await expect(openAssessment(tokens.otherConsultant, assessmentId)).rejects.toThrow();
});
it("P5B-INT-03 opening sends pending invitations and participants answer only while OPEN", async () => {
  expect(await openAssessment(tokens.consultant, assessmentId)).toEqual({ status: "OPEN", invitationsSent: 1 });
  await enter("col1", `col1-${tag}@example.test`);
  await answer("col1", uniform("COL", 4));
  for (const [name, code] of [["col2", "COL"], ["col3", "COL"], ["dir1", "DIR"], ["dir2", "DIR"], ["draft", "COL"]] as const) await enter(name, await invite(name, code));
  await answer("col2", uniform("COL", 2));
  await answer("col3", uniform("COL", 5));
  await answer("dir1", uniform("DIR", 5));
  await answer("dir2", uniform("DIR", 3));
  await answer("draft", uniform("COL", 1).slice(0, 10), false);
});
it("P5B-INT-04 writes are refused after plannedClosesAt even before the explicit close", async () => {
  await db().assessment.update({ where: { id: assessmentId }, data: { plannedClosesAt: new Date(Date.now() - 1000) } });
  const survey = await readSurvey(bearers.draft);
  if (survey.submitted) throw new Error();
  await expect(saveSurvey(bearers.draft, { expectedRevision: survey.revision, answers: [{ itemKey: "COL_E01_R001", answerState: "VALUE", numericValue: 3 }] })).rejects.toMatchObject({ status: 409, message: expect.stringContaining("ventana") });
  await db().assessment.update({ where: { id: assessmentId }, data: { plannedClosesAt: null } });
});
it("P5B-INT-05 closing stops responses and creates the closure record", async () => {
  await expect(freezeAssessment(tokens.consultant, assessmentId)).rejects.toMatchObject({ status: 409 });
  expect(await closeAssessment(tokens.consultant, assessmentId)).toEqual({ status: "CLOSED" });
  await expect(readSurvey(bearers.draft)).rejects.toThrow();
  const view = await readClosure(tokens.consultant, assessmentId);
  expect(view.participation.find(row => row.perspectiveCode === "COL")).toMatchObject({ invited: 4, submitted: 3, drafts: 1, excluded: 0 });
  expect(view.participation.find(row => row.perspectiveCode === "DIR")).toMatchObject({ invited: 2, submitted: 2 });
  await expect(readClosure(tokens.coordinator, assessmentId)).rejects.toThrow();
});
it("P5B-INT-06 only submitted questionnaires can be excluded; exclusions can be revoked and recorded again", async () => {
  await expect(recordExclusion(tokens.consultant, assessmentId, { invitationId: invitations.draft, reasonCode: "DUPLICATE", description: "borrador" })).rejects.toMatchObject({ status: 422 });
  const { id } = await recordExclusion(tokens.consultant, assessmentId, { invitationId: invitations.col3, reasonCode: "DUPLICATE", description: "Envío repetido de prueba" });
  await revokeExclusion(tokens.consultant, assessmentId, id);
  expect((await readClosure(tokens.consultant, assessmentId)).exclusions).toHaveLength(0);
  await recordExclusion(tokens.consultant, assessmentId, { invitationId: invitations.col3, reasonCode: "DUPLICATE", description: "Envío repetido de prueba" });
  expect((await readClosure(tokens.consultant, assessmentId)).exclusions).toEqual([expect.objectContaining({ invitationId: invitations.col3, perspectiveCode: "COL", reasonCode: "DUPLICATE" })]);
});
it("P5B-INT-07 freezing requires checklist, global verdict and a verdict per applicable perspective", async () => {
  await recordIncident(tokens.consultant, assessmentId, { occurredOn: "2026-10-18", perspectiveCode: "COL", description: "Correo rebotado", impact: "Bajo", action: "Reenvío", responsible: "Consultor demo" });
  await expect(freezeAssessment(tokens.consultant, assessmentId)).rejects.toMatchObject({ status: 422, message: expect.stringContaining("checklist") });
  await expect(saveChecklist(tokens.consultant, assessmentId, { items: checklist.items.slice(0, 15) })).rejects.toThrow();
  await saveChecklist(tokens.consultant, assessmentId, checklist);
  await expect(freezeAssessment(tokens.consultant, assessmentId)).rejects.toMatchObject({ message: expect.stringContaining("global") });
  await expect(recordQuality(tokens.consultant, assessmentId, { perspectiveCode: null, elementCode: null, verdict: "B", reservations: null })).rejects.toThrow();
  await expect(recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "LID", elementCode: null, verdict: "A", reservations: null })).rejects.toMatchObject({ status: 422 });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: null, elementCode: null, verdict: "A", reservations: null });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "COL", elementCode: null, verdict: "A", reservations: null });
  await expect(freezeAssessment(tokens.consultant, assessmentId)).rejects.toMatchObject({ message: expect.stringContaining("DIR") });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "DIR", elementCode: null, verdict: "B", reservations: "Sólo dos directivos respondieron." });
});
it("P5B-INT-08 freezing writes the acta and an identity-free snapshot without drafts or exclusions", async () => {
  const { sha256, actaHash } = await freezeAssessment(tokens.consultant, assessmentId);
  const snapshot = await db().frozenSnapshot.findUniqueOrThrow({ where: { assessmentId_revisionNumber: { assessmentId, revisionNumber: 1 } } });
  const payload = snapshot.payloadJson as unknown as SnapshotPayload;
  expect(sha256Canonical(payload)).toBe(sha256);
  expect(payload.sessions).toHaveLength(4);
  expect(payload.excludedSessionIds).toHaveLength(1);
  expect(payload.sessions.map(row => row.perspectiveCode).sort()).toEqual(["COL", "COL", "DIR", "DIR"]);
  expect(JSON.stringify(payload)).not.toMatch(/@|example\.test|invitation/i);
  expect(payload.perspectives.find(row => row.perspectiveCode === "LID")).toMatchObject({ scope: "NOT_AVAILABLE" });
  const record = await db().closureRecord.findUniqueOrThrow({ where: { assessmentId_revisionNumber: { assessmentId, revisionNumber: 1 } } });
  const acta = record.actaJson as Record<string, unknown>;
  expect(record.actaHash).toBe(actaHash);
  expect(sha256Canonical(acta)).toBe(actaHash);
  expect(acta).toMatchObject({ dictamenGlobal: "A", perspectivasValidas: ["Colaboradores"], perspectivasConReservas: ["Dirección"], revision: 1 });
  expect(acta.perspectivasInsuficientesONP).toEqual(expect.arrayContaining([{ perspectiva: "Liderazgo", motivo: "ND — no disponible" }, { perspectiva: "Especialistas", motivo: "NP — no aplicable" }]));
  expect(JSON.stringify(acta)).not.toContain(`col3-${tag}`);
  expect((acta.checklist as unknown[])).toHaveLength(16);
  await expect(recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "COL", elementCode: null, verdict: "C", reservations: "x" })).rejects.toMatchObject({ status: 409 });
});
it("P5B-INT-09 processing runs the engine on the snapshot and stores typed results", async () => {
  const result = await processAssessment(tokens.consultant, assessmentId);
  expect(result).toMatchObject({ status: "SUCCEEDED", publishable: true, globalStatus: "COMPLETE" });
  const run = await db().processingRun.findUniqueOrThrow({ where: { id: result.runId }, include: { global: true, elements: true, perspectiveElements: true, perspectiveIndexes: true, snapshot: true } });
  expect(run.outputHash).toBe(runEngine(engineInputFromSnapshot(run.snapshot.payloadJson as unknown as SnapshotPayload)).outputHash);
  expect(run.perspectiveElements).toHaveLength(40);
  const rp = (code: string) => run.perspectiveElements.find(row => row.perspectiveCode === code && row.elementCode === "E01")!;
  expect(rp("COL")).toMatchObject({ status: "VALID", validPiCount: 2, rpExact: "50/1" }); // (75 + 25) / 2; the excluded 100 is out
  expect(rp("DIR")).toMatchObject({ status: "VALID", rpExact: "75/1" }); // (100 + 50) / 2
  expect(rp("ESP")).toMatchObject({ status: "NP", rpExact: null });
  expect(rp("LID")).toMatchObject({ status: "ND", reason: "NOT_AVAILABLE" });
  expect(run.elements.find(row => row.elementCode === "E01")).toMatchObject({ riStatus: "INTEGRATED", riExact: "125/2", btStatus: "PARTIAL", btDisplay: 25, btClass: "RELEVANT_GAP" });
  expect(run.global).toMatchObject({ status: "COMPLETE", valueExact: "125/2", displayScore: 62, healthLabel: "En erosión", trafficLight: "ORANGE", integratedElementCount: 8 });
  const assessment = await db().assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  expect(assessment).toMatchObject({ status: "PROCESSED", currentRunId: run.id });
});
it("P5B-INT-10 reprocessing creates a new run with the same output hash and keeps the previous one", async () => {
  const first = (await db().assessment.findUniqueOrThrow({ where: { id: assessmentId } })).currentRunId!;
  const second = await processAssessment(tokens.consultant, assessmentId);
  const runs = await db().processingRun.findMany({ where: { assessmentId } });
  expect(runs).toHaveLength(2);
  expect(new Set(runs.map(run => run.outputHash)).size).toBe(1);
  expect(second.runId).not.toBe(first);
  expect((await db().assessment.findUniqueOrThrow({ where: { id: assessmentId } })).currentRunId).toBe(second.runId);
});
it("P5B-INT-11 reopening requires a reason, creates revision 2 and leaves revision 1 intact", async () => {
  await expect(reopenAssessment(tokens.consultant, assessmentId, { reason: "" })).rejects.toThrow();
  await expect(reopenAssessment(tokens.coordinator, assessmentId, { reason: "x" })).rejects.toThrow();
  expect(await reopenAssessment(tokens.consultant, assessmentId, { reason: "Incidencia en Dirección detectada tras el cierre" })).toEqual({ status: "OPEN", revisionNumber: 2 });
  const assessment = await db().assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  expect(assessment).toMatchObject({ status: "OPEN", revisionNumber: 2, currentRunId: null, closedAt: null });
  expect(await db().frozenSnapshot.count({ where: { assessmentId, revisionNumber: 1 } })).toBe(1);
  expect(await db().processingRun.count({ where: { assessmentId } })).toBe(2);
  const audit = await db().auditLog.findFirstOrThrow({ where: { assessmentId, action: "ASSESSMENT_REOPENED" } });
  expect(audit.metadataJson).toMatchObject({ fromRevision: 1, revisionNumber: 2, fromStatus: "PROCESSED" });
});
it("P5B-INT-12 dictamen C: a perspective leaves the triangulation and a global C makes the run non-publishable", async () => {
  await closeAssessment(tokens.consultant, assessmentId);
  expect((await readClosure(tokens.consultant, assessmentId)).exclusions).toHaveLength(0); // exclusions belong to their revision
  await saveChecklist(tokens.consultant, assessmentId, checklist);
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: null, elementCode: null, verdict: "C", reservations: "Evidencia insuficiente en esta revisión." });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "COL", elementCode: null, verdict: "A", reservations: null });
  await recordQuality(tokens.consultant, assessmentId, { perspectiveCode: "DIR", elementCode: null, verdict: "C", reservations: "Presión reportada." });
  await freezeAssessment(tokens.consultant, assessmentId);
  const result = await processAssessment(tokens.consultant, assessmentId);
  expect(result).toMatchObject({ status: "SUCCEEDED", publishable: false });
  const run = await db().processingRun.findUniqueOrThrow({ where: { id: result.runId }, include: { global: true, perspectiveElements: true, elements: true } });
  expect(run.perspectiveElements.filter(row => row.perspectiveCode === "DIR").every(row => row.status === "ND" && row.reason === "QUALITY_C")).toBe(true);
  expect(run.elements.every(row => row.riStatus === "LIMITED")).toBe(true);
  expect(run.global).toMatchObject({ status: "ND", reason: "NO_INTEGRATED_ELEMENT", valueExact: null });
  expect((await readClosure(tokens.consultant, assessmentId)).runs).toHaveLength(3);
});
