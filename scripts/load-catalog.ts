import "dotenv/config";
import { db } from "../src/infrastructure/persistence/db";
import { loadOfficialCatalogs } from "../src/infrastructure/catalog/load";
// Loads the five versioned instrument catalogs and the IEO 1.0 package. Safe in any environment: idempotent, never updates a loaded version.
async function main() {
  try { const result = await loadOfficialCatalogs(db()); console.log(`Paquete IEO 1.0 listo: ${result.instrumentsCreated} instrumento(s) nuevos, ${result.assessmentsPinned} diagnóstico(s) asignados.`); }
  finally { await db().$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo cargar el catálogo."); process.exitCode = 1; });
