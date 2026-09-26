import { z } from "zod";
import { technicalItems, validateTechnicalAnswer, type SurveyAnswer } from "./fixtures/technical-survey-v1";
export const surveyAnswerSchema = z.object({
  itemKey: z.string().max(64),
  answerState: z.enum(["MISSING", "VALUE", "NA"]),
  numericValue: z.number().int().nullable().optional(),
  textValue: z.string().max(4000).nullable().optional(),
}).strict();
export const patchSurveySchema = z.object({
  expectedRevision: z.number().int().min(0),
  answers: z.array(surveyAnswerSchema).min(1).max(technicalItems.length),
}).strict().superRefine((data, context) => {
  const seen = new Set<string>();
  for (const [index, answer] of data.answers.entries()) {
    if (seen.has(answer.itemKey)) context.addIssue({ code: "custom", path: ["answers", index, "itemKey"], message: "Ítem repetido." });
    seen.add(answer.itemKey);
    try { validateTechnicalAnswer(answer as SurveyAnswer); }
    catch { context.addIssue({ code: "custom", path: ["answers", index], message: "Respuesta técnica inválida." }); }
  }
});
export const submitSurveySchema = z.object({ expectedRevision: z.number().int().min(0) }).strict();
