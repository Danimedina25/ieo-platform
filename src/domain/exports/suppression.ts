// Report variant of EXP03: applies the consultant's disclosure decisions (Protocolo §13). A non-reportable perspective
// is suppressed (its RP and its index), and so is every integrated value that would reveal it: the RI and BT of the
// Elements it takes part in and, if any of those is suppressed, the Global (a mean of the eight RI).
type Perspective = "DIR" | "ESP" | "LID" | "COL" | "CLI";
export type SuppressionInput = Readonly<{ hidden: readonly Perspective[]; elements: readonly Readonly<{ elementCode: string; perspectives: readonly Perspective[] }>[] }>;
export function suppressionPlan(input: SuppressionInput) {
  const hidden = new Set(input.hidden);
  const elements = new Set(input.elements.filter(row => row.perspectives.some(code => hidden.has(code))).map(row => row.elementCode));
  return { perspectives: hidden, elements, global: elements.size > 0 };
}
export const SUPPRESSED = "SUPRIMIDO_POR_DIVULGACION";
