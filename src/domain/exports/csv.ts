// CSV writer (RFC 4180, UTF-8, CRLF). Text cells starting with = + - @ TAB or CR are prefixed with an
// apostrophe so spreadsheets never execute them as formulas (SECURITY.md); the manifest declares it so a
// consumer can revert it exactly: remove one leading apostrophe from text cells that start with "'" + one of those.
export const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"] as const;
export type CsvCell = string | number | null | undefined;
export const NEUTRALIZATION_NOTE = "Celdas de texto que empezaban con = + - @ tabulador o retorno llevan un apóstrofo inicial añadido; para revertir, quitar un apóstrofo inicial seguido de uno de esos caracteres.";

export function neutralize(value: string) { return FORMULA_PREFIXES.some(prefix => value.startsWith(prefix)) ? `'${value}` : value; }
function cell(value: CsvCell) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value) : neutralize(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function toCsv(header: readonly string[], rows: readonly (readonly CsvCell[])[]) {
  for (const row of rows) if (row.length !== header.length) throw new Error("Fila CSV con columnas distintas a la cabecera.");
  return `﻿${[header, ...rows].map(row => row.map(cell).join(",")).join("\r\n")}\r\n`;
}
