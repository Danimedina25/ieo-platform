import { sha256Canonical } from "@/domain/canonical";

import type { ElementCode } from "./elements";
export { elementCodes, type ElementCode } from "./elements";

export type CatalogSection = Readonly<{
  displayOrder: number;
  elementCode: ElementCode | null;
  label: string;
  title: string;
  introduction: string | null;
  instructions: string | null;
}>;
export type CatalogQuestion = Readonly<{
  code: string;
  kind: "QUANT" | "OPEN";
  sectionOrder: number;
  elementCode: ElementCode | null;
  text: string;
  orientation: "DIRECT" | "REVERSE" | null;
  allowNA: boolean;
  officialOrder: number;
  orderInElement: number | null;
  displayOrder: number;
  sourceGlobalId: number | null;
  sourceOfficialCode: string | null;
  sourceLocator: string;
}>;
export type InstrumentCatalog = Readonly<{
  instrumentCode: string;
  version: string;
  perspectiveCode: "DIR" | "ESP" | "LID" | "COL" | "CLI";
  title: string;
  certified: boolean;
  sources: readonly Readonly<{ role: string; file: string; sha256: string }>[];
  corrections: readonly Readonly<{ code: string; field: "text"; dictionaryValue: string; appliedValue: string; reference: string }>[];
  intro: Readonly<{ presentation: string; objective: string; confidentiality: string; audience: string; instructions: string }>;
  scale: readonly Readonly<{ valueCode: "1" | "2" | "3" | "4" | "5" | "NA"; label: string }>[];
  sections: readonly CatalogSection[];
  questions: readonly CatalogQuestion[];
  thanks: string;
}>;

/** SHA-256 of the canonical JSON content; identifies an immutable instrument version. */
export function catalogContentHash(catalog: InstrumentCatalog) { return sha256Canonical(catalog); }
