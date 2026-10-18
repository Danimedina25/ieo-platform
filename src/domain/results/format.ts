import { Rational } from "@/domain/ieo-engine/rational";

// Presentation only (Modelo §13): RP/RI with one decimal, BT and Global as integers, same tie rule as the
// engine (an exact .5 rounds down, GAP-007). Never used as input to any calculation.
export function parseExact(exact: string | null) {
  if (!exact) return null;
  const [num, den] = exact.split("/");
  return Rational.of(BigInt(num), BigInt(den ?? "1"));
}
export function oneDecimal(exact: string | null) {
  const value = parseExact(exact);
  if (!value) return null;
  const tenths = value.mul(10).roundHalfDown();
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}
export function integer(exact: string | null) { const value = parseExact(exact); return value ? value.roundHalfDown() : null; }

export const PERSPECTIVE_NAMES = { DIR: "Dirección", ESP: "Especialistas", LID: "Liderazgo", COL: "Colaboradores", CLI: "Voz del Cliente" } as const;
export const ELEMENT_NAMES = { E01: "Valor Diferenciador", E02: "Ejecución y Resultados", E03: "Dirección y Propósito", E04: "Liderazgo e Inspiración", E05: "Pasión y Compromiso Humano", E06: "Credibilidad y Reputación", E07: "Sensibilidad hacia el Cliente", E08: "Innovación y Adaptación" } as const;
export const REASON_LABELS: Record<string, string> = {
  NOT_APPLIED: "NP — perspectiva no aplicada", NOT_AVAILABLE: "ND — perspectiva no disponible", QUALITY_C: "ND — dictamen C", NO_VALID_PI: "ND — sin evidencia suficiente",
  ELEMENT_WITHOUT_EVIDENCE: "algún Elemento sin evidencia", NO_INTEGRATED_ELEMENT: "ningún Elemento con dos o más perspectivas (se reporta el índice de la perspectiva)",
};
export const GAP_CLASS_LABELS: Record<string, string> = { HIGH_CONVERGENCE: "Alta convergencia", MODERATE_DIFFERENCE: "Diferencia moderada", RELEVANT_GAP: "Brecha relevante", CRITICAL_GAP: "Brecha crítica" };
export const LIGHT_LABELS: Record<string, string> = { DARK_GREEN: "Verde oscuro", LIGHT_GREEN: "Verde claro", YELLOW: "Amarillo", ORANGE: "Naranja", RED: "Rojo" };
export const HEALTH_LABELS: Record<number, string> = { 1: "Crítico", 2: "Erosión importante", 3: "En erosión", 4: "Estable con riesgos", 5: "Saludable", 6: "Muy saludable", 7: "Ejemplar" };
export const PATTERN_LABELS = { CONSISTENT_STRENGTH: "Fortaleza consistente", CONSISTENT_EROSION: "Erosión consistente", PERCEPTION_GAP: "Brecha de percepción", MIXED_RESULT: "Resultado mixto", LIMITED_EVIDENCE: "Cobertura limitada / evidencia insuficiente" } as const;
export const QUALITATIVE_LABELS = { REVIEW_PENDING: "Pendiente", SAFE_FOR_REPORT: "Apta para reporte", REDACTED: "Redactada", DO_NOT_QUOTE: "No citar" } as const;
