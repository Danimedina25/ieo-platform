// Official scales of the Modelo Matemático 1.1 (S03 §§10, 14, 15), applied to the final integer
// produced by Rational.roundHalfDown (GAP-007). Codes follow S12 `06_BT` and `08_GLOBAL`.
export type HealthLevel = Readonly<{ level: 1 | 2 | 3 | 4 | 5 | 6 | 7; label: string; state: string }>;
export type TrafficLight = "RED" | "ORANGE" | "YELLOW" | "LIGHT_GREEN" | "DARK_GREEN";
export type GapClass = "HIGH_CONVERGENCE" | "MODERATE_DIFFERENCE" | "RELEVANT_GAP" | "CRITICAL_GAP";

const HEALTH: readonly (HealthLevel & { from: number })[] = [
  { from: 95, level: 7, label: "Ejemplar", state: "Organización Ejemplar" },
  { from: 90, level: 6, label: "Muy saludable", state: "Organización Muy Saludable" },
  { from: 80, level: 5, label: "Saludable", state: "Organización Saludable" },
  { from: 70, level: 4, label: "Estable con riesgos", state: "Organización Estable con Riesgos" },
  { from: 60, level: 3, label: "En erosión", state: "Organización en Proceso de Erosión" },
  { from: 50, level: 2, label: "Erosión importante", state: "Organización con Erosión Importante" },
  { from: 0, level: 1, label: "Crítico", state: "Organización en Estado Crítico" },
];
const LIGHTS: readonly { from: number; light: TrafficLight }[] = [{ from: 90, light: "DARK_GREEN" }, { from: 80, light: "LIGHT_GREEN" }, { from: 70, light: "YELLOW" }, { from: 60, light: "ORANGE" }, { from: 0, light: "RED" }];
const GAPS: readonly { from: number; gapClass: GapClass }[] = [{ from: 38, gapClass: "CRITICAL_GAP" }, { from: 25, gapClass: "RELEVANT_GAP" }, { from: 13, gapClass: "MODERATE_DIFFERENCE" }, { from: 0, gapClass: "HIGH_CONVERGENCE" }];

function assertScore(value: number) { if (!Number.isInteger(value) || value < 0 || value > 100) throw new RangeError(`Puntuación fuera de 0–100: ${value}`); }
export function healthLevel(score: number): HealthLevel { assertScore(score); const { level, label, state } = HEALTH.find(row => score >= row.from)!; return { level, label, state }; }
export function trafficLight(score: number): TrafficLight { assertScore(score); return LIGHTS.find(row => score >= row.from)!.light; }
export function gapClass(gap: number): GapClass { assertScore(gap); return GAPS.find(row => gap >= row.from)!.gapClass; }
