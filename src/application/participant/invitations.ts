import "server-only";
import { z } from "zod";
import { db } from "@/infrastructure/persistence/db";
import { requireAuthenticatedUser, AccessDeniedError } from "@/application/authorization";
import { emailProvider } from "@/infrastructure/mail/provider";
import { decryptEmail, emailLookupHmac, encryptEmail, hashBearer, randomBearer } from "@/infrastructure/participant/crypto";
import { authConfig } from "@/lib/config";
import { normalizeEmail } from "@/domain/auth";

const createSchema = z.object({ email: z.email().max(254), perspectiveCode: z.enum(["DIR", "ESP", "LID", "COL", "CLI"]), expiresAt: z.iso.datetime({ offset: true }) }).strict();
// Invitations are listed in any state, but created, reissued or cancelled only while DRAFT or OPEN.
async function consultant(userId: string, assessmentId: string, writable = true) {
  if (!z.uuid().safeParse(assessmentId).success) throw new AccessDeniedError();
  const assessment = await db().assessment.findFirst({ where: { id: assessmentId, ...(writable ? { status: { in: ["DRAFT", "OPEN"] } } : {}), organization: { status: "ACTIVE", memberships: { some: { userId, role: "IEO_CONSULTANT", active: true } } } }, select: { id: true, organizationId: true, status: true } });
  if (!assessment) throw new AccessDeniedError();
  return assessment;
}
export async function listInvitations(adminToken: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(adminToken);
  await consultant(user.id, assessmentId, false);
  const rows = await db().invitation.findMany({ where: { assessmentId, isTest: true }, select: { id: true, emailCiphertext: true, status: true, sentAt: true, verifiedAt: true, completedAt: true, expiresAt: true, perspective: { select: { perspectiveCode: true } } }, orderBy: { createdAt: "desc" } });
  return rows.map(row => ({ id: row.id, email: decryptEmail(row.emailCiphertext), perspectiveCode: row.perspective.perspectiveCode, status: row.status, sentAt: row.sentAt?.toISOString() ?? null, verifiedAt: row.verifiedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null, expiresAt: row.expiresAt.toISOString() }));
}
async function deliver(invitationId: string, email: string, token: string) {
  await emailProvider().sendMagicLink(email, `${authConfig().origin}/r/${token}`);
  await db().invitation.updateMany({ where: { id: invitationId, tokenHash: hashBearer(token), status: "CREATED" }, data: { status: "SENT", sentAt: new Date() } });
}
export async function createInvitation(adminToken: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(adminToken);
  const data = createSchema.parse(input);
  const assessment = await consultant(user.id, assessmentId);
  const expiresAt = new Date(data.expiresAt);
  if (expiresAt.getTime() < Date.now() + 5 * 60_000 || expiresAt.getTime() > Date.now() + 90 * 86400_000) throw new z.ZodError([{ code: "custom", path: ["expiresAt"], message: "Vigencia inválida." }]);
  const perspective = await db().assessmentPerspective.findUnique({ where: { assessmentId_perspectiveCode: { assessmentId, perspectiveCode: data.perspectiveCode } } });
  if (!perspective) throw new AccessDeniedError();
  const email = normalizeEmail(data.email);
  const allowlisted = (process.env.TECHNICAL_INVITE_ALLOWED_EMAILS ?? "").split(",").map(value => normalizeEmail(value.trim())).filter(Boolean);
  if (!email.endsWith(".test") && !email.endsWith("@ieo.local") && !allowlisted.includes(email)) throw new z.ZodError([{ code: "custom", path: ["email"], message: "Sólo correo sintético o del equipo autorizado." }]);
  const token = randomBearer();
  const invitation = await db().$transaction(async tx => {
    const row = await tx.invitation.create({ data: { assessmentId, assessmentPerspectiveId: perspective.id, emailCiphertext: encryptEmail(email), emailLookupHmac: emailLookupHmac(email), tokenHash: hashBearer(token), expiresAt, createdById: user.id, isTest: true } });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "TEST_INVITATION_CREATED", entityType: "Invitation", entityId: row.id, metadataJson: { perspectiveCode: data.perspectiveCode, isTest: true } } });
    return row;
  });
  // In DRAFT the invitation waits as CREATED; opening the assessment sends it with a fresh token.
  if (assessment.status !== "OPEN") return { id: invitation.id, status: "CREATED" };
  await deliver(invitation.id, email, token);
  return { id: invitation.id, status: "SENT" };
}
export async function mutateInvitation(adminToken: string | undefined, assessmentId: string, invitationId: string, action: "reissue" | "cancel") {
  const user = await requireAuthenticatedUser(adminToken);
  const assessment = await consultant(user.id, assessmentId);
  if (!z.uuid().safeParse(invitationId).success) throw new AccessDeniedError();
  const token = action === "reissue" ? randomBearer() : null;
  const row = await db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Invitation WHERE id = ${invitationId} FOR UPDATE`;
    const current = await tx.invitation.findFirst({ where: { id: invitationId, assessmentId, isTest: true } });
    if (!current || current.status === "CANCELLED" || current.status === "COMPLETED") throw new AccessDeniedError();
    if (action === "reissue" && current.expiresAt <= new Date()) throw new AccessDeniedError();
    await tx.accessChallenge.updateMany({ where: { invitationId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    const binding = await tx.participantAccessBinding.findUnique({ where: { invitationId } });
    if (binding) {
      await tx.participantAuthSession.updateMany({ where: { accessBindingId: binding.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (action === "cancel") await tx.participantAccessBinding.update({ where: { id: binding.id }, data: { revokedAt: new Date() } });
    }
    const updated = await tx.invitation.update({ where: { id: invitationId }, data: action === "reissue" ? { tokenHash: hashBearer(token!), tokenGeneration: { increment: 1 }, status: "CREATED", sentAt: null } : { status: "CANCELLED", cancelledAt: new Date() } });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: action === "reissue" ? "TEST_INVITATION_REISSUED" : "TEST_INVITATION_CANCELLED", entityType: "Invitation", entityId: invitationId, metadataJson: { isTest: true } } });
    return updated;
  });
  if (action === "cancel") return { id: invitationId, status: "CANCELLED" };
  if (assessment.status !== "OPEN") return { id: invitationId, status: "CREATED" };
  await deliver(invitationId, decryptEmail(row.emailCiphertext), token!);
  return { id: invitationId, status: "SENT" };
}
/** Sends every pending (CREATED, unexpired) invitation of an assessment that has just been opened, rotating its token. */
export async function sendPendingInvitations(assessmentId: string) {
  const pending = await db().invitation.findMany({ where: { assessmentId, status: "CREATED", isTest: true, expiresAt: { gt: new Date() } }, select: { id: true, emailCiphertext: true } });
  let sent = 0;
  for (const invitation of pending) {
    const token = randomBearer();
    const updated = await db().invitation.updateMany({ where: { id: invitation.id, status: "CREATED" }, data: { tokenHash: hashBearer(token), tokenGeneration: { increment: 1 } } });
    if (!updated.count) continue;
    try { await deliver(invitation.id, decryptEmail(invitation.emailCiphertext), token); sent++; }
    catch { console.error("PENDING_INVITATION_DELIVERY_FAILED_INTERNAL"); }
  }
  return { sent, pending: pending.length };
}
