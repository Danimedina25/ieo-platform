import { join } from "node:path";
import { elementCodes, type CatalogQuestion, type CatalogSection, type ElementCode, type InstrumentCatalog } from "@/domain/survey/catalog";
import { docxParagraphs, sha256File, xlsxSheetRows } from "./office-sources";

export const COL_SOURCES = {
  dictionary: "Diccionario_Maestro_Datos_Codificacion_IEO_v1.0.xlsx",
  instrument: "IEO_Colaboradores_Version_Oficial_1.0.docx",
} as const;
// Approved deviations between dictionary (S05) and instrument (S07). The instrument text prevails.
const TEXT_CORRECTIONS: Record<string, string> = { COL_E04_R028: "GAP-003 (resuelto 2026-10-14): prevalece «líder» del cuestionario oficial" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function fail(message: string): never { throw new Error(`Catálogo COL: ${message}`); }
function tableByHeader(rows: Map<number, Record<string, string>>, firstColumnHeader: string) {
  const headerRow = [...rows.entries()].find(([, cells]) => cells.A === firstColumnHeader);
  if (!headerRow) fail(`no se encontró la cabecera ${firstColumnHeader}.`);
  const [headerIndex, header] = headerRow;
  const columns = Object.fromEntries(Object.entries(header).map(([column, name]) => [name, column]));
  return [...rows.entries()].filter(([index]) => index > headerIndex).map(([index, cells]) => ({
    row: index,
    get(name: string) { const column = columns[name]; if (!column) fail(`falta la columna ${name}.`); return (cells[column] ?? "").trim(); },
  }));
}
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
function after(paragraphs: string[], label: string, from = 0) {
  const index = paragraphs.indexOf(label, from);
  if (index < 0 || !paragraphs[index + 1]) fail(`no se encontró «${label}» en el cuestionario.`);
  return paragraphs[index + 1];
}

/** Reconciles S05 (codes/metadata) with S07 (presented text) into the versioned IEO-COL-01 v1.0 catalog. */
export function buildColCatalog(docsDir: string): InstrumentCatalog {
  const dictionaryPath = join(docsDir, COL_SOURCES.dictionary);
  const instrumentPath = join(docsDir, COL_SOURCES.instrument);
  const quantRows = tableByHeader(xlsxSheetRows(dictionaryPath, "04_REACTIVOS"), "item_id").filter(row => row.get("instrument_code") === "IEO-COL-01");
  const openRows = tableByHeader(xlsxSheetRows(dictionaryPath, "05_ABIERTAS"), "open_item_id").filter(row => row.get("instrument_code") === "IEO-COL-01");
  const paragraphs = docxParagraphs(instrumentPath);

  // Instrument (Word): sections with their quantitative items and the open question of each Element.
  const wordSections = ROMAN.map((roman, position) => {
    const start = paragraphs.indexOf(`ELEMENTO ${roman}`);
    if (start < 0) fail(`no se encontró ELEMENTO ${roman}.`);
    const end = position < 7 ? paragraphs.indexOf(`ELEMENTO ${ROMAN[position + 1]}`) : paragraphs.indexOf("Agradecimiento");
    const block = paragraphs.slice(start, end);
    const [, title, introduction, instructions] = block;
    const tableStart = block.indexOf("Respuesta (marque una opción)");
    const openIndex = block.indexOf("Pregunta abierta");
    if (tableStart < 0 || openIndex < 0) fail(`estructura inesperada en ELEMENTO ${roman}.`);
    const items = new Map<number, string>();
    for (let index = tableStart + 1; index < openIndex; index += 3) {
      const number = Number(block[index]);
      if (!Number.isInteger(number) || !/^1 ○/.test(block[index + 2] ?? "")) fail(`fila de reactivo inesperada en ELEMENTO ${roman}: «${block[index]}».`);
      items.set(number, block[index + 1]);
    }
    return { elementCode: elementCodes[position], label: `Elemento ${roman}`, title, introduction, instructions, items, openText: block[openIndex + 1] };
  });

  const sections: CatalogSection[] = wordSections.map((section, index) => ({ displayOrder: index + 1, elementCode: section.elementCode, label: section.label, title: section.title, introduction: section.introduction, instructions: section.instructions }));
  const corrections: InstrumentCatalog["corrections"][number][] = [];
  const questions: CatalogQuestion[] = [];
  let displayOrder = 0;
  for (const [position, section] of wordSections.entries()) {
    const elementCode = section.elementCode as ElementCode;
    const rows = quantRows.filter(row => row.get("element_code") === elementCode).sort((a, b) => Number(a.get("item_order")) - Number(b.get("item_order")));
    if (rows.length !== section.items.size) fail(`${elementCode}: ${rows.length} reactivos en el diccionario y ${section.items.size} en el cuestionario.`);
    for (const row of rows) {
      const code = row.get("item_code");
      const officialOrder = Number(row.get("item_order"));
      const wordText = section.items.get(officialOrder);
      if (wordText === undefined) fail(`${code} (número ${officialOrder}) no aparece en el cuestionario.`);
      const dictionaryText = normalize(row.get("item_text"));
      let text = dictionaryText;
      if (dictionaryText !== wordText) {
        if (!TEXT_CORRECTIONS[code]) fail(`${code}: el texto del diccionario difiere del cuestionario sin corrección aprobada.`);
        corrections.push({ code, field: "text", dictionaryValue: dictionaryText, appliedValue: wordText, reference: TEXT_CORRECTIONS[code] });
        text = wordText;
      }
      const orientation = row.get("orientation");
      if (row.get("item_type") !== "QUANT" || row.get("scale_code") !== "LIKERT_1_5" || (orientation !== "DIRECT" && orientation !== "REVERSE") || row.get("status") !== "OFFICIAL" || row.get("active") !== "1") fail(`${code}: metadatos no admitidos.`);
      questions.push({ code, kind: "QUANT", sectionOrder: position + 1, elementCode, text, orientation, allowNA: row.get("na_allowed") === "1", officialOrder, orderInElement: Number(row.get("item_order_in_element")), displayOrder: ++displayOrder, sourceGlobalId: Number(row.get("source_global_id")), sourceOfficialCode: row.get("source_official_code"), sourceLocator: `S05 04_REACTIVOS!A${row.row}` });
    }
    const open = openRows.filter(row => row.get("element_code") === elementCode);
    if (open.length !== 1) fail(`${elementCode}: se esperaba una pregunta abierta.`);
    const openRow = open[0];
    if (normalize(openRow.get("item_text")) !== section.openText) fail(`${openRow.get("open_item_code")}: el texto difiere del cuestionario.`);
    if (openRow.get("calculation_included") !== "0" || openRow.get("status") !== "OFFICIAL") fail(`${openRow.get("open_item_code")}: metadatos no admitidos.`);
    questions.push({ code: openRow.get("open_item_code"), kind: "OPEN", sectionOrder: position + 1, elementCode, text: section.openText, orientation: null, allowNA: false, officialOrder: Number(openRow.get("item_order")), orderInElement: null, displayOrder: ++displayOrder, sourceGlobalId: null, sourceOfficialCode: null, sourceLocator: `S05 05_ABIERTAS!A${openRow.row}` });
  }
  const unused = Object.keys(TEXT_CORRECTIONS).filter(code => !corrections.some(correction => correction.code === code));
  if (unused.length) fail(`corrección sin diferencia que corregir: ${unused.join(", ")}.`);

  const scaleStart = paragraphs.indexOf("Escala de respuesta");
  const scale = (["1", "2", "3", "4", "5", "NA"] as const).map((valueCode, index) => {
    const value = paragraphs[scaleStart + 3 + index * 2];
    if (value !== (valueCode === "NA" ? "N/A" : valueCode)) fail("escala de respuesta inesperada.");
    return { valueCode, label: paragraphs[scaleStart + 4 + index * 2] };
  });
  return {
    instrumentCode: "IEO-COL-01",
    version: "1.0",
    perspectiveCode: "COL",
    title: "IEO Colaboradores",
    certified: false,
    sources: [
      { role: "S05 diccionario de datos y codificación", file: COL_SOURCES.dictionary, sha256: sha256File(dictionaryPath) },
      { role: "S07 cuestionario oficial IEO Colaboradores", file: COL_SOURCES.instrument, sha256: sha256File(instrumentPath) },
    ],
    corrections,
    intro: {
      presentation: after(paragraphs, "Presentación"),
      objective: after(paragraphs, "Objetivo"),
      confidentiality: after(paragraphs, "Confidencialidad"),
      audience: after(paragraphs, "¿Quién debe responder este instrumento?"),
      instructions: after(paragraphs, "Instrucciones"),
    },
    scale,
    sections,
    questions,
    thanks: after(paragraphs, "Agradecimiento"),
  };
}
