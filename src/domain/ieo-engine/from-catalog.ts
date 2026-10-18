import type { InstrumentCatalog } from "@/domain/survey/catalog";
import type { EngineInput } from "./run";

/** Engine view of an instrument: quantitative items with Element, orientation and N/A rule. Open questions never enter. */
export function engineInstrument(catalog: Pick<InstrumentCatalog, "instrumentCode" | "version" | "perspectiveCode" | "questions">): EngineInput["instruments"][number] {
  return {
    instrumentCode: catalog.instrumentCode,
    version: catalog.version,
    perspectiveCode: catalog.perspectiveCode,
    questions: catalog.questions.filter(question => question.kind === "QUANT").map(question => ({ code: question.code, elementCode: question.elementCode!, orientation: question.orientation!, allowNA: question.allowNA })),
  };
}
