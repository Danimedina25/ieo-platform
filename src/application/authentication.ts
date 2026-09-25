import "server-only";
import { loginSchema, isSessionValid, type AuthenticatedUser } from "@/domain/auth";
import { db } from "@/infrastructure/persistence/db";
import { digestSessionToken as hashToken, generateSessionToken as generateToken, isSessionToken as isValidToken } from "@/infrastructure/auth/tokens";
import { verifyPassword, getDummyPasswordHash as dummyPasswordHash } from "@/infrastructure/auth/password";
import { LoginLimiter } from "@/infrastructure/auth/login-limiter";
import { authConfig } from "@/lib/config";

const globalAuth = globalThis as unknown as { ieoLoginLimiter?: LoginLimiter };
const publicUser = (user: AuthenticatedUser): AuthenticatedUser => ({
  id: user.id, email: user.email, name: user.name, technicalAdmin: user.technicalAdmin,
});
export async function login(input: unknown, now = new Date()) {
  const config = authConfig();
  globalAuth.ieoLoginLimiter ??= new LoginLimiter(config.secret);
  const parsed = loginSchema.safeParse(input);
  const email = parsed.success ? parsed.data.email : "invalid-input";
  if (!globalAuth.ieoLoginLimiter.allow(email, now.getTime())) return { ok: false as const, limited: true };
  const user = parsed.success ? await db().user.findUnique({ where: { email } }) : null;
  const valid = await verifyPassword(user?.passwordHash ?? await dummyPasswordHash(), parsed.success ? parsed.data.password : "");
  if (!valid || !user || user.status !== "ACTIVE") {
    await db().auditLog.create({ data: { action: "LOGIN_FAILED", entityType: "Authentication" } });
    return { ok: false as const, limited: false };
  }
  const token = generateToken();
  const expiresAt = new Date(now.getTime() + config.ttlHours * 3_600_000);
  const result = await db().$transaction(async (tx) => {
    const active = await tx.user.findFirst({ where: { id: user.id, status: "ACTIVE", passwordHash: user.passwordHash } });
    if (!active) return false;
    await tx.adminSession.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt, lastSeenAt: now } });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: "ADMIN_LOGIN", entityType: "User", entityId: user.id } });
    return true;
  });
  return result ? { ok: true as const, token, expiresAt } : { ok: false as const, limited: false };
}
export async function authenticateSession(token: string | undefined, now = new Date()): Promise<AuthenticatedUser | null> {
  if (!token || !isValidToken(token)) return null;
  const session = await db().adminSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.revokedAt) return null;
  if (session.user.status !== "ACTIVE") {
    await db().$transaction(async (tx) => {
      const revoked = await tx.adminSession.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: now } });
      if (revoked.count) await tx.auditLog.create({ data: { action: "USER_DISABLED_SESSION_REJECTED", actorUserId: session.userId, entityType: "User", entityId: session.userId } });
    });
    return null;
  }
  const idleMinutes = authConfig().idleMinutes;
  if (!isSessionValid(session, now, idleMinutes)) {
    await db().adminSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
    return null;
  }
  const touched = await db().adminSession.updateMany({
    where: { id: session.id, revokedAt: null, expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - idleMinutes * 60_000) }, user: { status: "ACTIVE" } },
    data: { lastSeenAt: now },
  });
  return touched.count === 1 ? publicUser(session.user) : null;
}
export async function logout(token: string | undefined, now = new Date()) {
  if (!token || !isValidToken(token)) return;
  await db().$transaction(async (tx) => {
    const session = await tx.adminSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session) return;
    const result = await tx.adminSession.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
    if (result.count) await tx.auditLog.create({ data: { action: "ADMIN_LOGOUT", actorUserId: session.userId, entityType: "User", entityId: session.userId } });
  });
}
