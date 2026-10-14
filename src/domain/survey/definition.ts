import type { ElementCode } from "./elements";

// Renderer-facing survey definition. It never carries scoring metadata (orientation, weights).
export type SurveyItem = Readonly<{
  key: string;
  type: "LIKERT" | "TEXT";
  text: string;
  order: number;
  /** Official visible number of a quantitative item (1…n in the printed instrument). */
  number?: number;
  allowNA: boolean;
  elementCode: ElementCode | null;
}>;
export type SurveySection = Readonly<{
  id: string;
  label: string | null;
  title: string;
  elementCode: ElementCode | null;
  introduction: string | null;
  instructions: string | null;
  items: readonly SurveyItem[];
}>;
export type SurveyDefinition = Readonly<{
  code: string;
  version: string;
  title: string;
  scale: readonly Readonly<{ value: "1" | "2" | "3" | "4" | "5" | "NA"; label: string }>[];
  sections: readonly SurveySection[];
}>;
export type SurveyAnswer = Readonly<{ itemKey: string; answerState: "MISSING" | "VALUE" | "NA"; numericValue?: number | null; textValue?: string | null }>;
export type ValidAnswer = Readonly<{ item: SurveyItem; answerState: "MISSING" | "VALUE" | "NA"; numericValue: number | null; textValue: string | null }>;

export class SurveyAnswerError extends Error {}
export const OPEN_TEXT_MAX = 4000;

export function surveyItems(definition: SurveyDefinition) { return definition.sections.flatMap(section => section.items); }

/** Validates one answer against its item. Values are kept raw: no recoding, no scoring. */
export function validateAnswer(definition: SurveyDefinition, input: SurveyAnswer, items = new Map(surveyItems(definition).map(item => [item.key, item]))): ValidAnswer {
  const item = items.get(input.itemKey);
  if (!item) throw new SurveyAnswerError("Ítem desconocido.");
  if (input.answerState === "MISSING") {
    if (input.numericValue != null || input.textValue != null) throw new SurveyAnswerError("Respuesta ausente incompatible.");
    return { item, answerState: "MISSING", numericValue: null, textValue: null };
  }
  if (input.answerState === "NA") {
    if (item.type !== "LIKERT" || !item.allowNA || input.numericValue != null || input.textValue != null) throw new SurveyAnswerError("N/A no permitido.");
    return { item, answerState: "NA", numericValue: null, textValue: null };
  }
  if (item.type === "LIKERT") {
    const value = input.numericValue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5 || input.textValue != null) throw new SurveyAnswerError("Valor fuera de escala.");
    return { item, answerState: "VALUE", numericValue: value, textValue: null };
  }
  if (typeof input.textValue !== "string" || input.textValue.length > OPEN_TEXT_MAX || input.numericValue != null) throw new SurveyAnswerError("Texto inválido.");
  return input.textValue.trim() === "" ? { item, answerState: "MISSING", numericValue: null, textValue: null } : { item, answerState: "VALUE", numericValue: null, textValue: input.textValue };
}
