import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { runS12, S12_FILE } from "../src/infrastructure/acceptance/s12";
import { sha256File } from "../src/infrastructure/catalog/office-sources";
import { ENGINE_VERSION, ENGINE_POLICIES } from "../src/domain/ieo-engine/run";
// Runs the official S12 matrix against the engine and writes the acceptance record (equivalent of sheet 10_ACEPTACION).
// Every PASS in the record was produced by this run; nothing is copied from the workbook.
const results = runS12("docs");
const official = results.filter(row => row.caseId.startsWith("T"));
const boundaries = results.filter(row => row.caseId.startsWith("B"));
let commit = "sin git";
try { commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim() + (execSync("git status --porcelain", { encoding: "utf8" }).trim() ? " (con cambios locales)" : ""); } catch { /* outside a repository */ }
const cell = (text: string) => text.replace(/\|/g, "\\|");
const table = (rows: typeof results) => ["| Caso | Capa | Nombre | Esperado | Obtenido | Resultado |", "|---|---|---|---|---|---|", ...rows.map(row => `| ${row.caseId} | ${row.layer} | ${cell(row.name)} | ${cell(row.expected)} | ${cell(row.obtained)} | **${row.pass ? "PASS" : "FAIL"}** |`)].join("\n");
const report = `# Phase 5A — registro de aceptación S12

Generado por \`npm run test:acceptance\` (runner automatizado). No editar a mano: volver a ejecutar el script.

| Campo | Valor |
|---|---|
| Fecha de ejecución (UTC) | ${new Date().toISOString()} |
| Versión del motor | ${ENGINE_VERSION} |
| Commit | ${commit} |
| Matriz | ${S12_FILE} |
| SHA-256 de la matriz | \`${sha256File(join("docs", S12_FILE))}\` |
| Casos críticos | ${official.filter(row => row.pass).length} PASS / ${official.length} (${official.filter(row => !row.pass).length} FAIL) |
| Fronteras de salud (08_GLOBAL A9:C21) | ${boundaries.filter(row => row.pass).length} PASS / ${boundaries.length} |

Comparación: valor con tolerancia < 0.000001 (la de S12), además de estado, clase y nulidad. T05 se compara también por nulidad y T19 por estado LIMITED, que el comparador del Excel no verifica (GAP-013).

Políticas aplicadas:

${Object.entries(ENGINE_POLICIES).map(([key, value]) => `- **${key}:** ${value}`).join("\n")}

## Casos críticos (T01–T22 y T06N)

${table(official)}

## Fronteras de nivel de salud y semáforo

${table(boundaries)}
`;
writeFileSync("docs/PHASE5A_ACCEPTANCE.md", report);
console.log(`S12: ${official.filter(row => row.pass).length}/${official.length} casos críticos PASS; ${boundaries.filter(row => row.pass).length}/${boundaries.length} fronteras PASS.`);
if (results.some(row => !row.pass)) process.exitCode = 1;
