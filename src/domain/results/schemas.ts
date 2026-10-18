import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
const element = z.enum(["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"]);
const perspective = z.enum(["DIR", "ESP", "LID", "COL", "CLI"]);
export const patternSchema = z.object({ runId: z.uuid(), elementCode: element, patternCode: z.enum(["CONSISTENT_STRENGTH", "CONSISTENT_EROSION", "PERCEPTION_GAP", "MIXED_RESULT", "LIMITED_EVIDENCE"]), justification: text(4000) }).strict();
export const disclosureSchema = z.object({ runId: z.uuid(), perspectiveCode: perspective, decision: z.enum(["REPORTABLE", "NOT_REPORTABLE"]), reason: text(2000) }).strict();
export const qualitativeReviewSchema = z.object({ runId: z.uuid(), surveyResponseId: z.uuid(), status: z.enum(["REVIEW_PENDING", "SAFE_FOR_REPORT", "REDACTED", "DO_NOT_QUOTE"]), redactedText: z.string().trim().max(4000).nullable() }).strict()
  .superRefine((data, context) => { if ((data.status === "REDACTED") !== !!data.redactedText) context.addIssue({ code: "custom", path: ["redactedText"], message: "El texto redactado sólo aplica, y es obligatorio, en estado redactada." }); });
export const qualitativeFilterSchema = z.object({ runId: z.uuid(), perspectiveCode: perspective.nullable(), elementCode: element.nullable() }).strict();
