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
import { loadOfficialCatalogs, officialCatalogs } from "@/infrastructure/catalog/load";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
import { minimalAnswers } from "./survey-fixtures";

const mailbox = join(tmpdir(), `ieo-p4-mail-${process.pid}-${randomUUID()}.jsonl`);
const prior = { provider: process.env.EMAIL_PROVIDER, mode: process.env.E2E_MODE, path: process.env.E2E_MAILBOX_PATH };
const tag = randomUUID().slice(0, 8);
const invitationIds: string[] = [];
const assessmentIds: string[] = [];
const perspectives = ["DIR", "ESP", "LID", "COL", "CLI"] as const;
let admin = "";
function mail(kind: "link" | "otp") { return readFileSync(mailbox, "utf8").trim().split("\n").map(line => JSON.parse(line) as { kind: string; value: string }).filter(row => row.kind === kind).at(-1)!.value; }
async function participant(perspectiveCode: (typeof perspectives)[number], assessmentId = demoIds.assessmentA) {
  const row = await createInvitation(admin, assessmentId, { email: `${perspectiveCode.toLowerCase()}-${randomUUID().slice(0, 6)}-${tag}@example.test`, perspectiveCode, expiresAt: new Date(Date.now() + 86400_000).toISOString() });
  invitationIds.push(row.id);
  const context = (await startAccess(mail("link").split("/").at(-1)!)).bearer;
  const { bearer } = await verifyOtp(context, mail("otp"));
  await acceptIntro(bearer);
  const survey = await readSurvey(bearer);
  if (survey.submitted) throw new Error("No debería estar enviado");
  return { bearer, survey, invitationId: row.id };
}

beforeAll(async () => {
  process.env.EMAIL_PROVIDER = "file"; process.env.E2E_MODE = "true"; process.env.E2E_MAILBOX_PATH = mailbox;
  writeFileSync(mailbox, "", { mode: 0o600 });
  const result = await login({ email: "consultor@ieo.local", password: seedEnvironment().SEED_USER_PASSWORD });
  if (!result.ok) throw new Error("Login fixture inválido");
  admin = result.token;
});
afterAll(async () => {
  for (const id of invitationIds) {
    const binding = await db().participantAccessBinding.findUnique({ where: { invitationId: id } });
    if (binding) {
      await db().participantAuthSession.deleteMany({ where: { accessBindingId: binding.id } });
      await db().surveyResponse.deleteMany({ where: { responseSessionId: binding.responseSessionId } });
      await db().auditLog.deleteMany({ where: { entityId: binding.responseSessionId } });
      await db().participantAccessBinding.delete({ where: { id: binding.id } });
      await db().responseSession.delete({ where: { id: binding.responseSessionId } });
    }
    await db().accessChallenge.deleteMany({ where: { invitationId: id } });
    await db().auditLog.deleteMany({ where: { entityId: id } });
    await db().invitation.delete({ where: { id } });
  }
  for (const id of assessmentIds) {
    await db().auditLog.deleteMany({ where: { assessmentId: id } });
    await db().assessmentPerspective.deleteMany({ where: { assessmentId: id } });
    await db().assessment.delete({ where: { id } });
  }
  await db().$disconnect();
  unlinkSync(mailbox);
  for (const [key, value] of Object.entries({ EMAIL_PROVIDER: prior.provider, E2E_MODE: prior.mode, E2E_MAILBOX_PATH: prior.path })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

it("P4-INT-01 package IEO 1.0 holds exactly one instrument per perspective and reloads idempotently", async () => {
  const pkg = await db().methodologyPackage.findUniqueOrThrow({ where: { code_version: { code: "IEO", version: "1.0" } }, include: { instruments: { include: { instrumentVersion: true } } } });
  expect(pkg.instruments.map(row => row.perspectiveCode).sort()).toEqual([...perspectives].sort());
  for (const catalog of officialCatalogs) expect(pkg.instruments.find(row => row.perspectiveCode === catalog.perspectiveCode)?.instrumentVersion.contentHash).toBe(catalog.contentHash);
  expect(await loadOfficialCatalogs(db())).toMatchObject({ packageId: pkg.id, instrumentsCreated: 0 });
});
it("P4-INT-02 MySQL rejects a package entry whose instrument belongs to another perspective", async () => {
  const other = await db().methodologyPackage.create({ data: { code: `TEST-${tag}`, version: "0", title: "Prueba" } });
  const col = await db().instrumentVersion.findUniqueOrThrow({ where: { instrumentCode_version: { instrumentCode: "IEO-COL-01", version: "1.0" } } });
  await expect(db().packageInstrument.create({ data: { packageId: other.id, perspectiveCode: "DIR", instrumentVersionId: col.id } })).rejects.toThrow();
  await db().methodologyPackage.delete({ where: { id: other.id } });
});
it("P4-INT-03 demo and newly created assessments are pinned to the package", async () => {
  const pkg = await db().methodologyPackage.findUniqueOrThrow({ where: { code_version: { code: "IEO", version: "1.0" } } });
  expect((await db().assessment.findUniqueOrThrow({ where: { id: demoIds.assessmentA } })).methodologyPackageId).toBe(pkg.id);
  const { id } = await createAssessment(admin, { organization: { kind: "existing", id: demoIds.organizationA }, name: `Paquete ${tag}`, period: "2026", objective: null });
  assessmentIds.push(id);
  expect((await db().assessment.findUniqueOrThrow({ where: { id } })).methodologyPackageId).toBe(pkg.id);
});
it("P4-INT-04 each perspective receives its own instrument and can submit with the per-Element minimum", async () => {
  for (const perspectiveCode of perspectives) {
    const { bearer, survey, invitationId } = await participant(perspectiveCode);
    const catalog = officialCatalogs.find(item => item.perspectiveCode === perspectiveCode)!;
    expect(survey.definition.code).toBe(catalog.instrumentCode);
    expect(survey.definition.sections.flatMap(section => section.items.map(item => item.key))).toEqual(catalog.questions.map(question => question.code));
    const { revision } = await saveSurvey(bearer, { expectedRevision: survey.revision, answers: minimalAnswers(perspectiveCode) });
    expect(await submitSurvey(bearer, { expectedRevision: revision })).toEqual({ submitted: true });
    const binding = await db().participantAccessBinding.findUniqueOrThrow({ where: { invitationId }, include: { responseSession: true } });
    expect(binding.responseSession).toMatchObject({ surveyCode: catalog.instrumentCode, status: "SUBMITTED" });
  }
});
it("P4-INT-05 DIR rejects N/A even when sent directly", async () => {
  const { bearer, survey } = await participant("DIR");
  await expect(saveSurvey(bearer, { expectedRevision: survey.revision, answers: [{ itemKey: "DIR_E01_R001", answerState: "NA" }] })).rejects.toMatchObject({ status: 400 });
  expect(JSON.stringify(survey.definition.scale)).not.toContain("NA");
});
it("P4-INT-06 CLI: 2 of 4 in Element III blocks; 3 of 4 passes; general open questions stay optional", async () => {
  const { bearer, survey } = await participant("CLI");
  const e03 = officialCatalogs.find(item => item.perspectiveCode === "CLI")!.questions.filter(question => question.elementCode === "E03" && question.kind === "QUANT").map(question => question.code);
  const others = minimalAnswers("CLI").filter(answer => !e03.includes(answer.itemKey));
  let { revision } = await saveSurvey(bearer, { expectedRevision: survey.revision, answers: [...others, ...e03.slice(0, 2).map(itemKey => ({ itemKey, answerState: "VALUE" as const, numericValue: 5 }))] });
  await expect(submitSurvey(bearer, { expectedRevision: revision })).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/Revisa: Elemento III\.$/) });
  ({ revision } = await saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: e03[2], answerState: "VALUE", numericValue: 5 }, { itemKey: "CLI_GEN_O02", answerState: "VALUE", textValue: "comentario ficticio" }] }));
  expect(await submitSurvey(bearer, { expectedRevision: revision })).toEqual({ submitted: true });
});
it("P4-INT-07 an assessment without package cannot start a questionnaire", async () => {
  const { id } = await createAssessment(admin, { organization: { kind: "existing", id: demoIds.organizationA }, name: `Sin paquete ${tag}`, period: "2026", objective: null });
  assessmentIds.push(id);
  await db().assessment.update({ where: { id }, data: { methodologyPackageId: null } });
  const row = await createInvitation(admin, id, { email: `nopkg-${tag}@example.test`, perspectiveCode: "COL", expiresAt: new Date(Date.now() + 86400_000).toISOString() });
  invitationIds.push(row.id);
  const context = (await startAccess(mail("link").split("/").at(-1)!)).bearer;
  await expect(verifyOtp(context, mail("otp"))).rejects.toMatchObject({ status: 503 });
  expect(await db().participantAccessBinding.count({ where: { invitationId: row.id } })).toBe(0);
});
it("P4-INT-08 a retired technical-survey session (no instrument) answers 410", async () => {
  const { bearer, invitationId } = await participant("ESP");
  const binding = await db().participantAccessBinding.findUniqueOrThrow({ where: { invitationId } });
  await db().responseSession.update({ where: { id: binding.responseSessionId }, data: { instrumentVersionId: null, surveyCode: "TECH-SURVEY-01" } });
  await expect(readSurvey(bearer)).rejects.toMatchObject({ status: 410 });
});
