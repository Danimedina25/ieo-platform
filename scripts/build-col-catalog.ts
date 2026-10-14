import { writeFileSync } from "node:fs";
import { buildColCatalog } from "../src/infrastructure/catalog/build-col";
import { catalogContentHash } from "../src/domain/survey/catalog";
// Regenerates the versioned IEO-COL-01 v1.0 catalog from the official sources in docs/. Review the diff before committing.
const catalog = buildColCatalog("docs");
const output = "src/domain/survey/catalogs/ieo-col-01-v1.0.json";
writeFileSync(output, `${JSON.stringify({ ...catalog, contentHash: catalogContentHash(catalog) }, null, 2)}\n`);
console.log(`${output}: ${catalog.questions.filter(q => q.kind === "QUANT").length} cuantitativos, ${catalog.questions.filter(q => q.kind === "OPEN").length} abiertas, ${catalog.corrections.length} corrección(es).`);
