import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// Minimal read-only access to the official DOCX/XLSX sources (ZIP + XML). No third-party parser:
// the files are trusted project inputs and only text, cells and paragraphs are needed.
export function sha256File(path: string) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }

function zipEntries(buffer: Buffer) {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("Archivo ZIP inválido.");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map<string, () => string>();
  for (let index = 0; index < count; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Directorio ZIP inválido.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    entries.set(name, () => {
      const start = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
      const data = buffer.subarray(start, start + compressedSize);
      if (method === 0) return data.toString("utf8");
      if (method === 8) return inflateRawSync(data).toString("utf8");
      throw new Error(`Compresión ZIP no soportada en ${name}.`);
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function entry(entries: Map<string, () => string>, name: string) {
  const read = entries.get(name);
  if (!read) throw new Error(`Falta ${name} en el archivo fuente.`);
  return read();
}
export function decodeXml(text: string) {
  return text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (_, dec, hex, named) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    return ({ amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" } as Record<string, string>)[named];
  });
}

/** Paragraph texts of a DOCX body, in document order (table cells included), whitespace-normalized. */
export function docxParagraphs(path: string): string[] {
  const xml = entry(zipEntries(readFileSync(path)), "word/document.xml");
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)]
    .map(([paragraph]) => decodeXml([...paragraph.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:(tab|br)\/>/g)].map(match => match[1] ?? " ").join("")))
    .map(text => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Rows of an XLSX sheet by its tab name, as { column letter: text }. */
export function xlsxSheetRows(path: string, sheetName: string): Map<number, Record<string, string>> {
  const entries = zipEntries(readFileSync(path));
  const workbook = entry(entries, "xl/workbook.xml");
  const relationId = [...workbook.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/>/g)].map(([, attributes]) => attributes)
    .find(attributes => decodeXml(/\bname="([^"]*)"/.exec(attributes)?.[1] ?? "") === sheetName)?.match(/\br:id="([^"]+)"/)?.[1];
  if (!relationId) throw new Error(`No existe la hoja ${sheetName}.`);
  const relations = entry(entries, "xl/_rels/workbook.xml.rels");
  const target = [...relations.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/>/g)].map(([, attributes]) => attributes)
    .find(attributes => attributes.includes(`Id="${relationId}"`))?.match(/\bTarget="([^"]+)"/)?.[1];
  if (!target) throw new Error(`Relación de hoja ${sheetName} inválida.`);
  const sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const sharedXml = entries.has("xl/sharedStrings.xml") ? entry(entries, "xl/sharedStrings.xml") : "";
  const shared = [...sharedXml.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(([, item]) => decodeXml([...item.matchAll(/<(?:\w+:)?t(?: [^>]*)?>([^<]*)<\/(?:\w+:)?t>/g)].map(match => match[1]).join("")));
  const rows = new Map<number, Record<string, string>>();
  for (const [, column, row, attributes, body = ""] of entry(entries, sheetPath).matchAll(/<(?:\w+:)?c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
    const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
    const raw = type === "inlineStr" ? [...body.matchAll(/<(?:\w+:)?t(?: [^>]*)?>([^<]*)<\/(?:\w+:)?t>/g)].map(match => match[1]).join("") : /<(?:\w+:)?v>([^<]*)<\/(?:\w+:)?v>/.exec(body)?.[1];
    if (raw === undefined) continue;
    const value = type === "s" ? shared[Number(raw)] : decodeXml(raw);
    const cells = rows.get(Number(row)) ?? {};
    cells[column] = value;
    rows.set(Number(row), cells);
  }
  return rows;
}
