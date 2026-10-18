import { z } from "zod";
import { CHECKLIST_ITEMS } from "./checklist";

const text = (max: number) => z.string().trim().min(1).max(max);
const perspective = z.enum(["DIR", "ESP", "LID", "COL", "CLI"]);
const element = z.enum(["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"]);
export const exclusionReasons = { DUPLICATE: "Duplicado o envío repetido", TEST_RESPONSE: "Respuesta de prueba", OUT_OF_POPULATION: "Fuera de la población definida", TECHNICAL_INCIDENT: "Incidencia técnica", REPORTED_MANIPULATION: "Presión o manipulación reportada" } as const;

export const reopenSchema = z.object({ reason: text(2000) }).strict();
export const exclusionSchema = z.object({ invitationId: z.uuid(), reasonCode: z.enum(Object.keys(exclusionReasons) as [keyof typeof exclusionReasons, ...(keyof typeof exclusionReasons)[]]), description: text(2000) }).strict();
export const incidentSchema = z.object({ occurredOn: z.iso.date(), perspectiveCode: perspective.nullable(), description: text(2000), impact: text(2000), action: text(2000), responsible: text(160) }).strict();
export const qualitySchema = z.object({
  perspectiveCode: perspective.nullable(),
  elementCode: element.nullable(),
  verdict: z.enum(["A", "B", "C"]),
  reservations: z.string().trim().max(4000).nullable(),
}).strict().superRefine((data, context) => {
  if (data.elementCode && !data.perspectiveCode) context.addIssue({ code: "custom", path: ["elementCode"], message: "El dictamen por Elemento requiere perspectiva." });
  if (data.verdict !== "A" && !data.reservations) context.addIssue({ code: "custom", path: ["reservations"], message: "B y C requieren reservas." });
});
export const checklistSchema = z.object({
  items: z.array(z.object({ item: z.number().int().min(1).max(CHECKLIST_ITEMS.length), answer: z.enum(["YES", "NO", "NA"]), observation: z.string().trim().max(2000).nullable() }).strict()).length(CHECKLIST_ITEMS.length),
}).strict().superRefine((data, context) => {
  if (new Set(data.items.map(row => row.item)).size !== CHECKLIST_ITEMS.length) context.addIssue({ code: "custom", path: ["items"], message: "Cada criterio una sola vez." });
});
export const qualityScopeKey = (perspectiveCode: string | null, elementCode: string | null) => perspectiveCode ? (elementCode ? `P:${perspectiveCode}:${elementCode}` : `P:${perspectiveCode}`) : "GLOBAL";
