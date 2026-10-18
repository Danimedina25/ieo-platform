import { describe, expect, it } from "vitest";
import { runS12 } from "@/infrastructure/acceptance/s12";

// Official acceptance matrix S12: inputs and expectations read from the workbook, never retyped.
const results = runS12("docs");
const official = ["T01", "T02", "T03", "T04", "T05", "T06", "T06N", "T07", "T08", "T09", "T10", "T11", "T12", "T13", "T14", "T15", "T16", "T17", "T18", "T19", "T20", "T21", "T22"];
describe("S12 acceptance matrix", () => {
  it("covers exactly the 23 official critical cases", () => { expect(results.filter(row => /^T/.test(row.caseId)).map(row => row.caseId).sort()).toEqual([...official].sort()); });
  it("covers the 13 health/traffic-light boundaries of 08_GLOBAL", () => { expect(results.filter(row => /^B/.test(row.caseId))).toHaveLength(13); });
  for (const row of results) it(`${row.caseId} ${row.name}: PASS`, () => { expect(row, `${row.expected} ≠ ${row.obtained}`).toMatchObject({ pass: true }); });
});
