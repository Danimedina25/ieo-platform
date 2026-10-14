import { beforeAll, afterAll, expect, it } from "vitest";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/infrastructure/persistence/db";
import { login } from "@/application/authentication";
import { createInvitation, listInvitations, mutateInvitation } from "@/application/participant/invitations";
import { landing, startAccess, verifyOtp, authParticipant } from "@/application/participant/access";
import { acceptIntro, readSurvey, saveSurvey, submitSurvey } from "@/application/participant/survey";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
const mailbox = join(tmpdir(), `ieo-int-mail-${process.pid}-${randomUUID()}.jsonl`);
const prior = { provider: process.env.EMAIL_PROVIDER, mode: process.env.E2E_MODE, path: process.env.E2E_MAILBOX_PATH };
let admin = "", invitationId = "", link = "", context = "", bearer = "", revision = 0, secondaryId = "", secondaryLink = "";
const extraIds: string[] = [];
const tag = randomUUID().slice(0, 8);
function mail(kind: "link" | "otp") { const rows = readFileSync(mailbox, "utf8").trim().split("\n").map(line => JSON.parse(line) as { kind: string; value: string }); return rows.filter(row => row.kind === kind).at(-1)!.value; }
beforeAll(async () => {
  process.env.EMAIL_PROVIDER = "file"; process.env.E2E_MODE = "true"; process.env.E2E_MAILBOX_PATH = mailbox;
  writeFileSync(mailbox, "", { mode: 0o600 });
  const seed = seedEnvironment(); const result = await login({ email: "consultor@ieo.local", password: seed.SEED_USER_PASSWORD });
  if (!result.ok) throw new Error("Login fixture inválido"); admin = result.token;
});
afterAll(async () => {
  const ids = [invitationId, secondaryId, ...extraIds].filter(Boolean);
  for (const id of ids) {
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
it("P3A-INT-01 consultant can create a test invitation", async () => { const row = await createInvitation(admin, demoIds.assessmentA, { email: `participant-${tag}@example.test`, perspectiveCode: "ESP", expiresAt: new Date(Date.now() + 86400_000).toISOString() }); invitationId = row.id; expect(row.status).toBe("SENT"); link = mail("link"); expect(link).toMatch(/\/r\/[A-Za-z0-9_-]{43}$/); });
it("P3A-INT-02 no participant User is created", async () => { expect(await db().user.count({ where: { email: `participant-${tag}@example.test` } })).toBe(0); });
it("P3A-INT-03 response tables contain no identity at creation", async () => { expect(await db().responseSession.count({ where: { assessmentId: demoIds.assessmentA } })).toBe(0); expect(await db().surveyResponse.count()).toBe(0); });
it("P3A-INT-04 consultant sees email, coordinator cannot list", async () => { expect((await listInvitations(admin, demoIds.assessmentA)).find(row => row.id === invitationId)?.email).toContain(tag); const result = await login({ email: "coordinador@ieo.local", password: seedEnvironment().SEED_USER_PASSWORD }); if (!result.ok) throw new Error(); await expect(listInvitations(result.token, demoIds.assessmentA)).rejects.toThrow(); });
it("P3A-INT-05 GET landing is read-only", async () => { await landing(link.split("/").at(-1)!); expect(await db().accessChallenge.count({ where: { invitationId } })).toBe(0); expect(await db().responseSession.count({ where: { assessmentId: demoIds.assessmentA } })).toBe(0); });
it("P3A-INT-06 bad magic token rejected", async () => { await expect(landing("x".repeat(43))).rejects.toThrow(); });
it("P3A-INT-07 explicit start creates only challenge", async () => { const result = await startAccess(link.split("/").at(-1)!); context = result.bearer; expect(mail("otp")).toMatch(/^\d{6}$/); expect(await db().accessChallenge.count({ where: { invitationId } })).toBe(1); expect(await db().responseSession.count({ where: { assessmentId: demoIds.assessmentA } })).toBe(0); });
it("P3A-INT-08 resend cooldown is enforced", async () => { await expect(startAccess(link.split("/").at(-1)!)).rejects.toMatchObject({ status: 429 }); });
it("P3A-INT-09 wrong OTP increments attempts", async () => { const wrong = mail("otp") === "000000" ? "000001" : "000000"; await expect(verifyOtp(context, wrong)).rejects.toMatchObject({ status: 401 }); expect((await db().accessChallenge.findFirstOrThrow({ where: { invitationId } })).attempts).toBe(1); });
it("P3A-INT-10 valid OTP creates a single response and binding", async () => { const result = await verifyOtp(context, mail("otp")); bearer = result.bearer; expect(await db().participantAccessBinding.count({ where: { invitationId } })).toBe(1); expect(await db().responseSession.count({ where: { assessmentId: demoIds.assessmentA } })).toBe(1); });
it("P3A-INT-11 consumed OTP cannot replay", async () => { await expect(verifyOtp(context, mail("otp"))).rejects.toMatchObject({ status: 401 }); });
it("P3A-INT-12 intro gates survey", async () => { await expect(readSurvey(bearer)).rejects.toMatchObject({ status: 403 }); await acceptIntro(bearer); expect((await readSurvey(bearer)).submitted).toBe(false); });
it("P3A-INT-13 unknown item rejected", async () => { await expect(saveSurvey(bearer, { expectedRevision: 0, answers: [{ itemKey: "COL_OFFICIAL", answerState: "VALUE", numericValue: 5 }] })).rejects.toThrow(); });
it("P3A-INT-14 N/A forbidden on Q1", async () => { await expect(saveSurvey(bearer, { expectedRevision: 0, answers: [{ itemKey: "TECH_Q1", answerState: "NA" }] })).rejects.toThrow(); });
it("P3A-INT-15 valid Likert and text persist encrypted", async () => { const result = await saveSurvey(bearer, { expectedRevision: 0, answers: [{ itemKey: "TECH_Q1", answerState: "VALUE", numericValue: 4 }, { itemKey: "TECH_O1", answerState: "VALUE", textValue: "comentario ficticio secreto" }] }); revision = result.revision; const row = await db().surveyResponse.findFirstOrThrow({ where: { itemKey: "TECH_O1" } }); expect(row.textCiphertext).not.toContain("comentario ficticio"); expect((await readSurvey(bearer)).answers?.find(row => row.itemKey === "TECH_O1")?.textValue).toBe("comentario ficticio secreto"); });
it("P3A-INT-16 optimistic revision rejects stale writes", async () => { await expect(saveSurvey(bearer, { expectedRevision: 0, answers: [{ itemKey: "TECH_Q1", answerState: "VALUE", numericValue: 3 }] })).rejects.toMatchObject({ status: 409 }); });
it("P3A-INT-17 allowed N/A remains distinct", async () => { const result = await saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: "TECH_Q3", answerState: "NA" }] }); revision = result.revision; expect((await readSurvey(bearer)).answers?.find(row => row.itemKey === "TECH_Q3")?.answerState).toBe("NA"); });
it("P3A-INT-18 required Q4 blocks submission", async () => { await expect(submitSurvey(bearer, { expectedRevision: revision })).rejects.toMatchObject({ status: 422 }); });
it("P3A-INT-19 submit is permanent and idempotent", async () => { revision = (await saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: "TECH_Q4", answerState: "VALUE", numericValue: 2 }] })).revision; expect(await submitSurvey(bearer, { expectedRevision: revision })).toEqual({ submitted: true }); expect(await submitSurvey(bearer, { expectedRevision: revision })).toEqual({ submitted: true }); expect((await readSurvey(bearer)).submitted).toBe(true); });
it("P3A-INT-20 no write after submit", async () => { await expect(saveSurvey(bearer, { expectedRevision: revision, answers: [{ itemKey: "TECH_Q1", answerState: "VALUE", numericValue: 1 }] })).rejects.toMatchObject({ status: 401 }); });
it("P3A-INT-21 reissue rotates old token", async () => { const row = await createInvitation(admin, demoIds.assessmentA, { email: `secondary-${tag}@example.test`, perspectiveCode: "ESP", expiresAt: new Date(Date.now() + 86400_000).toISOString() }); secondaryId = row.id; secondaryLink = mail("link"); await mutateInvitation(admin, demoIds.assessmentA, secondaryId, "reissue"); await expect(landing(secondaryLink.split("/").at(-1)!)).rejects.toThrow(); secondaryLink = mail("link"); await landing(secondaryLink.split("/").at(-1)!); });
it("P3A-INT-22 cancellation revokes new token", async () => { await mutateInvitation(admin, demoIds.assessmentA, secondaryId, "cancel"); await expect(landing(secondaryLink.split("/").at(-1)!)).rejects.toThrow(); });

it("P3A-INT-23 five failed OTP attempts lock challenge", async () => { const row = await createInvitation(admin, demoIds.assessmentA, { email: `lockout-${tag}@example.test`, perspectiveCode: "DIR", expiresAt: new Date(Date.now() + 86400_000).toISOString() }); extraIds.push(row.id); const token = mail("link").split("/").at(-1)!; const access = await startAccess(token); const valid = mail("otp"); const wrong = valid === "000000" ? "000001" : "000000"; for (let i = 0; i < 5; i++) await expect(verifyOtp(access.bearer, wrong)).rejects.toMatchObject({ status: 401 }); await expect(verifyOtp(access.bearer, valid)).rejects.toMatchObject({ status: 401 }); expect((await db().accessChallenge.findFirstOrThrow({ where: { invitationId: row.id } })).attempts).toBe(5); });
it("P3A-INT-24 repeat verification resumes exactly same response", async () => { await db().accessChallenge.updateMany({ where: { invitationId }, data: { createdAt: new Date(Date.now() - 61_000) } }); const access = await startAccess(link.split("/").at(-1)!); const result = await verifyOtp(access.bearer, mail("otp")); expect(result.submitted).toBe(true); const binding = await db().participantAccessBinding.findUniqueOrThrow({ where: { invitationId } }); expect(binding.responseSessionId).toBe((await db().participantAccessBinding.findUniqueOrThrow({ where: { invitationId } })).responseSessionId); expect(await db().participantAccessBinding.count({ where: { invitationId } })).toBe(1); });
it("P3A-INT-25 database rejects isTest=false", async () => { const perspective = await db().assessmentPerspective.findUniqueOrThrow({ where: { assessmentId_perspectiveCode: { assessmentId: demoIds.assessmentA, perspectiveCode: "DIR" } } }); const actor = await db().user.findUniqueOrThrow({ where: { email: "consultor@ieo.local" } }); await expect(db().invitation.create({ data: { assessmentId: demoIds.assessmentA, assessmentPerspectiveId: perspective.id, emailCiphertext: "cipher", emailLookupHmac: "a".repeat(64), tokenHash: "b".repeat(64), expiresAt: new Date(Date.now() + 86400_000), createdById: actor.id, isTest: false } })).rejects.toThrow(); await expect(db().responseSession.create({ data: { assessmentId: demoIds.assessmentA, assessmentPerspectiveId: perspective.id, surveyCode: "TECH-SURVEY-01", surveyVersion: 1, isTest: false } })).rejects.toThrow(); });
it("P3A-INT-26 composite FK rejects cross-assessment perspective", async () => { const perspective = await db().assessmentPerspective.findUniqueOrThrow({ where: { assessmentId_perspectiveCode: { assessmentId: demoIds.assessmentA, perspectiveCode: "DIR" } } }); const actor = await db().user.findUniqueOrThrow({ where: { email: "consultor@ieo.local" } }); await expect(db().invitation.create({ data: { assessmentId: demoIds.assessmentB, assessmentPerspectiveId: perspective.id, emailCiphertext: "cipher", emailLookupHmac: "c".repeat(64), tokenHash: "d".repeat(64), expiresAt: new Date(Date.now() + 86400_000), createdById: actor.id, isTest: true } })).rejects.toThrow(); });
it("P3A-INT-27 cancellation revokes active participant session", async () => { const row = await createInvitation(admin, demoIds.assessmentA, { email: `cancelactive-${tag}@example.test`, perspectiveCode: "CLI", expiresAt: new Date(Date.now() + 86400_000).toISOString() }); extraIds.push(row.id); const access = await startAccess(mail("link").split("/").at(-1)!); const verified = await verifyOtp(access.bearer, mail("otp")); await authParticipant(verified.bearer); await mutateInvitation(admin, demoIds.assessmentA, row.id, "cancel"); await expect(authParticipant(verified.bearer)).rejects.toMatchObject({ status: 401 }); });
it("P3A-INT-28 arbitrary real email is rejected without explicit allowlist", async () => { await expect(createInvitation(admin, demoIds.assessmentA, { email: `unknown-${tag}@public-example.com`, perspectiveCode: "ESP", expiresAt: new Date(Date.now() + 86400_000).toISOString() })).rejects.toThrow(); });
