import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildColCatalog } from "@/infrastructure/catalog/build-col";
import { colCatalog, verifiedCatalog } from "@/infrastructure/catalog/load";
import { definitionFromCatalog } from "@/domain/survey/from-catalog";
import { surveyItems } from "@/domain/survey/definition";

// Expectations come from ARCHITECTURE.md (Phase 0 inventory of S05/S07), not from the catalog builder.
const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");
const sourceHash = (id: string) => new RegExp(`\\| ${id} \\|[^|]*\\| \`([a-f0-9]{64})\` \\|`).exec(architecture)?.[1];
const quantitative = colCatalog.questions.filter(question => question.kind === "QUANT");
const open = colCatalog.questions.filter(question => question.kind === "OPEN");

describe("IEO-COL-01 v1.0 catalog", () => {
  it("is reproducible from the official sources and its hash is intact", () => {
    const { contentHash, ...committed } = colCatalog;
    expect(buildColCatalog("docs")).toEqual(committed);
    expect(() => verifiedCatalog(colCatalog)).not.toThrow();
    expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(() => verifiedCatalog({ ...colCatalog, title: "Otro" })).toThrow();
  });
  it("records the inventoried source files", () => {
    expect(colCatalog.sources.map(source => source.sha256)).toEqual([sourceHash("S05"), sourceHash("S07")]);
    expect(colCatalog.certified).toBe(false);
  });
  it("has 73 quantitative and 8 open questions in official order", () => {
    expect(quantitative).toHaveLength(73);
    expect(open).toHaveLength(8);
    expect(quantitative.map(question => question.officialOrder)).toEqual(Array.from({ length: 73 }, (_, index) => index + 1));
    expect(colCatalog.questions.map(question => question.displayOrder)).toEqual(Array.from({ length: 81 }, (_, index) => index + 1));
    expect(new Set(colCatalog.questions.map(question => question.code)).size).toBe(81);
  });
  it("distributes items 9,9,9,10,9,9,9,9 across the eight Elements", () => {
    expect(["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"].map(code => quantitative.filter(question => question.elementCode === code).length)).toEqual([9, 9, 9, 10, 9, 9, 9, 9]);
    expect(colCatalog.sections.map(section => section.elementCode)).toEqual(["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"]);
  });
  it("marks exactly the eight documented reverse items", () => {
    expect(quantitative.filter(question => question.orientation === "REVERSE").map(question => question.code)).toEqual(["COL_E01_R009", "COL_E02_R018", "COL_E03_R027", "COL_E04_R037", "COL_E05_R046", "COL_E06_R055", "COL_E07_R064", "COL_E08_R073"]);
  });
  it("allows N/A on every quantitative item and places one open question after each Element", () => {
    expect(quantitative.every(question => question.allowNA)).toBe(true);
    expect(open.every(question => !question.allowNA && question.orientation === null)).toBe(true);
    for (const section of colCatalog.sections) {
      const inSection = colCatalog.questions.filter(question => question.sectionOrder === section.displayOrder);
      expect(inSection.at(-1)?.kind).toBe("OPEN");
      expect(inSection.filter(question => question.kind === "OPEN")).toHaveLength(1);
    }
  });
  it("uses «líder inmediato» for COL_E04_R028 and records the dictionary difference (GAP-003)", () => {
    expect(colCatalog.questions.find(question => question.code === "COL_E04_R028")?.text).toContain("mi líder inmediato");
    expect(colCatalog.corrections).toEqual([expect.objectContaining({ code: "COL_E04_R028", dictionaryValue: expect.stringContaining("mi jefe inmediato") })]);
  });
  it("keeps official texts for intro, scale and thanks", () => {
    expect(colCatalog.intro.instructions).toContain("últimos seis meses");
    expect(colCatalog.scale.map(option => option.valueCode)).toEqual(["1", "2", "3", "4", "5", "NA"]);
    expect(colCatalog.scale.at(-1)?.label).toBe("No aplica / No cuento con información suficiente");
    expect(colCatalog.thanks).toMatch(/^Gracias por responder este instrumento\./);
  });
  it("never exposes orientation in the participant definition", () => {
    const definition = definitionFromCatalog(colCatalog);
    const serialized = JSON.stringify(definition);
    expect(serialized).not.toContain("REVERSE");
    expect(serialized).not.toContain("orientation");
    expect(surveyItems(definition)).toHaveLength(81);
    expect(surveyItems(definition).every(item => !item.required)).toBe(true);
  });
});
