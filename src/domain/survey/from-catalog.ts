import type { InstrumentCatalog } from "./catalog";
import type { SurveyDefinition } from "./definition";

/** Projects an instrument catalog into the renderer definition. Orientation and source metadata stay server-side. */
export function definitionFromCatalog(catalog: Pick<InstrumentCatalog, "instrumentCode" | "version" | "title" | "scale" | "sections" | "questions">): SurveyDefinition {
  return {
    code: catalog.instrumentCode,
    version: catalog.version,
    title: catalog.title,
    scale: catalog.scale.map(option => ({ value: option.valueCode, label: option.label })),
    sections: [...catalog.sections].sort((a, b) => a.displayOrder - b.displayOrder).map(section => ({
      id: `S${section.displayOrder}`,
      label: section.label,
      title: section.title,
      elementCode: section.elementCode,
      introduction: section.introduction,
      instructions: section.instructions,
      items: catalog.questions.filter(question => question.sectionOrder === section.displayOrder).sort((a, b) => a.displayOrder - b.displayOrder).map(question => ({
        key: question.code,
        type: question.kind === "QUANT" ? "LIKERT" as const : "TEXT" as const,
        text: question.text,
        order: question.displayOrder,
        ...(question.kind === "QUANT" ? { number: question.officialOrder } : {}),
        allowNA: question.allowNA,
        elementCode: question.elementCode,
      })),
    })),
  };
}
