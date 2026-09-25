import { spawnSync } from "node:child_process";
import { selectTestDatabase } from "../tests/test-environment";
import { seedDemo, seedEnvironment } from "../prisma/seed-data";
async function main() {
  selectTestDatabase();
  seedEnvironment();
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error("Migración de pruebas falló.");
  const { db } = await import("../src/infrastructure/persistence/db");
  try {
    const expected = new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1);
    const actual = await db().$queryRaw<Array<{ name: string }>>`SELECT DATABASE() AS name`;
    if (actual[0]?.name !== expected) throw new Error("La conexión no apunta a la base de pruebas esperada.");
    await db().$transaction(async tx => {
      await tx.auditLog.deleteMany();
      await tx.adminSession.deleteMany();
      await tx.segment.deleteMany();
      await tx.assessmentPerspective.deleteMany();
      await tx.assessment.deleteMany();
      await tx.organizationMembership.deleteMany();
      await tx.organization.deleteMany();
      await tx.user.deleteMany();
    });
    await seedDemo(db()); console.log("Base exclusiva de pruebas reiniciada, migrada y seed sintético aplicado.");
  }
  finally { await db().$disconnect(); }
}
main().catch(() => { console.error("No se pudo preparar MySQL de pruebas. Revise configuración y credenciales seed."); process.exitCode = 1; });
