import { describe, expect, it } from "vitest";
import { EngineInputError, Rational, engineInstrument, gapClass, healthLevel, runEngine, trafficLight, triangulationGap, globalIndex, type EngineInput, type RawAnswer } from "@/domain/ieo-engine";
import { officialCatalogs } from "@/infrastructure/catalog/load";
import { elementCodes } from "@/domain/survey/elements";

type Code = "DIR" | "ESP" | "LID" | "COL" | "CLI";
const catalog = (code: Code) => officialCatalogs.find(item => item.perspectiveCode === code)!;
const instruments = officialCatalogs.map(engineInstrument);
const quant = (code: Code) => catalog(code).questions.filter(question => question.kind === "QUANT");
/** Every quantitative item answered with `value`; reverse items get 6 − value so every score is the same. */
function uniform(code: Code, value: 1 | 2 | 3 | 4 | 5): Record<string, RawAnswer> {
  return Object.fromEntries(quant(code).map(question => [question.code, (question.orientation === "REVERSE" ? 6 - value : value) as RawAnswer]));
}
function input(scope: Partial<Record<Code, EngineInput["perspectives"][number]["scope"]>>, sessions: EngineInput["sessions"], extra: Partial<Record<Code, { qualityC?: boolean; qualityCElements?: ("E01" | "E08")[] }>> = {}): EngineInput {
  return { instruments, perspectives: (["DIR", "ESP", "LID", "COL", "CLI"] as const).map(code => ({ perspectiveCode: code, scope: scope[code] ?? "APPLICABLE", ...extra[code] })), sessions };
}
const all = (value: 1 | 2 | 3 | 4 | 5) => (["DIR", "ESP", "LID", "COL", "CLI"] as const).flatMap(code => [1, 2].map(n => ({ sessionId: `${code}-${n}`, perspectiveCode: code, answers: uniform(code, value) })));

describe("exact arithmetic and final rounding (GAP-007)", () => {
  it("rounds only at the end and an exact .5 goes down", () => {
    expect(Rational.fromDecimal("79.5").roundHalfDown()).toBe(79);
    expect(Rational.fromDecimal("79.6").roundHalfDown()).toBe(80);
    expect(Rational.fromDecimal("79.51").roundHalfDown()).toBe(80);
    expect(Rational.of(159, 2).roundHalfDown()).toBe(79);
  });
  it("classifies on the rounded integer: 79.5 → Estable con riesgos, 79.6 → Saludable", () => {
    const at = (text: string) => globalIndex(elementCodes.map(elementCode => ({ elementCode, result: { ri: Rational.fromDecimal(text), status: "INTEGRATED", validPerspectiveCount: 2, perspectives: [] } }))).classification!;
    expect(at("79.5")).toMatchObject({ displayScore: 79, health: { label: "Estable con riesgos", level: 4 }, light: "YELLOW" });
    expect(at("79.6")).toMatchObject({ displayScore: 80, health: { label: "Saludable", level: 5 }, light: "LIGHT_GREEN" });
  });
  it("applies the same rule to BT: 12.5 → 12, 12.6 → 13", () => {
    const gap = (high: string) => triangulationGap([{ perspectiveCode: "DIR", rp: Rational.fromDecimal(high) }, { perspectiveCode: "COL", rp: Rational.of(70) }]);
    expect(gap("82.5")).toMatchObject({ displayGap: 12, gapClass: "HIGH_CONVERGENCE", status: "PARTIAL" });
    expect(gap("82.6")).toMatchObject({ displayGap: 13, gapClass: "MODERATE_DIFFERENCE" });
  });
  it("keeps T21 exact with true fractions instead of rounded decimals", () => {
    const ris = [Rational.of(200, 3), Rational.of(500, 7), Rational.of(220, 3), Rational.of(700, 9), Rational.of(1400, 17), Rational.of(260, 3), Rational.of(640, 7), Rational.of(850, 9)];
    const value = globalIndex(elementCodes.map((elementCode, index) => ({ elementCode, result: { ri: ris[index], status: "INTEGRATED", validPerspectiveCount: 2, perspectives: [] } }))).value!;
    expect(Math.abs(value.toNumber() - 80.512371615325)).toBeLessThan(0.000001);
    expect(value.toDecimal(4)).not.toBe("80.5125");
  });
  it("covers every scale boundary", () => {
    expect([0, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 94, 95, 100].map(score => healthLevel(score).level)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7]);
    expect([59, 60, 69, 70, 79, 80, 89, 90].map(trafficLight)).toEqual(["RED", "ORANGE", "ORANGE", "YELLOW", "YELLOW", "LIGHT_GREEN", "LIGHT_GREEN", "DARK_GREEN"]);
    expect([0, 12, 13, 24, 25, 37, 38, 100].map(gapClass)).toEqual(["HIGH_CONVERGENCE", "HIGH_CONVERGENCE", "MODERATE_DIFFERENCE", "MODERATE_DIFFERENCE", "RELEVANT_GAP", "RELEVANT_GAP", "CRITICAL_GAP", "CRITICAL_GAP"]);
  });
});

describe("runEngine over the five official instruments", () => {
  it("full diagnosis: 40 RP, 8 integrated Elements and a COMPLETE Global", () => {
    const out = runEngine(input({}, all(4)));
    expect(out.perspectiveElements).toHaveLength(40);
    expect(out.perspectiveElements.every(row => row.status === "VALID" && row.rp!.equals(Rational.of(75)))).toBe(true);
    expect(out.gaps.every(row => row.status === "INTEGRATED" && row.gap!.equals(Rational.of(0)) && row.gapClass === "HIGH_CONVERGENCE")).toBe(true);
    expect(out.integrated.every(row => row.status === "INTEGRATED" && row.validPerspectiveCount === 5)).toBe(true);
    expect(out.perspectiveIndexes.every(row => row.status === "COMPLETE" && row.value!.equals(Rational.of(75)))).toBe(true);
    expect(out.global).toMatchObject({ status: "COMPLETE", integratedElementCount: 8, classification: { displayScore: 75, health: { label: "Estable con riesgos" }, light: "YELLOW" } });
  });
  it("recodes COL reverse items and keeps the raw answer", () => {
    const answers = { ...uniform("COL", 3) };
    for (const question of quant("COL").filter(item => item.elementCode === "E01")) answers[question.code] = 5;
    const out = runEngine(input({ DIR: "NOT_APPLICABLE", ESP: "NOT_APPLICABLE", LID: "NOT_APPLICABLE", CLI: "NOT_APPLICABLE" }, [{ sessionId: "c1", perspectiveCode: "COL", answers }]));
    const e01 = out.sessionElements.find(row => row.elementCode === "E01")!;
    const reverse = e01.items.find(item => item.code === "COL_E01_R009")!;
    expect(reverse).toMatchObject({ raw: 5, recoded: 1, status: "VALID" });
    expect(reverse.score100!.equals(Rational.of(0))).toBe(true);
    expect(e01.score.pi!.equals(Rational.of(800, 9))).toBe(true); // (8 × 100 + 0) / 9, exact
  });
  it("excludes N/A from the denominator, treats omissions as missing and an all-N/A Element as ND", () => {
    const answers: Record<string, RawAnswer> = { ...uniform("COL", 4) };
    const e01 = quant("COL").filter(item => item.elementCode === "E01");
    e01.slice(0, 4).forEach(item => (answers[item.code] = "NA"));
    const e02 = quant("COL").filter(item => item.elementCode === "E02");
    e02.slice(0, 4).forEach(item => delete answers[item.code]);
    quant("COL").filter(item => item.elementCode === "E08").forEach(item => (answers[item.code] = "NA"));
    const out = runEngine(input({ DIR: "NOT_APPLICABLE", ESP: "NOT_APPLICABLE", LID: "NOT_APPLICABLE", CLI: "NOT_APPLICABLE" }, [{ sessionId: "c1", perspectiveCode: "COL", answers }]));
    const row = (code: string) => out.sessionElements.find(item => item.elementCode === code)!;
    expect(row("E01").coverage).toMatchObject({ applicableItems: 5, naItems: 4, coverageStatus: "SUFFICIENT" });
    expect(row("E02").coverage).toMatchObject({ applicableItems: 9, missingItems: 4, validItems: 5, coverageStatus: "INSUFFICIENT" });
    expect(row("E02").score).toMatchObject({ status: "ND", reason: "INSUFFICIENT_COVERAGE", pi: null });
    expect(row("E08").coverage).toMatchObject({ coverageStatus: "NOT_CALCULABLE", coverage: null });
    expect(row("E08").score).toMatchObject({ status: "ND", reason: "ALL_NA" });
  });
  it("distinguishes NP (not applied), ND not available and ND without valid PI", () => {
    const sessions = all(4).filter(row => row.perspectiveCode === "DIR" || row.perspectiveCode === "COL");
    const out = runEngine(input({ CLI: "NOT_APPLICABLE", ESP: "NOT_AVAILABLE" }, sessions));
    const status = (code: Code) => out.perspectiveElements.find(row => row.perspectiveCode === code && row.elementCode === "E01")!;
    expect(status("CLI")).toMatchObject({ status: "NP", reason: "NOT_APPLIED", rp: null });
    expect(status("ESP")).toMatchObject({ status: "ND", reason: "NOT_AVAILABLE" });
    expect(status("LID")).toMatchObject({ status: "ND", reason: "NO_VALID_PI" });
    expect(out.perspectiveIndexes.find(row => row.perspectiveCode === "CLI")!.status).toBe("NP");
    expect(out.gaps[0]).toMatchObject({ status: "PARTIAL", validPerspectiveCount: 2 });
    expect(out.global.status).toBe("COMPLETE");
  });
  it("dictamen C removes a perspective from RP, BT, RI and Global (GAP-009)", () => {
    const sessions = all(4).map(row => (row.perspectiveCode === "DIR" ? { ...row, answers: uniform("DIR", 1) } : row));
    const out = runEngine(input({}, sessions, { DIR: { qualityC: true } }));
    expect(out.perspectiveElements.filter(row => row.perspectiveCode === "DIR").every(row => row.status === "ND" && row.reason === "QUALITY_C")).toBe(true);
    expect(out.integrated.every(row => row.ri!.equals(Rational.of(75)) && !row.perspectives.includes("DIR"))).toBe(true);
    expect(out.global.value!.equals(Rational.of(75))).toBe(true);
  });
  it("Global LIMITED when an Element keeps a single perspective; ND when an Element has none (GAP-008)", () => {
    const sessions = all(4).filter(row => row.perspectiveCode === "DIR" || row.perspectiveCode === "COL");
    const scope = { ESP: "NOT_APPLICABLE", LID: "NOT_APPLICABLE", CLI: "NOT_APPLICABLE" } as const;
    const limited = runEngine(input(scope, sessions, { DIR: { qualityCElements: ["E08"] } }));
    expect(limited.integrated.find(row => row.elementCode === "E08")).toMatchObject({ status: "LIMITED", perspectives: ["COL"] });
    expect(limited.global).toMatchObject({ status: "LIMITED", limitedElements: ["E08"], classification: { displayScore: 75 } });
    expect(limited.perspectiveIndexes.find(row => row.perspectiveCode === "DIR")).toMatchObject({ status: "ND", validElementCount: 7 });
    const colAllNa = sessions.map(row => row.perspectiveCode === "COL" ? { ...row, answers: { ...row.answers, ...Object.fromEntries(quant("COL").filter(item => item.elementCode === "E08").map(item => [item.code, "NA" as const])) } } : row);
    const none = runEngine(input(scope, colAllNa, { DIR: { qualityCElements: ["E08"] } }));
    expect(none.integrated.find(row => row.elementCode === "E08")!.status).toBe("ND");
    expect(none.global).toMatchObject({ status: "ND", reason: "ELEMENT_WITHOUT_EVIDENCE", value: null, classification: null });
  });
  it("a single-perspective diagnosis has no Global but keeps that perspective's IEO", () => {
    const out = runEngine(input({ DIR: "NOT_APPLICABLE", ESP: "NOT_APPLICABLE", LID: "NOT_APPLICABLE", CLI: "NOT_APPLICABLE" }, all(5).filter(row => row.perspectiveCode === "COL")));
    expect(out.integrated.every(row => row.status === "LIMITED")).toBe(true);
    expect(out.global).toMatchObject({ status: "ND", reason: "NO_INTEGRATED_ELEMENT", value: null });
    expect(out.perspectiveIndexes.find(row => row.perspectiveCode === "COL")).toMatchObject({ status: "COMPLETE", classification: { displayScore: 100, health: { label: "Ejemplar" } } });
  });
  it("lists every perspective tied at the maximum or minimum", () => {
    const sessions = all(4).map(row => (row.perspectiveCode === "DIR" || row.perspectiveCode === "ESP" ? { ...row, answers: uniform(row.perspectiveCode, 5) } : row));
    expect(runEngine(input({}, sessions)).gaps[0]).toMatchObject({ maxPerspectives: ["DIR", "ESP"], minPerspectives: ["LID", "COL", "CLI"], displayGap: 25, gapClass: "RELEVANT_GAP" });
  });
  it("with no submitted questionnaires everything is ND and nothing is fabricated", () => {
    const out = runEngine(input({}, []));
    expect(out.perspectiveElements.every(row => row.status === "ND" && row.rp === null)).toBe(true);
    expect(out.global).toMatchObject({ status: "ND", value: null });
  });
  it("is deterministic: same data in any order gives the same output hash", () => {
    const first = runEngine(input({}, all(3)));
    const second = runEngine(input({}, [...all(3)].reverse()));
    expect(second.outputHash).toBe(first.outputHash);
    expect(second.inputHash).toBe(first.inputHash);
    expect(runEngine(input({}, all(4))).outputHash).not.toBe(first.outputHash);
    expect(first.engineVersion).toBe("1.0.0");
  });
  it("refuses invalid input with an explicit error instead of a fabricated ND", () => {
    const base = all(4);
    expect(() => runEngine(input({}, [...base, { sessionId: "x", perspectiveCode: "DIR", answers: { DIR_E01_R001: "NA" } }]))).toThrow(EngineInputError);
    expect(() => runEngine(input({}, [{ sessionId: "x", perspectiveCode: "COL", answers: { COL_E01_R001: 6 as RawAnswer } }]))).toThrow(/fuera de escala/);
    expect(() => runEngine(input({}, [{ sessionId: "x", perspectiveCode: "COL", answers: { DIR_E01_R001: 3 } }]))).toThrow(/ajenos/);
    expect(() => runEngine(input({ CLI: "NOT_APPLICABLE" }, [{ sessionId: "x", perspectiveCode: "CLI", answers: {} }]))).toThrow(/fuera del alcance/);
    expect(() => runEngine(input({}, [base[0], base[0]]))).toThrow(/duplicada/);
    expect(() => runEngine({ ...input({}, []), perspectives: [] })).toThrow(/cinco perspectivas/);
  });
});
