import { afterAll, beforeAll, expect, it } from "vitest";
import { db } from "@/infrastructure/persistence/db";
import { seedDemo, demoIds, seedEnvironment } from "../../prisma/seed-data";
import { login, logout, authenticateSession } from "@/application/authentication";
import { listAssessmentMetadata, readAssessmentMetadata } from "@/application/assessments";
import { requireOrganizationAccess, requireOrganizationRole, requireTechnicalAdmin } from "@/application/authorization";
import { digestSessionToken, generateSessionToken } from "@/infrastructure/auth/tokens";
const tokens: Record<string, string> = {};
beforeAll(async () => {
  await seedDemo(db());
  const env = seedEnvironment();
  for (const [key, email, password] of [["consultant", "consultor@ieo.local", env.SEED_USER_PASSWORD], ["coordinator", "coordinador@ieo.local", env.SEED_USER_PASSWORD], ["other", "consultor2@ieo.local", env.SEED_USER_PASSWORD], ["admin", env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD]]) {
    const result = await login({ email, password });
    if (!result.ok) throw new Error("No se pudo autenticar fixture.");
    tokens[key] = result.token;
  }
});
afterAll(async () => { await db().user.updateMany({ where: { email: "consultor2@ieo.local" }, data: { status: "ACTIVE" } }); await db().$disconnect(); });
it("consultor A lista/lee A, nunca B; proyección no incluye credenciales", async () => {
  const list = await listAssessmentMetadata(tokens.consultant);
  expect(list.map(x => x.id)).toEqual([demoIds.assessmentA]);
  expect(await readAssessmentMetadata(tokens.consultant, demoIds.assessmentA)).not.toBeNull();
  expect(await readAssessmentMetadata(tokens.consultant, demoIds.assessmentB)).toBeNull();
  expect(await readAssessmentMetadata(tokens.consultant, "unknown")).toBeNull();
  expect(Object.keys(list[0]).sort()).toEqual(["id", "name", "organization", "period", "status"]);
  await expect(requireOrganizationRole(tokens.consultant, demoIds.organizationA, "IEO_CONSULTANT")).resolves.toBeDefined();
  await expect(requireOrganizationAccess(tokens.consultant, demoIds.organizationB)).rejects.toThrow();
});
it("coordinador A puede leer metadata de A pero no B ni asumir rol consultor", async () => {
  expect((await listAssessmentMetadata(tokens.coordinator)).map(x => x.id)).toEqual([demoIds.assessmentA]);
  expect(await readAssessmentMetadata(tokens.coordinator, demoIds.assessmentA)).not.toBeNull();
  expect(await readAssessmentMetadata(tokens.coordinator, demoIds.assessmentB)).toBeNull();
  await expect(requireOrganizationRole(tokens.coordinator, demoIds.organizationA, "IEO_CONSULTANT")).rejects.toThrow();
});
it("admin puede leer metadata técnica pero no tiene membresía implícita", async () => {
  await expect(requireTechnicalAdmin(tokens.admin)).resolves.toBeDefined();
  await expect(requireTechnicalAdmin(tokens.consultant)).rejects.toThrow();
  expect(await listAssessmentMetadata(tokens.admin)).toHaveLength(2);
  await expect(requireOrganizationAccess(tokens.admin, demoIds.organizationA)).rejects.toThrow();
});
it("revocar membresía u organización afecta consultas inmediatamente", async () => {
  const user = await db().user.findUniqueOrThrow({ where: { email: "coordinador@ieo.local" } });
  try {
    await db().organizationMembership.updateMany({ where: { userId: user.id }, data: { active: false } });
    expect(await listAssessmentMetadata(tokens.coordinator)).toEqual([]);
    await db().organizationMembership.updateMany({ where: { userId: user.id }, data: { active: true } });
    await db().organization.update({ where: { id: demoIds.organizationA }, data: { status: "INACTIVE" } });
    expect(await readAssessmentMetadata(tokens.consultant, demoIds.assessmentA)).toBeNull();
  } finally {
    await db().organizationMembership.updateMany({ where: { userId: user.id }, data: { active: true } });
    await db().organization.update({ where: { id: demoIds.organizationA }, data: { status: "ACTIVE" } });
  }
});
it("usuario deshabilitado pierde acceso con cookie anterior y no puede iniciar sesión", async () => {
  await db().user.update({ where: { email: "consultor2@ieo.local" }, data: { status: "DISABLED" } });
  expect(await authenticateSession(tokens.other)).toBeNull();
  await expect(listAssessmentMetadata(tokens.other)).rejects.toThrow();
  expect((await login({ email: "consultor2@ieo.local", password: seedEnvironment().SEED_USER_PASSWORD })).ok).toBe(false);
  expect(await db().auditLog.count({ where: { action: "USER_DISABLED_SESSION_REJECTED" } })).toBeGreaterThan(0);
});
it("expiración absoluta e inactividad se comprueban en MySQL y revocan bearer", async () => {
  const user = await db().user.findUniqueOrThrow({ where: { email: "consultor@ieo.local" } });
  const now = new Date();
  for (const dates of [{ expiresAt: now, lastSeenAt: now }, { expiresAt: new Date(now.getTime() + 3_600_000), lastSeenAt: new Date(now.getTime() - 1_800_000) }]) {
    const token = generateSessionToken();
    await db().adminSession.create({ data: { userId: user.id, tokenHash: digestSessionToken(token), ...dates } });
    expect(await authenticateSession(token, now)).toBeNull();
    const session = await db().adminSession.findUniqueOrThrow({ where: { tokenHash: digestSessionToken(token) } });
    expect(session.revokedAt).not.toBeNull();
  }
});
it("logout revoca; replay falla; DB contiene digest y auditoría sin secretos", async () => {
  const token = tokens.consultant;
  const stored = await db().adminSession.findUniqueOrThrow({ where: { tokenHash: digestSessionToken(token) } });
  expect(stored.tokenHash).not.toBe(token);
  await logout(token); await logout(token);
  expect(await authenticateSession(token)).toBeNull();
  await expect(listAssessmentMetadata(token)).rejects.toThrow();
  const logs = JSON.stringify(await db().auditLog.findMany());
  expect(logs).not.toContain(token); expect(logs).not.toContain(seedEnvironment().SEED_USER_PASSWORD);
});
it("FK compuesta impide asociar auditoría a diagnóstico de otra organización", async () => {
  await expect(db().auditLog.create({ data: { organizationId: demoIds.organizationA, assessmentId: demoIds.assessmentB, action: "ADMIN_LOGIN", entityType: "Assessment" } })).rejects.toThrow();
});
it("tablas de aplicación usan InnoDB y utf8mb4 en MySQL 8", async () => {
  const version = await db().$queryRaw<Array<{ version: string }>>`SELECT VERSION() AS version`;
  expect(version[0].version).toMatch(/^8\./);
  const tables = await db().$queryRaw<Array<{ ENGINE: string; TABLE_COLLATION: string }>>`SELECT ENGINE, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME <> '_prisma_migrations'`;
  expect(tables).toHaveLength(18);
  for (const table of tables) { expect(table.ENGINE).toBe("InnoDB"); expect(table.TABLE_COLLATION).toMatch(/^utf8mb4_/); }
});
