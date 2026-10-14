import { z } from "zod";
import { OPEN_TEXT_MAX } from "./definition";
// Shape only; each answer is validated against the session's own definition in the application layer.
export const surveyAnswerSchema = z.object({
  itemKey: z.string().min(1).max(64),
  answerState: z.enum(["MISSING", "VALUE", "NA"]),
  numericValue: z.number().int().nullable().optional(),
  textValue: z.string().max(OPEN_TEXT_MAX).nullable().optional(),
}).strict();
export const patchSurveySchema = z.object({
  expectedRevision: z.number().int().min(0),
  answers: z.array(surveyAnswerSchema).min(1).max(120),
}).strict().superRefine((data, context) => {
  const seen = new Set<string>();
  for (const [index, answer] of data.answers.entries()) {
    if (seen.has(answer.itemKey)) context.addIssue({ code: "custom", path: ["answers", index, "itemKey"], message: "Ítem repetido." });
    seen.add(answer.itemKey);
  }
});
export const submitSurveySchema = z.object({ expectedRevision: z.number().int().min(0) }).strict();
