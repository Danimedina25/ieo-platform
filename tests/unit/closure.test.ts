import { describe, expect, it } from "vitest";
import { acceptsResponses, canPerform } from "@/domain/closure/lifecycle";
import { buildSnapshot, engineInputFromSnapshot, type SnapshotSource } from "@/domain/closure/snapshot";
import { checklistSchema, exclusionSchema, qualitySchema, qualityScopeKey } from "@/domain/closure/schemas";
import { CHECKLIST_ITEMS } from "@/domain/closure/checklist";
import { engineInstrument, runEngine } from "@/domain/ieo-engine";
import { officialCatalogs } from "@/infrastructure/catalog/load";

describe("lifecycle transitions", () => {
  it("allows only the documented transitions", () => {
    const statuses = ["DRAFT", "OPEN", "CLOSED", "FROZEN", "PROCESSED"] as const;
    const table = Object.fromEntries((["OPEN", "CLOSE", "REOPEN", "FREEZE", "PROCESS"] as const).map(action => [action, statuses.filter(status => canPerform(action, status))]));
    expect(table).toEqual({ OPEN: ["DRAFT"], CLOSE: ["OPEN"], REOPEN: ["CLOSED", "FROZEN", "PROCESSED"], FREEZE: ["CLOSED"], PROCESS: ["FROZEN", "PROCESSED"] });
  });
  it("accepts responses only while OPEN and before the planned close", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(acceptsResponses({ status: "OPEN", plannedClosesAt: null }, now)).toBe(true);
    expect(acceptsResponses({ status: "OPEN", plannedClosesAt: new Date("2026-10-18T12:00:01Z") }, now)).toBe(true);
    expect(acceptsResponses({ status: "OPEN", plannedClosesAt: now }, now)).toBe(false);
    expect(acceptsResponses({ status: "DRAFT", plannedClosesAt: null }, now)).toBe(false);
    expect(acceptsResponses({ status: "CLOSED", plannedClosesAt: null }, now)).toBe(false);
  });
});

const col = officialCatalogs.find(item => item.perspectiveCode === "COL")!;
function source(overrides: Partial<SnapshotSource> = {}): SnapshotSource {
  const responses = (value: number) => [
    ...col.questions.filter(question => question.kind === "QUANT").map(question => ({ itemKey: question.code, itemType: "LIKERT" as const, answerState: "VALUE" as const, numericValue: value })),
    { itemKey: "COL_E01_O01", itemType: "TEXT" as const, answerState: "VALUE" as const, numericValue: null },
  ];
  return {
    assessment: { id: "a", revisionNumber: 1, isTest: true },
    methodologyPackage: { code: "IEO", version: "1.0" },
    instruments: officialCatalogs.map(catalog => ({ ...engineInstrument(catalog), contentHash: catalog.contentHash })),
    scopes: (["DIR", "ESP", "LID", "COL", "CLI"] as const).map(code => ({ perspectiveCode: code, applicability: code === "COL" ? "APPLICABLE" as const : "NOT_APPLICABLE" as const })),
    verdicts: [{ perspectiveCode: null, elementCode: null, verdict: "A" }, { perspectiveCode: "COL", elementCode: null, verdict: "A" }, { perspectiveCode: "COL", elementCode: "E02", verdict: "C" }],
    submitted: [{ sessionId: "s2", perspectiveCode: "COL", responses: responses(4) }, { sessionId: "s1", perspectiveCode: "COL", responses: responses(2) }, { sessionId: "s3", perspectiveCode: "COL", responses: responses(5) }],
    excludedSessionIds: ["s3"],
    ...overrides,
  };
}
describe("frozen snapshot", () => {
  it("keeps submitted, non-excluded sessions with raw quantitative answers only, in a stable order", () => {
    const { payload } = buildSnapshot(source());
    expect(payload.sessions.map(row => row.sessionId)).toEqual(["s1", "s2"]);
    expect(payload.excludedSessionIds).toEqual(["s3"]);
    expect(Object.keys(payload.sessions[0].answers)).not.toContain("COL_E01_O01");
    expect(payload.sessions[0].answers.COL_E01_R009).toBe(2); // raw, never recoded
    expect(payload.perspectives.find(row => row.perspectiveCode === "COL")).toMatchObject({ qualityC: false, qualityCElements: ["E02"] });
  });
  it("produces the same hash for the same data in any order", () => {
    const first = buildSnapshot(source());
    const second = buildSnapshot(source({ submitted: [...source().submitted].reverse(), instruments: [...source().instruments].reverse() }));
    expect(second.sha256).toBe(first.sha256);
  });
  it("requires the global verdict and one per applicable perspective", () => {
    expect(() => buildSnapshot(source({ verdicts: [{ perspectiveCode: "COL", elementCode: null, verdict: "A" }] }))).toThrow(/global/);
    expect(() => buildSnapshot(source({ verdicts: [{ perspectiveCode: null, elementCode: null, verdict: "A" }] }))).toThrow(/COL/);
  });
  it("feeds the engine: an Element-level C leaves that RP as ND", () => {
    const output = runEngine(engineInputFromSnapshot(buildSnapshot(source()).payload));
    const rp = (element: string) => output.perspectiveElements.find(row => row.perspectiveCode === "COL" && row.elementCode === element)!;
    expect(rp("E02")).toMatchObject({ status: "ND", reason: "QUALITY_C" });
    expect(rp("E01")).toMatchObject({ status: "VALID", validPiCount: 2 });
  });
});
describe("closure inputs", () => {
  it("validates checklist, verdicts and exclusions", () => {
    const items = CHECKLIST_ITEMS.map((_, index) => ({ item: index + 1, answer: "YES" as const, observation: null }));
    expect(checklistSchema.safeParse({ items }).success).toBe(true);
    expect(checklistSchema.safeParse({ items: [...items.slice(0, 15), { ...items[0] }] }).success).toBe(false);
    expect(qualitySchema.safeParse({ perspectiveCode: null, elementCode: null, verdict: "B", reservations: null }).success).toBe(false);
    expect(qualitySchema.safeParse({ perspectiveCode: null, elementCode: "E01", verdict: "A", reservations: null }).success).toBe(false);
    expect(exclusionSchema.safeParse({ invitationId: "00000000-0000-4000-8000-000000000000", reasonCode: "EXTREME_ANSWER", description: "x" }).success).toBe(false);
    expect([qualityScopeKey(null, null), qualityScopeKey("DIR", null), qualityScopeKey("DIR", "E03")]).toEqual(["GLOBAL", "P:DIR", "P:DIR:E03"]);
  });
});
