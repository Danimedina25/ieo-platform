import "server-only";
import { db } from "@/infrastructure/persistence/db";
import { emailProvider } from "@/infrastructure/mail/provider";
import { decryptEmail, generateOtp, hashBearer, isBearer, matchesOtp, otpHmac, randomBearer } from "@/infrastructure/participant/crypto";
import { participantConfig } from "@/infrastructure/participant/config";
import { participantSessionExpiry, participantSessionUsable } from "@/domain/participant/session";
import type { Prisma } from "@/generated/prisma/client";
import { instrumentVersionForPerspective } from "./instruments";

export class ParticipantError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message = "Acceso no disponible."): never { throw new ParticipantError(status, message); }
const now = () => new Date();
async function lockInvitation(tx: Prisma.TransactionClient, id: string) { await tx.$queryRaw`SELECT id FROM Invitation WHERE id = ${id} FOR UPDATE`; }
function activeInvitation<T extends { status: string; isTest: boolean; expiresAt: Date; assessment: { status: string } }>(invitation: T | null): asserts invitation is T {
  if (!invitation || !invitation.isTest || !["SENT", "VERIFIED", "COMPLETED"].includes(invitation.status) || invitation.expiresAt <= now() || invitation.assessment.status !== "OPEN") fail(404);
}
export async function landing(token: string) {
  if (!isBearer(token)) fail(404);
  const row = await db().invitation.findUnique({ where: { tokenHash: hashBearer(token) }, select: { status: true, isTest: true, expiresAt: true, assessment: { select: { status: true, organizationId: true } } } });
  activeInvitation(row);
  return { available: true };
}
async function createChallenge(tx: Prisma.TransactionClient, invitation: { id: string; tokenGeneration: number; expiresAt: Date }, suppliedNow: Date) {
  const config = participantConfig();
  const last = await tx.accessChallenge.findFirst({ where: { invitationId: invitation.id }, orderBy: { createdAt: "desc" } });
  if (last && suppliedNow.getTime() - last.createdAt.getTime() < config.resendSeconds * 1000) fail(429, "Espera antes de solicitar otro código.");
  const sends = await tx.accessChallenge.count({ where: { invitationId: invitation.id, createdAt: { gte: new Date(suppliedNow.getTime() - 15 * 60_000) } } });
  if (sends >= config.maxSends) fail(429, "Límite temporal de códigos alcanzado.");
  await tx.accessChallenge.updateMany({ where: { invitationId: invitation.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: suppliedNow } });
  const bearer = randomBearer();
  const otp = generateOtp();
  const expiresAt = new Date(Math.min(invitation.expiresAt.getTime(), suppliedNow.getTime() + config.otpMinutes * 60_000));
  const challenge = await tx.accessChallenge.create({ data: { invitationId: invitation.id, tokenGeneration: invitation.tokenGeneration, contextHash: hashBearer(bearer), otpHmac: "0".repeat(64), expiresAt } });
  await tx.accessChallenge.update({ where: { id: challenge.id }, data: { otpHmac: otpHmac(challenge.id, invitation.id, invitation.tokenGeneration, otp) } });
  return { bearer, otp, expiresAt: new Date(Math.min(invitation.expiresAt.getTime(), suppliedNow.getTime() + 15 * 60_000)) };
}
export async function startAccess(token: string) {
  if (!isBearer(token)) fail(404);
  const result = await db().$transaction(async tx => {
    const invitation = await tx.invitation.findUnique({ where: { tokenHash: hashBearer(token) }, include: { assessment: { select: { status: true, organizationId: true } } } });
    if (!invitation) fail(404);
    await lockInvitation(tx, invitation.id);
    const fresh = await tx.invitation.findUnique({ where: { id: invitation.id }, include: { assessment: { select: { status: true, organizationId: true } } } });
    activeInvitation(fresh);
    return { ...await createChallenge(tx, fresh!, now()), invitationId: fresh!.id, email: decryptEmail(fresh!.emailCiphertext) };
  });
  try { await emailProvider().sendOtp(result.email, result.otp); }
  catch { await db().accessChallenge.updateMany({ where: { contextHash: hashBearer(result.bearer) }, data: { invalidatedAt: now() } }); fail(503, "No se pudo enviar el código."); }
  return { bearer: result.bearer, expiresAt: result.expiresAt };
}
export async function resendOtp(context: string | undefined) {
  if (!context || !isBearer(context)) fail(401);
  const result = await db().$transaction(async tx => {
    const challenge = await tx.accessChallenge.findUnique({ where: { contextHash: hashBearer(context) } });
    if (!challenge) fail(401);
    await lockInvitation(tx, challenge.invitationId);
    const fresh = await tx.accessChallenge.findUnique({ where: { id: challenge.id } });
    const invitation = await tx.invitation.findUnique({ where: { id: challenge.invitationId }, include: { assessment: { select: { status: true, organizationId: true } } } });
    activeInvitation(invitation);
    if (!fresh || fresh.invalidatedAt || fresh.consumedAt || fresh.createdAt.getTime() + 15 * 60_000 <= Date.now() || fresh.tokenGeneration !== invitation!.tokenGeneration) fail(401);
    return { ...await createChallenge(tx, invitation!, now()), email: decryptEmail(invitation!.emailCiphertext) };
  });
  try { await emailProvider().sendOtp(result.email, result.otp); }
  catch { await db().accessChallenge.updateMany({ where: { contextHash: hashBearer(result.bearer) }, data: { invalidatedAt: now() } }); fail(503, "No se pudo enviar el código."); }
  return { bearer: result.bearer, expiresAt: result.expiresAt };
}
export async function verifyOtp(context: string | undefined, otp: string) {
  if (!context || !isBearer(context) || !/^\d{6}$/.test(otp)) fail(401);
  const result = await db().$transaction(async tx => {
    const challenge = await tx.accessChallenge.findUnique({ where: { contextHash: hashBearer(context) } });
    if (!challenge) fail(401);
    await lockInvitation(tx, challenge.invitationId);
    await tx.$queryRaw`SELECT id FROM AccessChallenge WHERE id = ${challenge.id} FOR UPDATE`;
    const fresh = await tx.accessChallenge.findUnique({ where: { id: challenge.id } });
    const invitation = await tx.invitation.findUnique({ where: { id: challenge.invitationId }, include: { assessment: { select: { status: true, organizationId: true } } } });
    activeInvitation(invitation);
    if (!fresh || fresh.invalidatedAt || fresh.consumedAt || fresh.expiresAt <= now() || fresh.tokenGeneration !== invitation!.tokenGeneration || fresh.attempts >= participantConfig().maxAttempts) fail(401, "Código inválido o caducado.");
    if (!matchesOtp(fresh.otpHmac, fresh.id, fresh.invitationId, fresh.tokenGeneration, otp)) {
      await tx.accessChallenge.update({ where: { id: fresh.id }, data: { attempts: { increment: 1 } } });
      return { invalid: true as const };
    }
    await tx.accessChallenge.update({ where: { id: fresh.id }, data: { consumedAt: now() } });
    let binding = await tx.participantAccessBinding.findUnique({ where: { invitationId: invitation!.id }, include: { responseSession: true } });
    if (!binding) {
      const perspective = await tx.assessmentPerspective.findUniqueOrThrow({ where: { id: invitation!.assessmentPerspectiveId }, select: { perspectiveCode: true } });
      const survey = await instrumentVersionForPerspective(tx, invitation!.assessmentId, perspective.perspectiveCode);
      if (!survey) fail(503, "Cuestionario no disponible para este diagnóstico.");
      const response = await tx.responseSession.create({ data: { assessmentId: invitation!.assessmentId, assessmentPerspectiveId: invitation!.assessmentPerspectiveId, ...survey, isTest: true } });
      binding = await tx.participantAccessBinding.create({ data: { invitationId: invitation!.id, responseSessionId: response.id }, include: { responseSession: true } });
    }
    if (binding.revokedAt) fail(404);
    const bearer = randomBearer();
    const current = now();
    const expiresAt = participantSessionExpiry(invitation!.expiresAt, current, participantConfig().sessionHours);
    await tx.participantAuthSession.create({ data: { accessBindingId: binding.id, tokenHash: hashBearer(bearer), expiresAt, lastSeenAt: current } });
    await tx.invitation.update({ where: { id: invitation!.id }, data: { status: binding.responseSession.status === "SUBMITTED" ? "COMPLETED" : "VERIFIED", verifiedAt: current } });
    return { bearer, expiresAt, submitted: binding.responseSession.status === "SUBMITTED", introduced: !!binding.responseSession.introAcceptedAt };
  });
  if ("invalid" in result) fail(401, "Código inválido o caducado.");
  return result;
}
export async function authParticipant(bearer: string | undefined) {
  if (!bearer || !isBearer(bearer)) fail(401);
  const session = await db().participantAuthSession.findUnique({ where: { tokenHash: hashBearer(bearer) }, include: { binding: { include: { invitation: { include: { assessment: { select: { status: true, organizationId: true } } } }, responseSession: true } } } });
  const current = now();
  if (!session || !participantSessionUsable(session, current, participantConfig().idleMinutes) || session.binding.revokedAt) fail(401);
  activeInvitation(session.binding.invitation);
  await db().participantAuthSession.updateMany({ where: { id: session.id, revokedAt: null, expiresAt: { gt: current } }, data: { lastSeenAt: current } });
  return session;
}
export async function logoutParticipant(bearer: string | undefined) {
  if (bearer && isBearer(bearer)) await db().participantAuthSession.updateMany({ where: { tokenHash: hashBearer(bearer), revokedAt: null }, data: { revokedAt: now() } });
  return { ok: true };
}
