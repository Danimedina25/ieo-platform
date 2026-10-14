import { writeFileSync } from "node:fs";
import { buildInstrumentCatalog, INSTRUMENT_SOURCES } from "../src/infrastructure/catalog/build-instrument";
import { catalogContentHash } from "../src/domain/survey/catalog";
// Regenerates the versioned v1.0 catalogs of the five instruments from the official sources in docs/. Review the diff before committing.
for (const perspective of Object.keys(INSTRUMENT_SOURCES) as (keyof typeof INSTRUMENT_SOURCES)[]) {
  const catalog = buildInstrumentCatalog("docs", perspective);
  const output = `src/domain/survey/catalogs/${catalog.instrumentCode.toLowerCase()}-v${catalog.version}.json`;
  writeFileSync(output, `${JSON.stringify({ ...catalog, contentHash: catalogContentHash(catalog) }, null, 2)}\n`);
  console.log(`${output}: ${catalog.questions.filter(q => q.kind === "QUANT").length} cuantitativos, ${catalog.questions.filter(q => q.kind === "OPEN").length} abiertas, ${catalog.corrections.length} corrección(es).`);
}
