import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/infrastructure/auth/password";
import { perspectiveCodes } from "../src/domain/assessment/schemas";
import { normalizeEmail } from "../src/domain/auth";
export const demoIds = {
  organizationA: "a1000000-0000-4000-8000-000000000001",
  organizationB: "b1000000-0000-4000-8000-000000000002",
  assessmentA: "a2000000-0000-4000-8000-000000000001",
  assessmentB: "b2000000-0000-4000-8000-000000000002",
  /** Organization A, five applicable perspectives, OPEN: used to answer questionnaires in tests. */
  assessmentOpenA: "a3000000-0000-4000-8000-000000000003",
};
export function seedEnvironment() {
  const result = z.object({
    SEED_ADMIN_EMAIL: z.string().transform(normalizeEmail).pipe(z.email()),
    SEED_ADMIN_PASSWORD: z.string().min(12).max(128),
    SEED_USER_PASSWORD: z.string().min(12).max(128),
  }).safeParse(process.env);
  if (!result.success) throw new Error("Seed requiere SEED_ADMIN_EMAIL válido y SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD de 12 a 128 caracteres. No se generan contraseñas.");
  if (["consultor@ieo.local", "coordinador@ieo.local", "consultor2@ieo.local", "custodio@ieo.local"].includes(result.data.SEED_ADMIN_EMAIL)) throw new Error("SEED_ADMIN_EMAIL debe ser distinto de los usuarios demo.");
  return result.data;
}
export async function seedDemo(client: PrismaClient) {
  const env = seedEnvironment();
  const [adminHash, userHash] = await Promise.all([hashPassword(env.SEED_ADMIN_PASSWORD), hashPassword(env.SEED_USER_PASSWORD)]);
  await client.$transaction(async (tx) => {
    for (const [id, name] of [[demoIds.organizationA, "Organización Demo A"], [demoIds.organizationB, "Organización Demo B"]]) {
      await tx.organization.upsert({ where: { id }, create: { id, name }, update: { name, status: "ACTIVE" } });
    }
    const entries = [
      { email: env.SEED_ADMIN_EMAIL, name: "Administrador demo", technicalAdmin: true, passwordHash: adminHash },
      { email: "consultor@ieo.local", name: "Consultor demo A", technicalAdmin: false, passwordHash: userHash, organizationId: demoIds.organizationA, role: "IEO_CONSULTANT" as const },
      { email: "coordinador@ieo.local", name: "Coordinador demo A", technicalAdmin: false, passwordHash: userHash, organizationId: demoIds.organizationA, role: "ORG_COORDINATOR" as const },
      { email: "consultor2@ieo.local", name: "Consultor demo B", technicalAdmin: false, passwordHash: userHash, organizationId: demoIds.organizationB, role: "IEO_CONSULTANT" as const },
      // Methodology custodian (GAP-011, provisional): approves exceptional access; no organization membership.
      { email: "custodio@ieo.local", name: "Custodio metodológico demo", technicalAdmin: false, methodologyCustodian: true, passwordHash: userHash },
    ];
    for (const entry of entries) {
      const data = { email: entry.email, name: entry.name, technicalAdmin: entry.technicalAdmin, methodologyCustodian: "methodologyCustodian" in entry && entry.methodologyCustodian === true, passwordHash: entry.passwordHash, status: "ACTIVE" as const };
      const user = await tx.user.upsert({ where: { email: entry.email }, create: data, update: data });
      await tx.adminSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      if (entry.organizationId && entry.role) {
        const key = { userId: user.id, organizationId: entry.organizationId, role: entry.role };
        await tx.organizationMembership.upsert({ where: { organizationId_userId_role: key }, create: key, update: { active: true } });
      }
    }
    for (const [id, organizationId, name] of [[demoIds.assessmentA, demoIds.organizationA, "Diagnóstico Demo A 2026"], [demoIds.assessmentB, demoIds.organizationB, "Diagnóstico Demo B 2026"], [demoIds.assessmentOpenA, demoIds.organizationA, "Aplicación de prueba A 2026"]]) {
      await tx.assessment.upsert({ where: { id }, create: { id, organizationId, name, period: "2026", status: "DRAFT" }, update: { name, period: "2026" } });
      await tx.assessmentPerspective.createMany({ data: perspectiveCodes.map(perspectiveCode => ({ assessmentId: id, perspectiveCode })), skipDuplicates: true });
    }
  });
}

/** Opens the demo application assessment once catalogs are loaded: pinned package and five applicable perspectives. */
export async function openDemoAssessment(client: PrismaClient) {
  const assessment = await client.assessment.findUniqueOrThrow({ where: { id: demoIds.assessmentOpenA } });
  if (!assessment.methodologyPackageId) throw new Error("El diagnóstico de prueba no tiene paquete; cargue los catálogos antes.");
  await client.assessmentPerspective.updateMany({ where: { assessmentId: demoIds.assessmentOpenA }, data: { applicability: "APPLICABLE" } });
  if (assessment.status === "DRAFT") await client.assessment.update({ where: { id: demoIds.assessmentOpenA }, data: { status: "OPEN", openedAt: new Date() } });
}
