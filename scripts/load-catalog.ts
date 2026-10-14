import "dotenv/config";
import { db } from "../src/infrastructure/persistence/db";
import { colCatalog, loadInstrumentCatalog } from "../src/infrastructure/catalog/load";
// Loads the versioned instrument catalogs. Safe in any environment: idempotent and never updates a loaded version.
async function main() {
  try { const result = await loadInstrumentCatalog(db(), colCatalog); console.log(`IEO-COL-01 v1.0 ${result.created ? "cargado" : "ya existía con el mismo contenido"}.`); }
  finally { await db().$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo cargar el catálogo."); process.exitCode = 1; });
