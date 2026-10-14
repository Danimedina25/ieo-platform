import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInstrumentCatalog, INSTRUMENT_SOURCES } from "@/infrastructure/catalog/build-instrument";
import { colCatalog, officialCatalogs, verifiedCatalog } from "@/infrastructure/catalog/load";
import { definitionFromCatalog } from "@/domain/survey/from-catalog";
import { surveyItems, validateAnswer, SurveyAnswerError } from "@/domain/survey/definition";

// Expectations come from ARCHITECTURE.md (Phase 0 inventory of S05 and S07–S11), not from the catalog builder.
const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");
const sourceHash = (id: string) => new RegExp(`\\| ${id} \\|[^|]*\\| \`([a-f0-9]{64})\` \\|`).exec(architecture)?.[1];
const inventory = Object.fromEntries([...architecture.matchAll(/^\| (DIR|ESP|LID|COL|CLI) \| (IEO-[A-Z]+-01) \| ([\d,]+) \| (\d+) \| (\d+) \| (Sí|No) \| (\d+) \|$/gm)]
  .map(([, perspective, code, distribution, total, open, na, reverse]) => [perspective, { code, distribution: distribution.split(",").map(Number), total: Number(total), open: Number(open), na: na === "Sí", reverse: Number(reverse) }]));
const quant = (catalog: (typeof officialCatalogs)[number]) => catalog.questions.filter(question => question.kind === "QUANT");
const open = (catalog: (typeof officialCatalogs)[number]) => catalog.questions.filter(question => question.kind === "OPEN");

describe("official instrument catalogs v1.0", () => {
  it("covers the five perspectives with 329 quantitative and 28 open questions", () => {
    expect(Object.keys(inventory)).toEqual(["DIR", "ESP", "LID", "COL", "CLI"]);
    expect(officialCatalogs.map(catalog => catalog.perspectiveCode)).toEqual(["DIR", "ESP", "LID", "COL", "CLI"]);
    expect(officialCatalogs.reduce((sum, catalog) => sum + quant(catalog).length, 0)).toBe(329);
    expect(officialCatalogs.reduce((sum, catalog) => sum + open(catalog).length, 0)).toBe(28);
  });
  for (const catalog of officialCatalogs) {
    const expected = inventory[catalog.perspectiveCode];
    describe(catalog.instrumentCode, () => {
      it("is reproducible from the official sources and its hash is intact", () => {
        const { contentHash, ...committed } = catalog;
        expect(buildInstrumentCatalog("docs", catalog.perspectiveCode)).toEqual(committed);
        expect(() => verifiedCatalog(catalog)).not.toThrow();
        expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
      });
      it("matches the Phase 0 inventory", () => {
        expect(catalog.instrumentCode).toBe(expected.code);
        expect(["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"].map(code => quant(catalog).filter(question => question.elementCode === code).length)).toEqual(expected.distribution);
        expect(quant(catalog)).toHaveLength(expected.total);
        expect(open(catalog)).toHaveLength(expected.open);
        expect(quant(catalog).every(question => question.allowNA === expected.na)).toBe(true);
        expect(catalog.scale.some(option => option.valueCode === "NA")).toBe(expected.na);
        expect(quant(catalog).filter(question => question.orientation === "REVERSE")).toHaveLength(expected.reverse);
      });
      it("keeps official order, unique codes and source hashes", () => {
        expect(quant(catalog).map(question => question.officialOrder)).toEqual(Array.from({ length: expected.total }, (_, index) => index + 1));
        expect(catalog.questions.map(question => question.displayOrder)).toEqual(Array.from({ length: catalog.questions.length }, (_, index) => index + 1));
        expect(new Set(catalog.questions.map(question => question.code)).size).toBe(catalog.questions.length);
        expect(catalog.questions.every(question => question.code.startsWith(`${catalog.perspectiveCode}_`))).toBe(true);
        const sourceId = INSTRUMENT_SOURCES[catalog.perspectiveCode].sourceId;
        expect(catalog.sources.map(source => source.sha256)).toEqual([sourceHash("S05"), sourceHash(sourceId)]);
        expect(catalog.certified).toBe(false);
      });
      it("never exposes orientation to the participant", () => {
        const serialized = JSON.stringify(definitionFromCatalog(catalog));
        expect(serialized).not.toMatch(/REVERSE|DIRECT|orientation/);
      });
    });
  }
  it("COL: eight documented reverse items and «líder inmediato» in R028 (GAP-003)", () => {
    expect(quant(colCatalog).filter(question => question.orientation === "REVERSE").map(question => question.code)).toEqual(["COL_E01_R009", "COL_E02_R018", "COL_E03_R027", "COL_E04_R037", "COL_E05_R046", "COL_E06_R055", "COL_E07_R064", "COL_E08_R073"]);
    expect(colCatalog.questions.find(question => question.code === "COL_E04_R028")?.text).toContain("mi líder inmediato");
    expect(officialCatalogs.flatMap(catalog => catalog.corrections.map(correction => correction.code))).toEqual(["COL_E04_R028"]);
  });
  it("ESP, LID and COL place one open question at the end of each Element", () => {
    for (const catalog of officialCatalogs.filter(item => ["ESP", "LID", "COL"].includes(item.perspectiveCode))) {
      for (const section of catalog.sections) {
        const inSection = catalog.questions.filter(question => question.sectionOrder === section.displayOrder);
        expect(inSection.at(-1)?.kind).toBe("OPEN");
        expect(inSection.filter(question => question.kind === "OPEN")).toHaveLength(1);
      }
    }
  });
  it("CLI keeps its four general open questions at the end, without Element", () => {
    const cli = officialCatalogs.find(catalog => catalog.perspectiveCode === "CLI")!;
    expect(cli.sections.at(-1)).toMatchObject({ displayOrder: 9, elementCode: null, title: "Preguntas abiertas" });
    expect(open(cli).map(question => [question.code, question.elementCode, question.sectionOrder])).toEqual([["CLI_GEN_O01", null, 9], ["CLI_GEN_O02", null, 9], ["CLI_GEN_O03", null, 9], ["CLI_GEN_O04", null, 9]]);
    expect(cli.questions.slice(-4).every(question => question.kind === "OPEN")).toBe(true);
  });
  it("DIR offers no N/A and the server-side validator rejects it", () => {
    const dir = definitionFromCatalog(officialCatalogs.find(catalog => catalog.perspectiveCode === "DIR")!);
    expect(dir.scale.map(option => option.value)).toEqual(["1", "2", "3", "4", "5"]);
    expect(() => validateAnswer(dir, { itemKey: "DIR_E01_R001", answerState: "NA" })).toThrow(SurveyAnswerError);
    expect(surveyItems(dir).some(item => item.type === "TEXT")).toBe(false);
  });
  it("each instrument keeps its own reference period in the instructions", () => {
    const instructions = Object.fromEntries(officialCatalogs.map(catalog => [catalog.perspectiveCode, catalog.intro.instructions]));
    expect(instructions.COL).toContain("últimos seis meses");
    expect(instructions.DIR).toContain("situación actual");
    expect(instructions.CLI).toContain("experiencia");
  });
  it("rejects an invalid import: a different file under an instrument's name, or a tampered catalog", () => {
    const dir = mkdtempSync(join(tmpdir(), "ieo-catalog-"));
    try {
      cpSync("docs/Diccionario_Maestro_Datos_Codificacion_IEO_v1.0.xlsx", join(dir, "Diccionario_Maestro_Datos_Codificacion_IEO_v1.0.xlsx"));
      cpSync("docs/IEO_Especialistas_Version_Oficial_1.0.docx", join(dir, INSTRUMENT_SOURCES.LID.file));
      expect(() => buildInstrumentCatalog(dir, "LID")).toThrow(/Catálogo IEO-LID-01/);
      expect(() => buildInstrumentCatalog(dir, "DIR")).toThrow();
    } finally { rmSync(dir, { recursive: true, force: true }); }
    expect(() => verifiedCatalog({ ...colCatalog, title: "Otro" })).toThrow(/contentHash/);
  });
});
