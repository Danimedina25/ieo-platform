// Protocolo Oficial de Aplicación v1.0, Anexo D — Checklist Oficial de Aplicación (16 criterios).
export const CHECKLIST_ITEMS = [
  "El alcance fue definido antes del levantamiento.",
  "Las perspectivas fueron clasificadas como aplicables, no aplicables o no disponibles.",
  "Las poblaciones fueron validadas.",
  "Se utilizó la versión oficial de cada instrumento.",
  "Se realizó la prueba técnica.",
  "Los participantes recibieron información suficiente.",
  "La participación fue voluntaria.",
  "Se protegió la confidencialidad.",
  "N/A funcionó conforme al modelo.",
  "Las incidencias fueron documentadas.",
  "Se revisó la distribución de participación.",
  "Se protegieron segmentos potencialmente identificables.",
  "Las respuestas inválidas fueron tratadas mediante reglas documentadas.",
  "Se determinó la calidad por perspectiva.",
  "Se elaboró el Acta de Cierre.",
  "Los datos están listos para transferirse al Modelo Matemático.",
] as const;
export type ChecklistAnswer = Readonly<{ item: number; answer: "YES" | "NO" | "NA"; observation: string | null }>;
