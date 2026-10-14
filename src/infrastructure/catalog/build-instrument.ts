import { join } from "node:path";
import { elementCodes, type CatalogQuestion, type CatalogSection, type ElementCode, type InstrumentCatalog } from "@/domain/survey/catalog";
import { docxParagraphs, sha256File, xlsxSheetRows } from "./office-sources";

export const DICTIONARY_FILE = "Diccionario_Maestro_Datos_Codificacion_IEO_v1.0.xlsx";
type Perspective = InstrumentCatalog["perspectiveCode"];
type InstrumentSource = Readonly<{ instrumentCode: string; sourceId: string; file: string; title: string; openLayout: "PER_ELEMENT" | "FINAL_GENERAL" | "NONE" }>;
// The five official instruments v1.0 (S07–S11). Open-question placement follows each printed instrument.
export const INSTRUMENT_SOURCES: Record<Perspective, InstrumentSource> = {
  DIR: { instrumentCode: "IEO-DIR-01", sourceId: "S08", file: "IEO_Direccion_Version_Oficial_1.0.docx", title: "IEO Dirección", openLayout: "NONE" },
  ESP: { instrumentCode: "IEO-ESP-01", sourceId: "S09", file: "IEO_Especialistas_Version_Oficial_1.0.docx", title: "IEO Especialistas", openLayout: "PER_ELEMENT" },
  LID: { instrumentCode: "IEO-LID-01", sourceId: "S10", file: "IEO_Liderazgo_Version_Oficial_1.0.docx", title: "IEO Liderazgo", openLayout: "PER_ELEMENT" },
  COL: { instrumentCode: "IEO-COL-01", sourceId: "S07", file: "IEO_Colaboradores_Version_Oficial_1.0.docx", title: "IEO Colaboradores", openLayout: "PER_ELEMENT" },
  CLI: { instrumentCode: "IEO-CLI-01", sourceId: "S11", file: "IEO_Voz_del_Cliente_Version_Oficial_1.0.docx", title: "IEO Voz del Cliente", openLayout: "FINAL_GENERAL" },
};
// Approved deviations between dictionary (S05) and instrument text. The instrument text prevails.
const TEXT_CORRECTIONS: Record<string, string> = { COL_E04_R028: "GAP-003 (resuelto 2026-10-14): prevalece «líder» del cuestionario oficial" };
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
const ITEM_TABLE_HEADER = "Respuesta (marque una opción)";
const GENERAL_OPEN_HEADING = "Preguntas abiertas";

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
function tableByHeader(rows: Map<number, Record<string, string>>, firstColumnHeader: string, fail: (message: string) => never) {
  const headerRow = [...rows.entries()].find(([, cells]) => cells.A === firstColumnHeader);
  if (!headerRow) fail(`no se encontró la cabecera ${firstColumnHeader}.`);
  const [headerIndex, header] = headerRow;
  const columns = Object.fromEntries(Object.entries(header).map(([column, name]) => [name, column]));
  return [...rows.entries()].filter(([index]) => index > headerIndex).map(([index, cells]) => ({
    row: index,
    get(name: string) { const column = columns[name]; if (!column) fail(`falta la columna ${name}.`); return (cells[column] ?? "").trim(); },
  }));
}

/** Reconciles S05 (codes/metadata) with the printed instrument (presented text) into a versioned v1.0 catalog. */
export function buildInstrumentCatalog(docsDir: string, perspectiveCode: Perspective): InstrumentCatalog {
  const source = INSTRUMENT_SOURCES[perspectiveCode];
  // Explicit annotation so TypeScript narrows after calls (assertion-style never function).
  const fail: (message: string) => never = message => { throw new Error(`Catálogo ${source.instrumentCode}: ${message}`); };
  const dictionaryPath = join(docsDir, DICTIONARY_FILE);
  const instrumentPath = join(docsDir, source.file);
  const quantRows = tableByHeader(xlsxSheetRows(dictionaryPath, "04_REACTIVOS"), "item_id", fail).filter(row => row.get("instrument_code") === source.instrumentCode);
  const openRows = tableByHeader(xlsxSheetRows(dictionaryPath, "05_ABIERTAS"), "open_item_id", fail).filter(row => row.get("instrument_code") === source.instrumentCode);
  const paragraphs = docxParagraphs(instrumentPath);
  const after = (label: string) => { const index = paragraphs.indexOf(label); if (index < 0 || !paragraphs[index + 1]) fail(`no se encontró «${label}» en el cuestionario.`); return paragraphs[index + 1]; };

  const thanksIndex = paragraphs.indexOf("Agradecimiento");
  if (thanksIndex < 0) fail("no se encontró «Agradecimiento».");
  const generalIndex = paragraphs.indexOf(GENERAL_OPEN_HEADING);
  const generalOpen = generalIndex >= 0 && generalIndex < thanksIndex ? generalIndex : -1;
  if ((generalOpen >= 0) !== (source.openLayout === "FINAL_GENERAL")) fail("ubicación de preguntas abiertas inesperada.");
  const contentEnd = generalOpen >= 0 ? generalOpen : thanksIndex;

  // Each Element block: heading, title, 1–2 guidance paragraphs, the item table and, when present, its open question.
  const wordSections = ROMAN.map((roman, position) => {
    const start = paragraphs.indexOf(`ELEMENTO ${roman}`);
    if (start < 0) fail(`no se encontró ELEMENTO ${roman}.`);
    const end = position < 7 ? paragraphs.indexOf(`ELEMENTO ${ROMAN[position + 1]}`) : contentEnd;
    const block = paragraphs.slice(start, end);
    const tableStart = block.indexOf(ITEM_TABLE_HEADER);
    if (tableStart < 0 || block[tableStart - 2] !== "No." || block[tableStart - 1] !== "Afirmación") fail(`tabla de reactivos inesperada en ELEMENTO ${roman}.`);
    const guidance = block.slice(2, tableStart - 2);
    if (guidance.length < 1 || guidance.length > 2) fail(`encabezado inesperado en ELEMENTO ${roman}.`);
    const openIndex = block.indexOf("Pregunta abierta");
    if ((openIndex >= 0) !== (source.openLayout === "PER_ELEMENT")) fail(`pregunta abierta inesperada en ELEMENTO ${roman}.`);
    const itemsEnd = openIndex >= 0 ? openIndex : block.length;
    const items = new Map<number, string>();
    for (let index = tableStart + 1; index < itemsEnd; index += 3) {
      const number = Number(block[index]);
      if (!Number.isInteger(number) || !/^1\s+○/.test(block[index + 2] ?? "")) fail(`fila de reactivo inesperada en ELEMENTO ${roman}: «${block[index]}».`);
      items.set(number, block[index + 1]);
    }
    return { elementCode: elementCodes[position], label: `Elemento ${roman}`, title: block[1], introduction: guidance[0], instructions: guidance[1] ?? null, items, openText: openIndex >= 0 ? block[openIndex + 1] : null };
  });

  const sections: CatalogSection[] = wordSections.map((section, index) => ({ displayOrder: index + 1, elementCode: section.elementCode, label: section.label, title: section.title, introduction: section.introduction, instructions: section.instructions }));
  const corrections: InstrumentCatalog["corrections"][number][] = [];
  const questions: CatalogQuestion[] = [];
  let displayOrder = 0;
  const openQuestion = (row: (typeof openRows)[number], text: string, sectionOrder: number, elementCode: ElementCode | null): CatalogQuestion => {
    if (normalize(row.get("item_text")) !== text) fail(`${row.get("open_item_code")}: el texto difiere del cuestionario.`);
    if (row.get("calculation_included") !== "0" || row.get("status") !== "OFFICIAL" || row.get("active") !== "1") fail(`${row.get("open_item_code")}: metadatos no admitidos.`);
    return { code: row.get("open_item_code"), kind: "OPEN", sectionOrder, elementCode, text, orientation: null, allowNA: false, officialOrder: Number(row.get("item_order")), orderInElement: null, displayOrder: ++displayOrder, sourceGlobalId: null, sourceOfficialCode: null, sourceLocator: `S05 05_ABIERTAS!A${row.row}` };
  };
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
      if (row.get("item_type") !== "QUANT" || row.get("scale_code") !== "LIKERT_1_5" || (orientation !== "DIRECT" && orientation !== "REVERSE") || row.get("status") !== "OFFICIAL" || row.get("active") !== "1" || !["0", "1"].includes(row.get("na_allowed"))) fail(`${code}: metadatos no admitidos.`);
      questions.push({ code, kind: "QUANT", sectionOrder: position + 1, elementCode, text, orientation, allowNA: row.get("na_allowed") === "1", officialOrder, orderInElement: Number(row.get("item_order_in_element")), displayOrder: ++displayOrder, sourceGlobalId: Number(row.get("source_global_id")), sourceOfficialCode: row.get("source_official_code"), sourceLocator: `S05 04_REACTIVOS!A${row.row}` });
    }
    if (section.openText !== null) {
      const open = openRows.filter(row => row.get("element_code") === elementCode);
      if (open.length !== 1) fail(`${elementCode}: se esperaba una pregunta abierta.`);
      questions.push(openQuestion(open[0], section.openText, position + 1, elementCode));
    }
  }
  if (generalOpen >= 0) {
    const general = paragraphs.slice(generalOpen + 2, thanksIndex).map(text => /^(\d+)\.\s+(.+)$/.exec(text)).filter(match => match !== null);
    const rows = openRows.filter(row => row.get("element_code") === "").sort((a, b) => Number(a.get("item_order")) - Number(b.get("item_order")));
    if (general.length === 0 || rows.length !== general.length || general.some((match, index) => Number(match[1]) !== index + 1)) fail("preguntas abiertas generales inesperadas.");
    sections.push({ displayOrder: 9, elementCode: null, label: GENERAL_OPEN_HEADING, title: GENERAL_OPEN_HEADING, introduction: paragraphs[generalOpen + 1], instructions: null });
    rows.forEach((row, index) => questions.push(openQuestion(row, general[index][2], 9, null)));
  }
  if (questions.filter(question => question.kind === "QUANT").length !== quantRows.length) fail("hay reactivos del diccionario fuera de los Elementos del cuestionario.");
  if (questions.filter(question => question.kind === "OPEN").length !== openRows.length) fail("hay preguntas abiertas del diccionario fuera del cuestionario.");
  const unused = Object.keys(TEXT_CORRECTIONS).filter(code => code.startsWith(`${perspectiveCode}_`) && !corrections.some(correction => correction.code === code));
  if (unused.length) fail(`corrección sin diferencia que corregir: ${unused.join(", ")}.`);

  const scaleStart = paragraphs.indexOf("Escala de respuesta");
  const valueCodes = (["1", "2", "3", "4", "5", "NA"] as const).filter(code => code !== "NA" || paragraphs[scaleStart + 13] === "N/A");
  const allowsNA = valueCodes.includes("NA");
  if (questions.some(question => question.kind === "QUANT" && question.allowNA !== allowsNA)) fail("N/A del diccionario no coincide con la escala del cuestionario.");
  const scale = valueCodes.map((valueCode, index) => {
    if (paragraphs[scaleStart + 3 + index * 2] !== (valueCode === "NA" ? "N/A" : valueCode)) fail("escala de respuesta inesperada.");
    return { valueCode, label: paragraphs[scaleStart + 4 + index * 2] };
  });
  return {
    instrumentCode: source.instrumentCode,
    version: "1.0",
    perspectiveCode,
    title: source.title,
    certified: false,
    sources: [
      { role: "S05 diccionario de datos y codificación", file: DICTIONARY_FILE, sha256: sha256File(dictionaryPath) },
      { role: `${source.sourceId} cuestionario oficial ${source.title}`, file: source.file, sha256: sha256File(instrumentPath) },
    ],
    corrections,
    intro: {
      presentation: after("Presentación"),
      objective: after("Objetivo"),
      confidentiality: after("Confidencialidad"),
      audience: after("¿Quién debe responder este instrumento?"),
      instructions: after("Instrucciones"),
    },
    scale,
    sections,
    questions,
    thanks: after("Agradecimiento"),
  };
}
