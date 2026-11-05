import type { AssessmentStatus } from "./lifecycle";

// What the consultant should do next, derived from the same preconditions the lifecycle enforces
// (openAssessment, freezeAssessment) plus the interpretation work after processing.
type Perspective = "DIR" | "ESP" | "LID" | "COL" | "CLI";
export type GuidanceTab = "general" | "perspectivas" | "participantes" | "cierre" | "resultados" | "exportaciones";
export type GuidanceInput = Readonly<{
  status: AssessmentStatus;
  perspectives: readonly Readonly<{ perspectiveCode: Perspective; applicability: string | null }>[];
  invitations: number; submitted: number;
  globalVerdict: boolean; missingVerdicts: readonly Perspective[]; checklistComplete: boolean;
  run: Readonly<{ publishable: boolean; patterns: number; disclosures: number }> | null;
}>;
export type Guidance = Readonly<{ title: string; detail: string; pending: readonly string[]; tab: GuidanceTab; action: string }>;

export const STAGES: readonly Readonly<{ status: AssessmentStatus; label: string; description: string }>[] = [
  { status: "DRAFT", label: "Preparar", description: "Datos, perspectivas y participantes" },
  { status: "OPEN", label: "Responder", description: "Los participantes contestan" },
  { status: "CLOSED", label: "Documentar cierre", description: "Calidad, incidencias y checklist" },
  { status: "FROZEN", label: "Calcular", description: "Datos congelados, listos para procesar" },
  { status: "PROCESSED", label: "Interpretar", description: "Resultados y exportaciones" },
];
const NAMES: Record<Perspective, string> = { DIR: "Dirección", ESP: "Especialistas", LID: "Liderazgo", COL: "Colaboradores", CLI: "Voz del Cliente" };
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function nextStep(input: GuidanceInput): Guidance {
  const applicable = input.perspectives.filter(row => row.applicability === "APPLICABLE").length;
  switch (input.status) {
    case "DRAFT": {
      const unclassified = 5 - input.perspectives.filter(row => row.applicability).length;
      const pending = [
        ...(unclassified ? [`Clasifica las cinco perspectivas (${unclassified === 1 ? "falta 1" : `faltan ${unclassified}`}).`] : []),
        ...(!unclassified && !applicable ? ["Marca al menos una perspectiva como aplicable."] : []),
        ...(!input.invitations ? ["Agrega a los participantes en la pestaña Participantes."] : []),
      ];
      if (pending.length) return { title: "Prepara el diagnóstico", detail: "Antes de abrir la aplicación completa lo siguiente:", pending, tab: unclassified || !applicable ? "perspectivas" : "participantes", action: unclassified || !applicable ? "Ir a Perspectivas" : "Ir a Participantes" };
      return { title: "Abre la aplicación", detail: `Todo está listo. Al abrir se enviarán ${plural(input.invitations, "invitación", "invitaciones")} por correo y los participantes podrán responder.`, pending: [], tab: "cierre", action: "Ir a Cierre" };
    }
    case "OPEN":
      return { title: "Recibiendo respuestas", detail: `${input.submitted} de ${plural(input.invitations, "persona invitada", "personas invitadas")} ya ${input.submitted === 1 ? "envió" : "enviaron"} su cuestionario. Cuando termine el periodo de aplicación, cierra la aplicación.`, pending: [], tab: "cierre", action: "Ir a Cierre" };
    case "CLOSED": {
      const pending = [
        ...(!input.globalVerdict ? ["Registra el dictamen de calidad global."] : []),
        ...(input.missingVerdicts.length ? [`Registra el dictamen de calidad de: ${input.missingVerdicts.map(code => NAMES[code]).join(", ")}.`] : []),
        ...(!input.checklistComplete ? ["Contesta y guarda el checklist oficial de 16 puntos."] : []),
      ];
      if (pending.length) return { title: "Documenta el cierre", detail: "Para poder congelar los datos falta:", pending, tab: "cierre", action: "Ir a Cierre" };
      return { title: "Congela los datos", detail: "El cierre está documentado. Si hubo incidencias o cuestionarios que excluir, regístralos antes; después congela y autoriza el procesamiento.", pending: [], tab: "cierre", action: "Ir a Cierre" };
    }
    case "FROZEN":
      return { title: "Procesa los resultados", detail: "Los datos están congelados. Procesa para calcular los resultados con el Modelo Matemático oficial.", pending: [], tab: "cierre", action: "Ir a Cierre" };
    case "PROCESSED": {
      if (input.run && !input.run.publishable) return { title: "Resultados no publicables", detail: "El dictamen global de calidad es C: los resultados quedan como evidencia insuficiente. Revisa el dictamen o reabre el diagnóstico si es necesario.", pending: [], tab: "cierre", action: "Ir a Cierre" };
      const patterns = 8 - (input.run?.patterns ?? 0);
      const disclosures = applicable - (input.run?.disclosures ?? 0);
      const pending = [
        ...(patterns > 0 ? [`Registra el patrón de triangulación de ${plural(patterns, "Elemento", "Elementos")}.`] : []),
        ...(disclosures > 0 ? [`Revisa qué se puede reportar en ${plural(disclosures, "perspectiva", "perspectivas")}.`] : []),
      ];
      if (pending.length) return { title: "Interpreta los resultados", detail: "Los resultados están calculados. Falta tu lectura como consultor:", pending, tab: "resultados", action: "Ir a Resultados" };
      return { title: "Interpretación completa", detail: "Ya puedes descargar las exportaciones para tu reporte.", pending: [], tab: "exportaciones", action: "Ir a Exportaciones" };
    }
  }
}
