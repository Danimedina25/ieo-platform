import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { loginSchema, normalizeEmail, hasOrganizationAccess, hasOrganizationRole, isTechnicalAdmin, isSessionValid, type Membership } from "@/domain/auth";
import { hashPassword, verifyPassword } from "@/infrastructure/auth/password";
import { generateSessionToken, digestSessionToken, isSessionToken } from "@/infrastructure/auth/tokens";
import { LoginLimiter } from "@/infrastructure/auth/login-limiter";

describe("Credenciales y sesiones", () => {
  it("normaliza correo y rechaza campos inesperados", () => {
    expect(normalizeEmail("  ADMIN@IEO.LOCAL ")).toBe("admin@ieo.local");
    expect(loginSchema.parse({ email: "  ADMIN@IEO.LOCAL ", password: "x" }).email).toBe("admin@ieo.local");
    expect(loginSchema.safeParse({ email: "a@ieo.local", password: "x", technicalAdmin: true }).success).toBe(false);
  });
  it("Argon2id usa salts distintos y verifica sin aceptar claves erróneas", async () => {
    const password = randomBytes(24).toString("base64url");
    const first = await hashPassword(password); const second = await hashPassword(password);
    expect(first).toMatch(/^\$argon2id\$/); expect(first).not.toBe(second);
    expect(await verifyPassword(first, password)).toBe(true);
    expect(await verifyPassword(first, randomBytes(24).toString("base64url"))).toBe(false);
    expect(await verifyPassword("invalid", password)).toBe(false);
    await expect(hashPassword("short")).rejects.toThrow();
  });
  it("genera bearer de 32 bytes, valida formato y persiste digest no reversible", () => {
    const token = generateSessionToken();
    expect(Buffer.from(token, "base64url").length).toBe(32);
    expect(isSessionToken(token)).toBe(true); expect(isSessionToken("bad")).toBe(false);
    expect(generateSessionToken()).not.toBe(token);
    expect(digestSessionToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(digestSessionToken(token)).not.toBe(token);
  });
  it("expira exactamente en límites absoluto/inactividad y acepta actividad previa", () => {
    const now = new Date("2026-09-25T12:00:00Z");
    const session = { revokedAt: null, lastSeenAt: new Date(now.getTime() - 60_000), expiresAt: new Date(now.getTime() + 60_000) };
    expect(isSessionValid(session, now, 30)).toBe(true);
    expect(isSessionValid({ ...session, expiresAt: now }, now, 30)).toBe(false);
    expect(isSessionValid({ ...session, lastSeenAt: new Date(now.getTime() - 1_800_000) }, now, 30)).toBe(false);
    expect(isSessionValid({ ...session, revokedAt: now }, now, 30)).toBe(false);
  });
  it("limita intentos por correo y globalmente y libera al terminar la ventana", () => {
    const limiter = new LoginLimiter("unit-only-key");
    for (let i = 0; i < 10; i++) expect(limiter.allow("a@ieo.local", 0)).toBe(true);
    expect(limiter.allow("a@ieo.local", 0)).toBe(false);
    expect(limiter.allow("a@ieo.local", 900_001)).toBe(true);
    const global = new LoginLimiter("unit-only-key");
    for (let i = 0; i < 60; i++) expect(global.allow(`${i}@ieo.local`, 0)).toBe(true);
    expect(global.allow("extra@ieo.local", 0)).toBe(false);
  });
});
describe("Autorización de dominio", () => {
  const memberships: Membership[] = [{ organizationId: "A", role: "ORG_COORDINATOR", active: true, organization: { status: "ACTIVE" } }];
  it("aisla organizaciones y distingue roles sin jerarquía implícita", () => {
    expect(hasOrganizationAccess(memberships, "A")).toBe(true);
    expect(hasOrganizationAccess(memberships, "B")).toBe(false);
    expect(hasOrganizationRole(memberships, "A", "IEO_CONSULTANT")).toBe(false);
    expect(hasOrganizationRole(memberships, "A", "ORG_COORDINATOR")).toBe(true);
    expect(isTechnicalAdmin({ id: "tech", email: "tech@ieo.local", name: null, technicalAdmin: true })).toBe(true);
    expect(hasOrganizationAccess([], "A")).toBe(false);
  });
  it("rechaza membresía u organización inactivas", () => {
    expect(hasOrganizationAccess([{ ...memberships[0], active: false }], "A")).toBe(false);
    expect(hasOrganizationAccess([{ ...memberships[0], organization: { status: "INACTIVE" } }], "A")).toBe(false);
  });
});
