import "dotenv/config";
import { db } from "../src/infrastructure/persistence/db";
import { seedDemo, seedEnvironment } from "./seed-data";
async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEVELOPMENT_SEED !== "true") throw new Error("Seed sintético solo para desarrollo: requiere ALLOW_DEVELOPMENT_SEED=true y NODE_ENV distinto de production.");
  seedEnvironment();
  try { await seedDemo(db()); console.log("Seed sintético aplicado: 4 usuarios, 2 organizaciones, 2 diagnósticos, 10 perspectivas pendientes. Sesiones demo anteriores revocadas."); }
  finally { await db().$disconnect(); }
}
main().catch(() => { console.error("Seed falló. Requiere ALLOW_DEVELOPMENT_SEED=true, SEED_ADMIN_EMAIL válido, SEED_ADMIN_PASSWORD y SEED_USER_PASSWORD de 12–128 caracteres; NODE_ENV no production. Revise también conexión y migraciones."); process.exitCode = 1; });
