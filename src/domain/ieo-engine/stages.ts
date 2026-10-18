import { Rational } from "./rational";
import { gapClass, healthLevel, trafficLight, type GapClass, type HealthLevel, type TrafficLight } from "./classify";
import type { ElementCode } from "@/domain/survey/elements";

// Pure stages of the official sequence (S02 §17, S03 §2):
// VALIDATE → RECODE → EXCLUDE N/A → COVERAGE 60 % → CONVERT 0–100 → PI → RP → BT → RI → IEO.
export type PerspectiveCode = "DIR" | "ESP" | "LID" | "COL" | "CLI";
export type Orientation = "DIRECT" | "REVERSE";
/** Raw stored answer: 1–5, NA, or null when the item was omitted (MISSING). */
export type RawAnswer = 1 | 2 | 3 | 4 | 5 | "NA" | null;
export class EngineInputError extends Error {}

// ── Item level (T01–T05) ────────────────────────────────────────────────────────────────
export type ScoredResponse = Readonly<{ raw: RawAnswer; status: "VALID" | "EXCLUDED" | "MISSING"; isNA: boolean; recoded: number | null; score100: Rational | null }>;
export function scoreResponse(raw: unknown, orientation: Orientation, allowNA: boolean): ScoredResponse {
  if (raw === null || raw === undefined) return { raw: null, status: "MISSING", isNA: false, recoded: null, score100: null };
  if (raw === "NA") {
    if (!allowNA) throw new EngineInputError("N/A no permitido en este reactivo.");
    return { raw: "NA", status: "EXCLUDED", isNA: true, recoded: null, score100: null };
  }
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) throw new EngineInputError(`Respuesta fuera de escala: ${String(raw)}`);
  const recoded = orientation === "REVERSE" ? 6 - raw : raw; // L_inv = 6 − L; the raw answer is never modified
  return { raw: raw as RawAnswer, status: "VALID", isNA: false, recoded, score100: Rational.of(25 * (recoded - 1)) };
}

// ── Coverage (T06, T06N, T07; GAP-006) ─────────────────────────────────────────────────
export type Coverage = Readonly<{ totalItems: number; validItems: number; naItems: number; missingItems: number; applicableItems: number; coverage: Rational | null; coverageStatus: "SUFFICIENT" | "INSUFFICIENT" | "NOT_CALCULABLE" }>;
export function elementCoverage(statuses: readonly ScoredResponse["status"][]): Coverage {
  const validItems = statuses.filter(status => status === "VALID").length;
  const naItems = statuses.filter(status => status === "EXCLUDED").length;
  const applicableItems = statuses.length - naItems;
  // valid / applicable ≥ 60 %, compared on integers so exactly 60 % never fails by rounding.
  const coverageStatus = applicableItems === 0 ? "NOT_CALCULABLE" : validItems * 5 >= applicableItems * 3 ? "SUFFICIENT" : "INSUFFICIENT";
  return { totalItems: statuses.length, validItems, naItems, missingItems: statuses.length - validItems - naItems, applicableItems, coverage: applicableItems === 0 ? null : Rational.of(validItems, applicableItems), coverageStatus };
}

// ── PI (T08, T09) ───────────────────────────────────────────────────────────────────────
export type IndividualScore = Readonly<{ pi: Rational | null; status: "VALID" | "ND"; reason: null | "INSUFFICIENT_COVERAGE" | "ALL_NA" }>;
export function individualScore(coverage: Coverage, scores: readonly Rational[]): IndividualScore {
  if (coverage.coverageStatus === "NOT_CALCULABLE") return { pi: null, status: "ND", reason: "ALL_NA" };
  if (coverage.coverageStatus === "INSUFFICIENT") return { pi: null, status: "ND", reason: "INSUFFICIENT_COVERAGE" };
  if (scores.length !== coverage.validItems) throw new EngineInputError("PI: puntajes y cobertura no coinciden.");
  return { pi: Rational.mean(scores), status: "VALID", reason: null }; // every valid item weighs the same
}

// ── RP (T10, T11) ───────────────────────────────────────────────────────────────────────
export type PerspectiveScope = "APPLICABLE" | "NOT_APPLICABLE" | "NOT_AVAILABLE";
export type PerspectiveResult = Readonly<{ rp: Rational | null; status: "VALID" | "ND" | "NP"; validPiCount: number; reason: null | "NOT_APPLIED" | "NOT_AVAILABLE" | "QUALITY_C" | "NO_VALID_PI" }>;
/** Mean of the valid PI of one perspective in one Element; people weigh the same regardless of answered items. */
export function perspectiveResult(scope: PerspectiveScope, qualityC: boolean, pis: readonly Rational[]): PerspectiveResult {
  if (scope === "NOT_APPLICABLE") return { rp: null, status: "NP", validPiCount: 0, reason: "NOT_APPLIED" };
  if (scope === "NOT_AVAILABLE") return { rp: null, status: "ND", validPiCount: 0, reason: "NOT_AVAILABLE" };
  if (qualityC) return { rp: null, status: "ND", validPiCount: pis.length, reason: "QUALITY_C" }; // GAP-009 (provisional)
  if (!pis.length) return { rp: null, status: "ND", validPiCount: 0, reason: "NO_VALID_PI" };
  return { rp: Rational.mean(pis), status: "VALID", validPiCount: pis.length, reason: null };
}

// ── BT (T12–T17) ────────────────────────────────────────────────────────────────────────
export type ValidRp = Readonly<{ perspectiveCode: PerspectiveCode; rp: Rational }>;
export type TriangulationGap = Readonly<{ gap: Rational | null; status: "NOT_CALCULABLE" | "PARTIAL" | "INTEGRATED"; validPerspectiveCount: number; maxPerspectives: PerspectiveCode[]; minPerspectives: PerspectiveCode[]; displayGap: number | null; gapClass: GapClass | null }>;
export function triangulationGap(rps: readonly ValidRp[]): TriangulationGap {
  if (rps.length < 2) return { gap: null, status: "NOT_CALCULABLE", validPerspectiveCount: rps.length, maxPerspectives: [], minPerspectives: [], displayGap: null, gapClass: null };
  const max = rps.reduce((best, row) => (row.rp.compare(best) > 0 ? row.rp : best), rps[0].rp);
  const min = rps.reduce((best, row) => (row.rp.compare(best) < 0 ? row.rp : best), rps[0].rp);
  const gap = max.sub(min);
  const displayGap = gap.roundHalfDown();
  return {
    gap, status: rps.length === 2 ? "PARTIAL" : "INTEGRATED", validPerspectiveCount: rps.length,
    maxPerspectives: rps.filter(row => row.rp.equals(max)).map(row => row.perspectiveCode), // ties keep every perspective
    minPerspectives: rps.filter(row => row.rp.equals(min)).map(row => row.perspectiveCode),
    displayGap, gapClass: gapClass(displayGap),
  };
}

// ── RI (T18, T19) ───────────────────────────────────────────────────────────────────────
export type IntegratedResult = Readonly<{ ri: Rational | null; status: "INTEGRATED" | "LIMITED" | "ND"; validPerspectiveCount: number; perspectives: PerspectiveCode[] }>;
/** Simple mean of valid RP: every perspective weighs the same, never weighted by sample size. */
export function integratedResult(rps: readonly ValidRp[]): IntegratedResult {
  const perspectives = rps.map(row => row.perspectiveCode);
  if (!rps.length) return { ri: null, status: "ND", validPerspectiveCount: 0, perspectives };
  return { ri: Rational.mean(rps.map(row => row.rp)), status: rps.length >= 2 ? "INTEGRATED" : "LIMITED", validPerspectiveCount: rps.length, perspectives };
}

// ── Indexes (T20, T21; GAP-008 provisional) ────────────────────────────────────────────
export type Classified = Readonly<{ displayScore: number; health: HealthLevel; light: TrafficLight }>;
function classified(value: Rational): Classified { const displayScore = value.roundHalfDown(); return { displayScore, health: healthLevel(displayScore), light: trafficLight(displayScore) }; }

export type PerspectiveIndex = Readonly<{ value: Rational | null; status: "COMPLETE" | "ND" | "NP"; validElementCount: number; classification: Classified | null }>;
/** IEO of one perspective: mean of its eight RP, only when all eight are valid. */
export function perspectiveIndex(results: readonly PerspectiveResult[]): PerspectiveIndex {
  if (results.length !== 8) throw new EngineInputError("El índice por perspectiva requiere los ocho Elementos.");
  if (results.every(row => row.status === "NP")) return { value: null, status: "NP", validElementCount: 0, classification: null };
  const valid = results.filter(row => row.status === "VALID").map(row => row.rp!);
  if (valid.length < 8) return { value: null, status: "ND", validElementCount: valid.length, classification: null };
  const value = Rational.mean(valid);
  return { value, status: "COMPLETE", validElementCount: 8, classification: classified(value) };
}

export type ElementRi = Readonly<{ elementCode: ElementCode; result: IntegratedResult }>;
export type GlobalIndex = Readonly<{ value: Rational | null; status: "COMPLETE" | "LIMITED" | "ND"; integratedElementCount: number; elementsWithResult: number; limitedElements: ElementCode[]; reason: null | "ELEMENT_WITHOUT_EVIDENCE" | "NO_INTEGRATED_ELEMENT"; classification: Classified | null }>;
/** IEO Global: equal-weight mean of the eight RI (S03 §12). Never computed over fewer than eight Elements. */
export function globalIndex(elements: readonly ElementRi[]): GlobalIndex {
  if (elements.length !== 8) throw new EngineInputError("El IEO Global requiere los ocho Elementos.");
  const withResult = elements.filter(row => row.result.status !== "ND");
  const integrated = elements.filter(row => row.result.status === "INTEGRATED");
  const limitedElements = elements.filter(row => row.result.status === "LIMITED").map(row => row.elementCode);
  const base = { integratedElementCount: integrated.length, elementsWithResult: withResult.length, limitedElements };
  if (withResult.length < 8) return { ...base, value: null, status: "ND", reason: "ELEMENT_WITHOUT_EVIDENCE", classification: null };
  if (!integrated.length) return { ...base, value: null, status: "ND", reason: "NO_INTEGRATED_ELEMENT", classification: null };
  const value = Rational.mean(elements.map(row => row.result.ri!));
  return { ...base, value, status: integrated.length === 8 ? "COMPLETE" : "LIMITED", reason: null, classification: classified(value) };
}
