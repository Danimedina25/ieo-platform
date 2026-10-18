import { describe, expect, it } from "vitest";
import { integer, oneDecimal } from "@/domain/results/format";
import { disclosureWarnings } from "@/domain/results/disclosure";
import { disclosureSchema, patternSchema, qualitativeReviewSchema } from "@/domain/results/schemas";

const id = "00000000-0000-4000-8000-000000000000";
describe("presentation format (Modelo §13, GAP-007)", () => {
  it("shows RP/RI with one decimal and an exact .5 rounds down", () => {
    expect(oneDecimal("125/2")).toBe("62.5");
    expect(oneDecimal("1249/20")).toBe("62.4"); // 62.45 → 62.4
    expect(oneDecimal("12491/200")).toBe("62.5"); // 62.455 → 62.5
    expect(oneDecimal("800/9")).toBe("88.9");
    expect(oneDecimal("100/1")).toBe("100.0");
    expect(oneDecimal(null)).toBeNull();
  });
  it("shows Global and BT as integers with the same rule", () => {
    expect(integer("159/2")).toBe(79);
    expect(integer("398/5")).toBe(80);
    expect(integer(null)).toBeNull();
  });
});
describe("disclosure warnings", () => {
  const perspectiveElements = [
    { perspectiveCode: "DIR" as const, elementCode: "E01", status: "VALID", validPiCount: 2 },
    { perspectiveCode: "COL" as const, elementCode: "E01", status: "VALID", validPiCount: 30 },
    { perspectiveCode: "LID" as const, elementCode: "E01", status: "ND", validPiCount: 0 },
  ];
  const elements = [{ elementCode: "E01", riStatus: "INTEGRATED", perspectives: ["DIR", "COL"] as ("DIR" | "COL")[], btStatus: "PARTIAL" }];
  it("warns about few people without hiding anything automatically", () => {
    expect(disclosureWarnings({ perspectiveElements, elements, hidden: [] })).toEqual([{ perspectiveCode: "DIR", kind: "FEW_PEOPLE", elements: ["E01"] }]);
  });
  it("warns that a hidden perspective is deducible from RI/BT that include it", () => {
    expect(disclosureWarnings({ perspectiveElements, elements, hidden: ["COL"] })).toEqual([
      { perspectiveCode: "DIR", kind: "FEW_PEOPLE", elements: ["E01"] },
      { perspectiveCode: "COL", kind: "DEDUCIBLE_FROM_INTEGRATION", elements: ["E01"] },
    ]);
  });
});
describe("review inputs", () => {
  it("requires justification, reason and redacted text only when redacted", () => {
    expect(patternSchema.safeParse({ runId: id, elementCode: "E01", patternCode: "PERCEPTION_GAP", justification: "" }).success).toBe(false);
    expect(patternSchema.safeParse({ runId: id, elementCode: "E01", patternCode: "CAUSE", justification: "x" }).success).toBe(false);
    expect(disclosureSchema.safeParse({ runId: id, perspectiveCode: "DIR", decision: "NOT_REPORTABLE", reason: " " }).success).toBe(false);
    expect(qualitativeReviewSchema.safeParse({ runId: id, surveyResponseId: id, status: "REDACTED", redactedText: null }).success).toBe(false);
    expect(qualitativeReviewSchema.safeParse({ runId: id, surveyResponseId: id, status: "SAFE_FOR_REPORT", redactedText: "x" }).success).toBe(false);
    expect(qualitativeReviewSchema.safeParse({ runId: id, surveyResponseId: id, status: "REDACTED", redactedText: "texto [redactado]" }).success).toBe(true);
  });
});
