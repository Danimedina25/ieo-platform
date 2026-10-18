import { sha256Canonical } from "@/domain/canonical";
import { elementCodes, type ElementCode } from "@/domain/survey/elements";
import {
  EngineInputError, elementCoverage, globalIndex, individualScore, integratedResult, perspectiveIndex, perspectiveResult, scoreResponse, triangulationGap,
  type Coverage, type GlobalIndex, type IndividualScore, type IntegratedResult, type Orientation, type PerspectiveCode, type PerspectiveIndex,
  type PerspectiveResult, type PerspectiveScope, type RawAnswer, type ScoredResponse, type TriangulationGap, type ValidRp,
} from "./stages";

export const ENGINE_VERSION = "1.0.0";
// Versions of the methodological rules applied; a change from the custodian publishes new versions, never rewrites runs.
export const ENGINE_POLICIES = {
  model: "Modelo Matemático Oficial IEO 1.1",
  coverage: "GAP-004/GAP-006 2026-10-14: ≥60 % válidos por Elemento, N/A fuera del denominador, todo N/A = ND",
  rounding: "GAP-007 2026-10-16/17: entero sólo al final, .5 exacto baja; clasificación con el entero (BT provisional)",
  partialResults: "GAP-008 provisional 2026-10-17",
  quality: "GAP-009 provisional 2026-10-17: dictamen C → RP ND (QUALITY_C)",
} as const;
const PERSPECTIVES: readonly PerspectiveCode[] = ["DIR", "ESP", "LID", "COL", "CLI"];

export type EngineInput = Readonly<{
  instruments: readonly Readonly<{ instrumentCode: string; version: string; perspectiveCode: PerspectiveCode; questions: readonly Readonly<{ code: string; elementCode: ElementCode; orientation: Orientation; allowNA: boolean }>[] }>[];
  /** Scope of all five perspectives; qualityC marks a dictamen C for the whole perspective or for listed Elements. */
  perspectives: readonly Readonly<{ perspectiveCode: PerspectiveCode; scope: PerspectiveScope; qualityC?: boolean; qualityCElements?: readonly ElementCode[] }>[];
  /** Submitted sessions only (GAP-005). Omitted items may be absent or null. */
  sessions: readonly Readonly<{ sessionId: string; perspectiveCode: PerspectiveCode; answers: Readonly<Record<string, RawAnswer>> }>[];
}>;

export type SessionElementResult = Readonly<{ sessionId: string; perspectiveCode: PerspectiveCode; elementCode: ElementCode; coverage: Coverage; score: IndividualScore; items: readonly (ScoredResponse & { code: string })[] }>;
export type EngineOutput = Readonly<{
  engineVersion: string;
  policies: typeof ENGINE_POLICIES;
  inputHash: string;
  sessionElements: readonly SessionElementResult[];
  perspectiveElements: readonly (PerspectiveResult & { perspectiveCode: PerspectiveCode; elementCode: ElementCode; sessionIds: readonly string[] })[];
  perspectiveIndexes: readonly (PerspectiveIndex & { perspectiveCode: PerspectiveCode })[];
  gaps: readonly (TriangulationGap & { elementCode: ElementCode })[];
  integrated: readonly (IntegratedResult & { elementCode: ElementCode })[];
  global: GlobalIndex;
  outputHash: string;
}>;

/** Deterministic run: the same input and engine version always yield the same output and outputHash. */
export function runEngine(input: EngineInput): EngineOutput {
  const scopes = new Map(input.perspectives.map(row => [row.perspectiveCode, row]));
  if (scopes.size !== 5 || PERSPECTIVES.some(code => !scopes.has(code))) throw new EngineInputError("Se requiere el alcance de las cinco perspectivas.");
  const instruments = new Map(input.instruments.map(row => [row.perspectiveCode, row]));
  const seen = new Set<string>();

  // VALIDATE → RECODE → EXCLUDE N/A → COVERAGE → CONVERT → PI, per session and Element.
  const sessionElements: SessionElementResult[] = [];
  for (const session of [...input.sessions].sort((a, b) => a.sessionId.localeCompare(b.sessionId))) {
    if (seen.has(session.sessionId)) throw new EngineInputError(`Sesión duplicada: ${session.sessionId}`);
    seen.add(session.sessionId);
    if (scopes.get(session.perspectiveCode)!.scope !== "APPLICABLE") throw new EngineInputError(`Sesión ${session.sessionId} en una perspectiva fuera del alcance.`);
    const instrument = instruments.get(session.perspectiveCode);
    if (!instrument) throw new EngineInputError(`Sin instrumento para ${session.perspectiveCode}.`);
    const known = new Set(instrument.questions.map(question => question.code));
    const unknown = Object.keys(session.answers).filter(code => !known.has(code));
    if (unknown.length) throw new EngineInputError(`Sesión ${session.sessionId}: reactivos ajenos al instrumento (${unknown.join(", ")}).`);
    for (const elementCode of elementCodes) {
      const questions = instrument.questions.filter(question => question.elementCode === elementCode);
      if (!questions.length) throw new EngineInputError(`${instrument.instrumentCode} no tiene reactivos en ${elementCode}.`);
      const items = questions.map(question => {
        try { return { code: question.code, ...scoreResponse(session.answers[question.code] ?? null, question.orientation, question.allowNA) }; }
        catch (error) { throw new EngineInputError(`Sesión ${session.sessionId}, ${question.code}: ${(error as Error).message}`); }
      });
      const coverage = elementCoverage(items.map(item => item.status));
      sessionElements.push({ sessionId: session.sessionId, perspectiveCode: session.perspectiveCode, elementCode, coverage, score: individualScore(coverage, items.flatMap(item => (item.score100 ? [item.score100] : []))), items });
    }
  }

  // RP per perspective × Element (40 positions, including NP/ND).
  const perspectiveElements = PERSPECTIVES.flatMap(perspectiveCode => elementCodes.map(elementCode => {
    const scope = scopes.get(perspectiveCode)!;
    const valid = sessionElements.filter(row => row.perspectiveCode === perspectiveCode && row.elementCode === elementCode && row.score.status === "VALID");
    const qualityC = !!scope.qualityC || !!scope.qualityCElements?.includes(elementCode);
    return { perspectiveCode, elementCode, ...perspectiveResult(scope.scope, qualityC, valid.map(row => row.score.pi!)), sessionIds: valid.map(row => row.sessionId) };
  }));
  const perspectiveIndexes = PERSPECTIVES.map(perspectiveCode => ({ perspectiveCode, ...perspectiveIndex(perspectiveElements.filter(row => row.perspectiveCode === perspectiveCode)) }));

  // BT and RI per Element over the valid RP only.
  const validRps = (elementCode: ElementCode): ValidRp[] => perspectiveElements.filter(row => row.elementCode === elementCode && row.status === "VALID").map(row => ({ perspectiveCode: row.perspectiveCode, rp: row.rp! }));
  const gaps = elementCodes.map(elementCode => ({ elementCode, ...triangulationGap(validRps(elementCode)) }));
  const integrated = elementCodes.map(elementCode => ({ elementCode, ...integratedResult(validRps(elementCode)) }));
  const global = globalIndex(integrated.map(row => ({ elementCode: row.elementCode, result: row })));

  // Input hash over a normalized order, so the same data in another order identifies the same run input.
  const normalized = { ...input, instruments: [...input.instruments].sort((a, b) => a.perspectiveCode.localeCompare(b.perspectiveCode)), perspectives: [...input.perspectives].sort((a, b) => a.perspectiveCode.localeCompare(b.perspectiveCode)), sessions: [...input.sessions].sort((a, b) => a.sessionId.localeCompare(b.sessionId)) };
  const body = { engineVersion: ENGINE_VERSION, policies: ENGINE_POLICIES, inputHash: sha256Canonical(normalized), sessionElements, perspectiveElements, perspectiveIndexes, gaps, integrated, global };
  return { ...body, outputHash: sha256Canonical(body) };
}
