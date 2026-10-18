import { describe, expect, it } from "vitest";
import { neutralize, toCsv } from "@/domain/exports/csv";
import { crc32, zip } from "@/domain/exports/zip";
import { suppressionPlan } from "@/domain/exports/suppression";
import { zipTextEntries } from "@/infrastructure/catalog/office-sources";
import { parseCsv } from "../fixtures/csv";

describe("CSV export format", () => {
  it("neutralizes formula prefixes and keeps other text intact", () => {
    expect(["=SUM(A1)", "+1", "-1", "@cmd", "\tx", "\rx", "texto", "", "'ya"].map(neutralize)).toEqual(["'=SUM(A1)", "'+1", "'-1", "'@cmd", "'\tx", "'\rx", "texto", "", "'ya"]);
  });
  it("quotes separators, quotes and newlines, writes BOM and CRLF, never neutralizes numbers", () => {
    const csv = toCsv(["a", "b", "c"], [["x,y", 'dijo "hola"', "línea\nnueva"], [-5, null, "=1+1"]]);
    expect(csv.startsWith("﻿a,b,c\r\n")).toBe(true);
    expect(parseCsv(csv)).toEqual([{ a: "x,y", b: 'dijo "hola"', c: "línea\nnueva" }, { a: "-5", b: "", c: "'=1+1" }]);
    expect(() => toCsv(["a"], [["1", "2"]])).toThrow();
  });
});
describe("ZIP package", () => {
  it("round-trips UTF-8 files with correct CRC", () => {
    const files = [{ name: "manifest.json", content: '{"ok":true}' }, { name: "datos.csv", content: toCsv(["texto"], [["Información con acentos ñ"]]) }];
    const entries = zipTextEntries(zip(files, new Date("2026-10-18T12:00:00Z")));
    expect([...entries.keys()]).toEqual(["manifest.json", "datos.csv"]);
    expect(parseCsv(entries.get("datos.csv")!)).toEqual([{ texto: "Información con acentos ñ" }]);
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
  it("is deterministic for the same contents and date", () => {
    const files = [{ name: "a.csv", content: "x" }];
    const date = new Date("2026-10-18T12:00:00Z");
    expect(zip(files, date).equals(zip(files, date))).toBe(true);
  });
});
describe("report suppression", () => {
  const elements = [{ elementCode: "E01", perspectives: ["DIR", "COL"] as ("DIR" | "COL")[] }, { elementCode: "E02", perspectives: ["COL"] as ("DIR" | "COL")[] }];
  it("suppresses the hidden perspective, the integrated values it takes part in and then the Global", () => {
    const plan = suppressionPlan({ hidden: ["DIR"], elements });
    expect([...plan.perspectives]).toEqual(["DIR"]);
    expect([...plan.elements]).toEqual(["E01"]);
    expect(plan.global).toBe(true);
  });
  it("suppresses nothing when every perspective is reportable", () => {
    expect(suppressionPlan({ hidden: [], elements })).toMatchObject({ global: false });
  });
});
