export type AssessmentStatus = "DRAFT" | "OPEN" | "CLOSED" | "FROZEN" | "PROCESSED";
export type LifecycleAction = "OPEN" | "CLOSE" | "REOPEN" | "FREEZE" | "PROCESS";

// Phase 5B lifecycle (PHASE5B_DECISIONS.md). Reopening creates the next revision and returns to OPEN.
const ALLOWED: Record<LifecycleAction, readonly AssessmentStatus[]> = {
  OPEN: ["DRAFT"],
  CLOSE: ["OPEN"],
  REOPEN: ["CLOSED", "FROZEN", "PROCESSED"],
  FREEZE: ["CLOSED"],
  PROCESS: ["FROZEN", "PROCESSED"],
};
export function canPerform(action: LifecycleAction, status: AssessmentStatus) { return ALLOWED[action].includes(status); }
export const statusLabel: Record<AssessmentStatus, string> = { DRAFT: "Borrador", OPEN: "Abierto", CLOSED: "Cerrado", FROZEN: "Congelado", PROCESSED: "Procesado" };

/** Participants may save and submit only while OPEN and before the planned close date, if one is set. */
export function acceptsResponses(assessment: { status: string; plannedClosesAt: Date | null }, now = new Date()) {
  return assessment.status === "OPEN" && (!assessment.plannedClosesAt || now < assessment.plannedClosesAt);
}
