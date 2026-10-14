import { describe, expect, it } from "vitest";
import { elementCoverage, submissionCheck, validNeeded } from "@/domain/survey/coverage";
import { surveyItems, type SurveyAnswer, type SurveyDefinition } from "@/domain/survey/definition";
import { definitionFromCatalog } from "@/domain/survey/from-catalog";
import { colCatalog } from "@/infrastructure/catalog/load";

// Synthetic two-Element definition; expectations follow GAP-004/006 resolutions and S12 T06/T06N.
function definition(sizes: number[]): SurveyDefinition {
  const codes = ["E01", "E02"] as const;
  return { code: "T", version: "1", title: "T", submissionRule: "ELEMENT_COVERAGE", scale: [], sections: sizes.map((size, index) => ({
    id: `S${index}`, label: `Elemento ${index + 1}`, title: "", elementCode: codes[index], introduction: null, instructions: null,
    items: [
      ...Array.from({ length: size }, (_, item) => ({ key: `${codes[index]}_${item}`, type: "LIKERT" as const, text: "", order: item, required: false, allowNA: true, elementCode: codes[index] })),
      { key: `${codes[index]}_OPEN`, type: "TEXT" as const, text: "", order: 99, required: false, allowNA: false, elementCode: codes[index] },
    ],
  })) };
}
function answers(element: string, valid: number, na: number): SurveyAnswer[] {
  return [
    ...Array.from({ length: valid }, (_, index) => ({ itemKey: `${element}_${index}`, answerState: "VALUE" as const })),
    ...Array.from({ length: na }, (_, index) => ({ itemKey: `${element}_${valid + index}`, answerState: "NA" as const })),
  ];
}
const one = (sizes: number[], rows: SurveyAnswer[]) => elementCoverage(definition(sizes), rows)[0];

describe("element coverage (≥ 60 % valid, N/A out of the denominator)", () => {
  it("accepts exactly 60 %: 6 valid of 10 with 4 omitted (T06)", () => { expect(one([10], answers("E01", 6, 0))).toMatchObject({ valid: 6, missing: 4, applicable: 10, status: "MEETS" }); });
  it("excludes N/A from the denominator: 6 valid + 4 N/A of 10 (T06N)", () => { expect(one([10], answers("E01", 6, 4))).toMatchObject({ applicable: 6, ratio: 1, status: "MEETS" }); });
  it("rejects 50 %: 5 valid of 10 (T07)", () => { expect(one([10], answers("E01", 5, 0)).status).toBe("BELOW"); });
  it("rejects just under the threshold: 10 of 17 (58.8 %)", () => { expect(one([17], answers("E01", 10, 0)).status).toBe("BELOW"); expect(one([17], answers("E01", 11, 0)).status).toBe("MEETS"); });
  it("handles N/A mixed with omissions", () => {
    expect(one([9], answers("E01", 5, 2))).toMatchObject({ applicable: 7, missing: 2, status: "MEETS" });
    expect(one([9], answers("E01", 3, 4))).toMatchObject({ applicable: 5, status: "MEETS" });
    expect(one([9], answers("E01", 2, 4))).toMatchObject({ applicable: 5, status: "BELOW" });
  });
  it("treats an all-N/A Element as ND that does not block submission (GAP-006)", () => {
    expect(one([9], answers("E01", 0, 9))).toMatchObject({ applicable: 0, ratio: null, status: "ALL_NA" });
    expect(submissionCheck(definition([9, 9]), [...answers("E01", 0, 9), ...answers("E02", 9, 0)]).allowed).toBe(true);
  });
  it("ignores open questions and treats unsaved items as missing", () => {
    const rows = [...answers("E01", 6, 0), { itemKey: "E01_OPEN", answerState: "VALUE" as const }];
    expect(one([10], rows)).toMatchObject({ total: 10, valid: 6, missing: 4 });
    expect(one([10], [])).toMatchObject({ valid: 0, missing: 10, status: "BELOW" });
  });
  it("blocks submission when a single Element is below and names only that Element", () => {
    expect(submissionCheck(definition([9, 9]), [...answers("E01", 9, 0), ...answers("E02", 5, 0)])).toEqual({ allowed: false, missingRequired: [], elementsBelow: ["E02"] });
  });
  it("computes the minimum valid answers needed", () => {
    expect(validNeeded({ applicable: 10 })).toBe(6);
    expect(validNeeded({ applicable: 9 })).toBe(6);
    expect(validNeeded({ applicable: 7 })).toBe(5);
    expect(validNeeded({ applicable: 5 })).toBe(3);
  });
  it("applies to the real COL definition: empty is blocked, the minimum per Element is enough", () => {
    const col = definitionFromCatalog(colCatalog);
    expect(submissionCheck(col, []).elementsBelow).toHaveLength(8);
    const minimal = col.sections.flatMap(section => { const items = section.items.filter(item => item.type === "LIKERT"); return items.slice(0, validNeeded({ applicable: items.length })).map(item => ({ itemKey: item.key, answerState: "VALUE" as const })); });
    expect(submissionCheck(col, minimal).allowed).toBe(true);
    expect(submissionCheck(col, minimal.slice(1)).elementsBelow).toEqual(["E01"]);
    expect(surveyItems(col).filter(item => item.type === "TEXT")).toHaveLength(8);
  });
});
