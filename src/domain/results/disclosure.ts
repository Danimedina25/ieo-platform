// Disclosure warnings (Protocolo §13, Especificaciones §41): advice for the consultant, never an automatic rule.
// Hiding a perspective never changes RI, BT or Global; it only limits what is reported.
export const FEW_PEOPLE_THRESHOLD = 3;
type Perspective = "DIR" | "ESP" | "LID" | "COL" | "CLI";
export type DisclosureInput = Readonly<{
  perspectiveElements: readonly Readonly<{ perspectiveCode: Perspective; elementCode: string; status: string; validPiCount: number }>[];
  elements: readonly Readonly<{ elementCode: string; riStatus: string; perspectives: readonly Perspective[]; btStatus: string }>[];
  hidden: readonly Perspective[];
}>;
export type DisclosureWarning = Readonly<{ perspectiveCode: Perspective; kind: "FEW_PEOPLE" | "DEDUCIBLE_FROM_INTEGRATION"; elements: string[] }>;

export function disclosureWarnings(input: DisclosureInput): DisclosureWarning[] {
  const warnings: DisclosureWarning[] = [];
  for (const perspectiveCode of ["DIR", "ESP", "LID", "COL", "CLI"] as const) {
    const few = input.perspectiveElements.filter(row => row.perspectiveCode === perspectiveCode && row.status === "VALID" && row.validPiCount < FEW_PEOPLE_THRESHOLD).map(row => row.elementCode);
    if (few.length) warnings.push({ perspectiveCode, kind: "FEW_PEOPLE", elements: few });
    // RI = mean of the valid RP: with the other RP visible, a hidden RP is recoverable as k·RI − Σ others (and with
    // two perspectives, BT also reveals it). Any reported RI/BT that includes a hidden perspective discloses it.
    if (input.hidden.includes(perspectiveCode)) {
      const deducible = input.elements.filter(row => row.riStatus === "INTEGRATED" && row.perspectives.includes(perspectiveCode)).map(row => row.elementCode);
      if (deducible.length) warnings.push({ perspectiveCode, kind: "DEDUCIBLE_FROM_INTEGRATION", elements: deducible });
    }
  }
  return warnings;
}
