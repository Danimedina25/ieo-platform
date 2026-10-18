import { spawnSync } from "node:child_process";
import { selectTestDatabase } from "../tests/test-environment";
import { openDemoAssessment, seedDemo, seedEnvironment } from "../prisma/seed-data";
import { loadOfficialCatalogs } from "../src/infrastructure/catalog/load";
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
      await tx.assessment.updateMany({ data: { currentRunId: null } });
      await tx.globalResult.deleteMany();
      await tx.perspectiveIndexResult.deleteMany();
      await tx.elementResult.deleteMany();
      await tx.perspectiveElementResult.deleteMany();
      await tx.processingRun.deleteMany();
      await tx.frozenSnapshot.deleteMany();
      await tx.closureRecord.deleteMany();
      await tx.qualityAssessment.deleteMany();
      await tx.exclusion.deleteMany();
      await tx.incident.deleteMany();
      await tx.participantAuthSession.deleteMany();
      await tx.accessChallenge.deleteMany();
      await tx.participantAccessBinding.deleteMany();
      await tx.surveyResponse.deleteMany();
      await tx.responseSession.deleteMany();
      await tx.invitation.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.adminSession.deleteMany();
      await tx.segment.deleteMany();
      await tx.assessmentPerspective.deleteMany();
      await tx.assessment.deleteMany();
      await tx.organizationMembership.deleteMany();
      await tx.organization.deleteMany();
      await tx.user.deleteMany();
    });
    await seedDemo(db()); await loadOfficialCatalogs(db()); await openDemoAssessment(db()); console.log("Base exclusiva de pruebas reiniciada, migrada y seed sintético aplicado.");
  }
  finally { await db().$disconnect(); }
}
main().catch(() => { console.error("No se pudo preparar MySQL de pruebas. Revise configuración y credenciales seed."); process.exitCode = 1; });
