import { spawnSync } from "node:child_process";
import { selectTestDatabase } from "../tests/test-environment";
import { seedDemo, seedEnvironment } from "../prisma/seed-data";
async function main() {
  selectTestDatabase();
  seedEnvironment();
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit", env: process.env });
  if (result.status !== 0) throw new Error("Migración de pruebas falló.");
  const { db } = await import("../src/infrastructure/persistence/db");
  try { await seedDemo(db()); console.log("Base de pruebas migrada y seed sintético aplicado."); }
  finally { await db().$disconnect(); }
}
main().catch(() => { console.error("No se pudo preparar MySQL de pruebas. Revise configuración y credenciales seed."); process.exitCode = 1; });
