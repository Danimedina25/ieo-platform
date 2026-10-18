import "dotenv/config";
import { db } from "../src/infrastructure/persistence/db";
import { verifyHistory } from "../src/infrastructure/history/verify";
// Verifies frozen snapshots and reproduces every successful run (use DATABASE_URL to point at a restored database).
async function main() {
  try {
    const result = await verifyHistory(db());
    console.log(`Copias congeladas: ${result.snapshots}. Procesamientos: ${result.runs}${result.otherEngineVersions ? ` (${result.otherEngineVersions} de otra versión del motor, no reejecutados)` : ""}.`);
    for (const problem of result.problems) console.error(problem);
    console.log(result.problems.length ? `FALLA: ${result.problems.length} problema(s).` : "OK: todo reproducido exactamente.");
    if (result.problems.length) process.exitCode = 1;
  } finally { await db().$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo verificar."); process.exitCode = 1; });
