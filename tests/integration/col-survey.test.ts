import { afterAll, beforeAll, expect, it } from "vitest";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/infrastructure/persistence/db";
import { login } from "@/application/authentication";
import { createInvitation } from "@/application/participant/invitations";
import { startAccess, verifyOtp } from "@/application/participant/access";
import { acceptIntro, readSurvey, saveSurvey, submitSurvey } from "@/application/participant/survey";
import { colCatalog, loadInstrumentCatalog, verifiedCatalog } from "@/infrastructure/catalog/load";
import { catalogContentHash } from "@/domain/survey/catalog";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";

const mailbox = join(tmpdir(), `ieo-col-mail-${process.pid}-${randomUUID()}.jsonl`);
const prior = { provider: process.env.EMAIL_PROVIDER, mode: process.env.E2E_MODE, path: process.env.E2E_MAILBOX_PATH };
const tag = randomUUID().slice(0, 8);
const invitationIds: string[] = [];
let admin = "", bearer = "", revision = 0, responseSessionId = "", espSessionId = "";
function mail(kind: "link" | "otp") { return readFileSync(mailbox, "utf8").trim().split("\n").map(line => JSON.parse(line) as { kind: string; value: string }).filter(row => row.kind === kind).at(-1)!.value; }
async function participant(perspectiveCode: "COL" | "ESP", name: string) {
  const row = await createInvitation(admin, demoIds.assessmentOpenA, { email: `${name}-${tag}@example.test`, perspectiveCode, expiresAt: new Date(Date.now() + 86400_000).toISOString() });
  invitationIds.push(row.id);
  const context = (await startAccess(mail("link").split("/").at(-1)!)).bearer;
  const result = await verifyOtp(context, mail("otp"));
  const binding = await db().participantAccessBinding.findUniqueOrThrow({ where: { invitationId: row.id } });
  return { bearer: result.bearer, responseSessionId: binding.responseSessionId };
}
const save = async (answers: unknown[]) => { revision = (await saveSurvey(bearer, { expectedRevision: revision, answers })).revision; };
const quant = colCatalog.questions.filter(question => question.kind === "QUANT");
const codes = (element: string, count: number, from = 0) => quant.filter(question => question.elementCode === element).slice(from, from + count).map(question => question.code);

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
  await db().$disconnect();
  unlinkSync(mailbox);
  for (const [key, value] of Object.entries({ EMAIL_PROVIDER: prior.provider, E2E_MODE: prior.mode, E2E_MAILBOX_PATH: prior.path })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});

it("P3B-INT-01 catalog is loaded once with 73 + 8 questions, 8 sections and 6 scale options", async () => {
  const version = await db().instrumentVersion.findUniqueOrThrow({ where: { instrumentCode_version: { instrumentCode: "IEO-COL-01", version: "1.0" } }, include: { _count: { select: { sections: true, scaleOptions: true } } } });
  expect(version).toMatchObject({ perspectiveCode: "COL", certified: false, contentHash: colCatalog.contentHash, _count: { sections: 8, scaleOptions: 6 } });
  expect(await db().questionVersion.count({ where: { instrumentVersionId: version.id, kind: "QUANT" } })).toBe(73);
  expect(await db().questionVersion.count({ where: { instrumentVersionId: version.id, kind: "OPEN" } })).toBe(8);
});
it("P3B-INT-02 reloading is idempotent and a changed version is refused", async () => {
  expect((await loadInstrumentCatalog(db(), colCatalog)).created).toBe(false);
  const changed = { ...verifiedCatalog(colCatalog), title: "IEO Colaboradores editado" };
  await expect(loadInstrumentCatalog(db(), { ...changed, contentHash: catalogContentHash(changed) })).rejects.toThrow(/ya existe con otro contenido/);
});
it("P3B-INT-03 COL invitation binds the session to IEO-COL-01; ESP gets IEO-ESP-01", async () => {
  ({ bearer, responseSessionId } = await participant("COL", "col"));
  const session = await db().responseSession.findUniqueOrThrow({ where: { id: responseSessionId }, include: { instrumentVersion: true } });
  expect(session).toMatchObject({ surveyCode: "IEO-COL-01", surveyVersion: 1, isTest: true });
  expect(session.instrumentVersion?.contentHash).toBe(colCatalog.contentHash);
  const esp = await participant("ESP", "esp");
  espSessionId = esp.responseSessionId;
  expect((await db().responseSession.findUniqueOrThrow({ where: { id: esp.responseSessionId }, include: { instrumentVersion: true } })).instrumentVersion?.instrumentCode).toBe("IEO-ESP-01");
});
it("P3B-INT-04 intro records the instrument version and hash", async () => {
  await acceptIntro(bearer);
  expect((await db().responseSession.findUniqueOrThrow({ where: { id: responseSessionId } })).introVersion).toBe(`IEO-COL-01@1.0:${colCatalog.contentHash.slice(0, 16)}`);
});
it("P3B-INT-05 participant receives 8 Elements and 81 items in order, without orientation", async () => {
  const survey = await readSurvey(bearer);
  if (survey.submitted) throw new Error("No debería estar enviado");
  expect(survey.definition.sections.map(section => section.elementCode)).toEqual(["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"]);
  expect(survey.definition.sections.flatMap(section => section.items.map(item => item.key))).toEqual(colCatalog.questions.map(question => question.code));
  expect(JSON.stringify(survey)).not.toMatch(/REVERSE|orientation/);
  revision = survey.revision;
});
it("P3B-INT-06 keys of another instrument, out-of-scale values and N/A on open questions are rejected", async () => {
  await expect(saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: "ESP_E01_R001", answerState: "VALUE", numericValue: 3 }] })).rejects.toMatchObject({ status: 400 });
  await expect(saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: "COL_E01_R001", answerState: "VALUE", numericValue: 6 }] })).rejects.toMatchObject({ status: 400 });
  await expect(saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: "COL_E01_O01", answerState: "NA" }] })).rejects.toMatchObject({ status: 400 });
});
it("P3B-INT-07 reverse items are stored raw and linked to their QuestionVersion; open text is encrypted", async () => {
  await save([{ itemKey: "COL_E01_R009", answerState: "VALUE", numericValue: 1 }, { itemKey: "COL_E01_O01", answerState: "VALUE", textValue: `respuesta ficticia ${tag}` }]);
  const rows = await db().surveyResponse.findMany({ where: { responseSessionId }, include: { questionVersion: true } });
  const reverse = rows.find(row => row.itemKey === "COL_E01_R009")!;
  expect(reverse).toMatchObject({ numericValue: 1, answerState: "VALUE" });
  expect(reverse.questionVersion?.orientation).toBe("REVERSE");
  const text = rows.find(row => row.itemKey === "COL_E01_O01")!;
  expect(text.textCiphertext).not.toContain(tag);
  expect(rows.every(row => row.instrumentVersionId && row.questionVersionId)).toBe(true);
});
it("P3B-INT-08 submission is refused while any Element is below 60 %, naming the Elements", async () => {
  await expect(submitSurvey(bearer, { expectedRevision: revision })).rejects.toMatchObject({ status: 422, message: expect.stringContaining("Elemento I,") });
  for (const element of ["E01", "E02", "E03", "E04", "E05", "E06", "E07"]) await save(codes(element, 6).map(itemKey => ({ itemKey, answerState: "VALUE", numericValue: 4 })));
  await save(codes("E08", 5).map(itemKey => ({ itemKey, answerState: "VALUE", numericValue: 3 })));
  await expect(submitSurvey(bearer, { expectedRevision: revision })).rejects.toMatchObject({ status: 422, message: expect.stringMatching(/Revisa: Elemento VIII\.$/) });
  expect((await db().responseSession.findUniqueOrThrow({ where: { id: responseSessionId } })).status).toBe("STARTED");
});
it("P3B-INT-09 an all-N/A Element does not block submission; open questions are optional", async () => {
  await save(codes("E08", 9).map(itemKey => ({ itemKey, answerState: "NA" })));
  expect(await submitSurvey(bearer, { expectedRevision: revision })).toEqual({ submitted: true });
  const session = await db().responseSession.findUniqueOrThrow({ where: { id: responseSessionId } });
  expect(session.status).toBe("SUBMITTED");
  const audit = await db().auditLog.findFirstOrThrow({ where: { entityId: responseSessionId, action: "PARTICIPANT_TEST_SUBMITTED" } });
  expect(audit.metadataJson).toEqual({ surveyCode: "IEO-COL-01", surveyVersion: "1.0", isTest: true });
  await expect(saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: "COL_E01_R001", answerState: "VALUE", numericValue: 2 }] })).rejects.toMatchObject({ status: 401 });
});
it("P3B-INT-10 MySQL rejects catalog links that do not match the session instrument", async () => {
  const question = await db().questionVersion.findFirstOrThrow({ where: { code: "COL_E01_R001" } });
  await expect(db().surveyResponse.create({ data: { responseSessionId: espSessionId, itemKey: "COL_E01_R001", itemType: "LIKERT", answerState: "VALUE", numericValue: 3, instrumentVersionId: question.instrumentVersionId, questionVersionId: question.id } })).rejects.toThrow();
  await expect(db().surveyResponse.create({ data: { responseSessionId, itemKey: "COL_E01_R002", itemType: "LIKERT", answerState: "VALUE", numericValue: 3, instrumentVersionId: question.instrumentVersionId } })).rejects.toThrow();
  await expect(db().$executeRaw`UPDATE QuestionVersion SET orientation = NULL WHERE id = ${question.id}`).rejects.toThrow();
});
