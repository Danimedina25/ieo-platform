import { sha256Canonical } from "@/domain/canonical";
import { CHECKLIST_ITEMS, type ChecklistAnswer } from "./checklist";
import { exclusionReasons } from "./schemas";

type Perspective = "DIR" | "ESP" | "LID" | "COL" | "CLI";
const NAMES: Record<Perspective, string> = { DIR: "Dirección", ESP: "Especialistas", LID: "Liderazgo", COL: "Colaboradores", CLI: "Voz del Cliente" };
export type ActaSource = Readonly<{
  organization: string; assessment: string; period: string; revisionNumber: number; isTest: boolean;
  objective: string | null; scopeUnits: string | null; sponsor: string | null;
  instruments: readonly Readonly<{ perspectiveCode: Perspective; instrumentCode: string; version: string; contentHash: string }>[];
  openedAt: Date; closedAt: Date;
  participation: readonly Readonly<{ perspectiveCode: Perspective; applicability: "APPLICABLE" | "NOT_APPLICABLE" | "NOT_AVAILABLE"; invited: number; submitted: number; drafts: number; excluded: number }>[];
  verdicts: readonly Readonly<{ perspectiveCode: Perspective | null; elementCode: string | null; verdict: "A" | "B" | "C"; reservations: string | null }>[];
  incidents: readonly Readonly<{ occurredOn: string; perspectiveCode: Perspective | null; description: string; impact: string; action: string; responsible: string }>[];
  exclusions: readonly Readonly<{ perspectiveCode: Perspective; reasonCode: keyof typeof exclusionReasons; description: string }>[];
  checklist: readonly ChecklistAnswer[];
  consultant: Readonly<{ name: string | null; email: string }>;
  authorizedAt: Date;
}>;

/** Acta Oficial de Cierre del Levantamiento (Protocolo, Anexo E) as a stable structure with its hash. No participant identity. */
export function buildActa(source: ActaSource) {
  const perspectiveVerdict = (code: Perspective) => source.verdicts.find(row => row.perspectiveCode === code && !row.elementCode);
  const listOf = (predicate: (row: ActaSource["participation"][number]) => boolean) => source.participation.filter(predicate).map(row => NAMES[row.perspectiveCode]);
  const acta = {
    titulo: "Acta Oficial de Cierre del Levantamiento",
    prueba: source.isTest ? "PRUEBA — datos ficticios; no constituye una aplicación oficial del IEO®" : null,
    organizacion: source.organization,
    diagnostico: source.assessment,
    periodo: source.period,
    revision: source.revisionNumber,
    alcanceFinal: { objetivo: source.objective, unidades: source.scopeUnits, sponsor: source.sponsor, perspectivas: source.participation.map(row => ({ perspectiva: NAMES[row.perspectiveCode], clasificacion: row.applicability })) },
    instrumentos: source.instruments.map(row => ({ perspectiva: NAMES[row.perspectiveCode], instrumento: row.instrumentCode, version: row.version, hash: row.contentHash })),
    fechaApertura: source.openedAt.toISOString(),
    fechaCierre: source.closedAt.toISOString(),
    poblacionesInvitadas: source.participation.map(row => ({ perspectiva: NAMES[row.perspectiveCode], invitados: row.invited })),
    participacionObtenida: source.participation.map(row => ({ perspectiva: NAMES[row.perspectiveCode], enviados: row.submitted, borradores: row.drafts, excluidos: row.excluded, analizados: row.submitted - row.excluded })),
    perspectivasValidas: listOf(row => row.applicability === "APPLICABLE" && perspectiveVerdict(row.perspectiveCode)?.verdict === "A"),
    perspectivasConReservas: listOf(row => row.applicability === "APPLICABLE" && perspectiveVerdict(row.perspectiveCode)?.verdict === "B"),
    perspectivasInsuficientesONP: source.participation.filter(row => row.applicability !== "APPLICABLE" || perspectiveVerdict(row.perspectiveCode)?.verdict === "C").map(row => ({ perspectiva: NAMES[row.perspectiveCode], motivo: row.applicability === "NOT_APPLICABLE" ? "NP — no aplicable" : row.applicability === "NOT_AVAILABLE" ? "ND — no disponible" : "Dictamen C" })),
    incidenciasRelevantes: source.incidents.map(row => ({ fecha: row.occurredOn, perspectiva: row.perspectiveCode ? NAMES[row.perspectiveCode] : "General", incidencia: row.description, impacto: row.impact, accion: row.action, responsable: row.responsible })),
    exclusionesDocumentadas: source.exclusions.map(row => ({ perspectiva: NAMES[row.perspectiveCode], motivo: exclusionReasons[row.reasonCode], descripcion: row.description })),
    dictamenGlobal: source.verdicts.find(row => !row.perspectiveCode)!.verdict,
    reservasMetodologicas: source.verdicts.filter(row => row.reservations).map(row => ({ ambito: row.perspectiveCode ? `${NAMES[row.perspectiveCode]}${row.elementCode ? ` · ${row.elementCode}` : ""}` : "Global", dictamen: row.verdict, reservas: row.reservations })),
    checklist: [...source.checklist].sort((a, b) => a.item - b.item).map(row => ({ numero: row.item, criterio: CHECKLIST_ITEMS[row.item - 1], respuesta: { YES: "Sí", NO: "No", NA: "N/A" }[row.answer], observacion: row.observation })),
    consultorResponsable: source.consultant.name ? `${source.consultant.name} <${source.consultant.email}>` : source.consultant.email,
    fechaAutorizacionProcesamiento: source.authorizedAt.toISOString(),
  };
  return { acta, actaHash: sha256Canonical(acta) };
}
