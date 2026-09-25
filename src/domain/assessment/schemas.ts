import { z } from "zod";

export const perspectiveCodes = ["DIR", "ESP", "LID", "COL", "CLI"] as const;
export const perspectiveCodeSchema = z.enum(perspectiveCodes);
const requiredText = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) => z.union([z.string().trim().max(max), z.null()]).transform(value => value === "" ? null : value);
const nullableId = z.uuid().nullable();
const utcDate = z.union([z.iso.datetime({ offset: true }).refine(value => value.endsWith("Z")), z.null()]);
const timezone = z.union([z.string().max(64).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
}), z.null()]);

export const createAssessmentSchema = z.object({
  organization: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("existing"), id: z.uuid() }).strict(),
    z.object({ kind: z.literal("new"), name: requiredText(160) }).strict(),
  ]),
  name: requiredText(160),
  period: requiredText(80),
  objective: nullableText(4000).default(null),
}).strict();

export const updateGeneralSchema = z.object({
  name: requiredText(160),
  period: requiredText(80),
  objective: nullableText(4000),
  timezone,
  plannedOpensAt: utcDate,
  plannedClosesAt: utcDate,
  scopeUnitsText: nullableText(4000),
  sponsorName: nullableText(160),
  consultantUserId: nullableId,
  coordinatorUserId: nullableId,
  methodologyNotes: nullableText(4000),
}).strict().superRefine((data, context) => {
  if (data.plannedOpensAt && data.plannedClosesAt && Date.parse(data.plannedOpensAt) >= Date.parse(data.plannedClosesAt)) {
    context.addIssue({ code: "custom", path: ["plannedClosesAt"], message: "El cierre previsto debe ser posterior a la apertura." });
  }
});

export const configurePerspectiveSchema = z.object({
  applicability: z.enum(["APPLICABLE", "NOT_APPLICABLE", "NOT_AVAILABLE"]).nullable(),
  populationEstimate: z.number().int().min(0).max(2_147_483_647).nullable(),
  collectionMode: z.enum(["CENSUS", "SAMPLE"]).nullable(),
  notes: nullableText(4000),
  cliUnitType: z.enum(["B2B", "B2C"]).nullable(),
}).strict().superRefine((data, context) => {
  if (data.applicability !== "APPLICABLE" && (data.populationEstimate !== null || data.collectionMode !== null)) {
    context.addIssue({ code: "custom", path: ["applicability"], message: "Población y plan requieren una perspectiva aplicable." });
  }
});

export const segmentSchema = z.object({
  dimension: requiredText(80),
  label: requiredText(160),
  reportabilityStatus: z.enum(["PENDING", "REPORTABLE", "NOT_REPORTABLE"]),
  reason: nullableText(4000),
}).strict();

export function validatePerspectiveForCode(code: string, input: unknown) {
  const perspectiveCode = perspectiveCodeSchema.parse(code);
  const data = configurePerspectiveSchema.parse(input);
  if (perspectiveCode !== "CLI" && data.cliUnitType !== null) throw new z.ZodError([{ code: "custom", path: ["cliUnitType"], message: "La unidad B2B/B2C sólo corresponde a CLI." }]);
  return { perspectiveCode, data };
}
