import { sha256Canonical } from "@/domain/canonical";
import type { EngineInput } from "@/domain/ieo-engine/run";
import type { RawAnswer } from "@/domain/ieo-engine/stages";
import type { ElementCode } from "@/domain/survey/elements";

export const SNAPSHOT_SCHEMA_VERSION = 1;
type Perspective = EngineInput["perspectives"][number]["perspectiveCode"];
export type SnapshotPayload = Readonly<{
  schemaVersion: number;
  assessment: Readonly<{ id: string; revisionNumber: number; isTest: boolean }>;
  methodologyPackage: Readonly<{ code: string; version: string }>;
  instruments: readonly (EngineInput["instruments"][number] & { contentHash: string })[];
  perspectives: EngineInput["perspectives"];
  globalVerdict: "A" | "B" | "C";
  /** Submitted, non-excluded sessions only (GAP-005, GAP-010). No identity, no open text. */
  sessions: EngineInput["sessions"];
  excludedSessionIds: readonly string[];
}>;

export type SnapshotSource = Readonly<{
  assessment: SnapshotPayload["assessment"];
  methodologyPackage: SnapshotPayload["methodologyPackage"];
  instruments: SnapshotPayload["instruments"];
  scopes: readonly Readonly<{ perspectiveCode: Perspective; applicability: "APPLICABLE" | "NOT_APPLICABLE" | "NOT_AVAILABLE" }>[];
  verdicts: readonly Readonly<{ perspectiveCode: Perspective | null; elementCode: ElementCode | null; verdict: "A" | "B" | "C" }>[];
  submitted: readonly Readonly<{ sessionId: string; perspectiveCode: Perspective; responses: readonly Readonly<{ itemKey: string; itemType: "LIKERT" | "TEXT"; answerState: "MISSING" | "VALUE" | "NA"; numericValue: number | null }>[] }>[];
  excludedSessionIds: readonly string[];
}>;

/** Builds the canonical frozen payload: quantitative raw answers by item code, scope, verdicts and versions. */
export function buildSnapshot(source: SnapshotSource): { payload: SnapshotPayload; sha256: string } {
  const excluded = new Set(source.excludedSessionIds);
  const globalVerdict = source.verdicts.find(row => !row.perspectiveCode)?.verdict;
  if (!globalVerdict) throw new Error("Falta el dictamen global.");
  const perspectives = [...source.scopes].sort((a, b) => a.perspectiveCode.localeCompare(b.perspectiveCode)).map(scope => {
    const own = source.verdicts.filter(row => row.perspectiveCode === scope.perspectiveCode);
    if (scope.applicability === "APPLICABLE" && !own.some(row => !row.elementCode)) throw new Error(`Falta el dictamen de ${scope.perspectiveCode}.`);
    return {
      perspectiveCode: scope.perspectiveCode, scope: scope.applicability,
      qualityC: own.some(row => !row.elementCode && row.verdict === "C"),
      qualityCElements: own.filter(row => row.elementCode && row.verdict === "C").map(row => row.elementCode!).sort(),
    };
  });
  const sessions = source.submitted.filter(session => !excluded.has(session.sessionId)).sort((a, b) => a.sessionId.localeCompare(b.sessionId)).map(session => ({
    sessionId: session.sessionId,
    perspectiveCode: session.perspectiveCode,
    answers: Object.fromEntries(session.responses.filter(row => row.itemType === "LIKERT" && row.answerState !== "MISSING").sort((a, b) => a.itemKey.localeCompare(b.itemKey))
      .map(row => [row.itemKey, (row.answerState === "NA" ? "NA" : row.numericValue) as RawAnswer])),
  }));
  const payload: SnapshotPayload = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION, assessment: source.assessment, methodologyPackage: source.methodologyPackage,
    instruments: [...source.instruments].sort((a, b) => a.perspectiveCode.localeCompare(b.perspectiveCode)),
    perspectives, globalVerdict, sessions, excludedSessionIds: [...excluded].sort(),
  };
  return { payload, sha256: sha256Canonical(payload) };
}
/** Engine input taken only from the frozen payload (Protocolo §17: closed → frozen → authorized processing). */
export function engineInputFromSnapshot(payload: SnapshotPayload): EngineInput {
  return { instruments: payload.instruments.map(item => ({ instrumentCode: item.instrumentCode, version: item.version, perspectiveCode: item.perspectiveCode, questions: item.questions })), perspectives: payload.perspectives, sessions: payload.sessions };
}
