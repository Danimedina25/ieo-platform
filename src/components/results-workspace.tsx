"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceRequest } from "./workspace-api";
import { ELEMENT_NAMES, GAP_CLASS_LABELS, HEALTH_LABELS, LIGHT_LABELS, PATTERN_LABELS, PERSPECTIVE_NAMES, QUALITATIVE_LABELS, REASON_LABELS, integer, oneDecimal } from "@/domain/results/format";

type Perspective = keyof typeof PERSPECTIVE_NAMES;
type Element = keyof typeof ELEMENT_NAMES;
type Pattern = keyof typeof PATTERN_LABELS;
type QualitativeStatus = keyof typeof QUALITATIVE_LABELS;
export type ResultsView = {
  available: true;
  run: { id: string; revisionNumber: number; requestedAt: string; publishable: boolean; engineVersion: string; outputHash: string | null; isCurrent: boolean; isTest: boolean };
  runs: { id: string; requestedAt: string; publishable: boolean; revisionNumber: number; isCurrent: boolean }[];
  scopes: { perspectiveCode: Perspective; scope: string }[];
  analyzed: Record<Perspective, number>;
  global: { status: string; reason: string | null; valueExact: string | null; displayScore: number | null; healthLevel: number | null; healthLabel: string | null; trafficLight: string | null; integratedElementCount: number; limitedElements: Element[] };
  perspectiveElements: { perspectiveCode: Perspective; elementCode: Element; status: string; reason: string | null; validPiCount: number; rpExact: string | null }[];
  elements: { elementCode: Element; riStatus: string; riExact: string | null; validPerspectiveCount: number; perspectives: Perspective[]; btStatus: string; btExact: string | null; btDisplay: number | null; btClass: string | null; maxPerspectives: Perspective[]; minPerspectives: Perspective[] }[];
  perspectiveIndexes: { perspectiveCode: Perspective; status: string; validElementCount: number; valueExact: string | null; displayScore: number | null; healthLevel: number | null; trafficLight: string | null }[];
  verdicts: { perspectiveCode: Perspective | null; elementCode: string | null; verdict: string; reservations: string | null }[];
  patterns: { elementCode: Element; patternCode: Pattern; justification: string; recordedAt: string; recordedBy: string; versions: number }[];
  disclosures: { perspectiveCode: Perspective; decision: "REPORTABLE" | "NOT_REPORTABLE"; reason: string; reviewedAt: string; reviewedBy: string }[];
  warnings: { perspectiveCode: Perspective; kind: "FEW_PEOPLE" | "DEDUCIBLE_FROM_INTEGRATION"; elements: Element[] }[];
};
type Qualitative = { id: string; perspectiveCode: Perspective; elementCode: Element | null; questionCode: string; question: string; text: string; status: QualitativeStatus; redactedText: string | null };
const PERSPECTIVES = Object.keys(PERSPECTIVE_NAMES) as Perspective[];
const ELEMENTS = Object.keys(ELEMENT_NAMES) as Element[];
const LIGHT_CLASS: Record<string, string> = { DARK_GREEN: "bg-green-800 text-white", LIGHT_GREEN: "bg-green-300 text-green-950", YELLOW: "bg-yellow-300 text-yellow-950", ORANGE: "bg-orange-400 text-orange-950", RED: "bg-red-700 text-white" };
const card = "rounded-lg border border-slate-200 bg-white p-5 sm:p-6";
const field = "mt-1 block min-h-11 w-full rounded border px-3";
const button = "min-h-11 rounded bg-blue-900 px-4 font-semibold text-white disabled:opacity-50";

export function ResultsWorkspace({ assessmentId, view }: { assessmentId: string; view: ResultsView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save(path: string, data: unknown, done: string) {
    setBusy(true); setMessage("");
    try { await workspaceRequest(`/api/assessments/${assessmentId}/results/${path}`, "POST", { runId: view.run.id, ...(data as object) }); setMessage(done); router.refresh(); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); return false; }
    finally { setBusy(false); }
  }
  const cell = (perspective: Perspective, element: Element) => view.perspectiveElements.find(row => row.perspectiveCode === perspective && row.elementCode === element)!;
  const applied = view.scopes.filter(row => row.scope === "APPLICABLE").map(row => row.perspectiveCode);
  const { global } = view;

  return <div className="space-y-6">
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h3 className="text-lg font-semibold">Procesamiento {view.run.isCurrent ? "vigente" : "histórico"} · Revisión {view.run.revisionNumber}</h3>
          <p className="text-sm text-slate-600">{new Date(view.run.requestedAt).toLocaleString("es-MX")} · Motor {view.run.engineVersion}</p></div>
        {view.runs.length > 1 && <label className="text-sm font-medium">Procesamiento<select value={view.run.id} onChange={event => router.push(`?tab=resultados&run=${event.target.value}`)} className={field}>{view.runs.map(run => <option key={run.id} value={run.id}>{new Date(run.requestedAt).toLocaleString("es-MX")} · Rev. {run.revisionNumber}{run.isCurrent ? " · vigente" : ""}{run.publishable ? "" : " · no publicable"}</option>)}</select></label>}
      </div>
      {view.run.isTest && <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">PRUEBA — datos ficticios. No constituye un diagnóstico IEO® oficial.</p>}
      {!view.run.publishable && <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">No publicable: el dictamen de calidad global es C (evidencia insuficiente). Se conserva para auditoría.</p>}
    </section>

    <section className={card} aria-labelledby="global">
      <h3 id="global" className="text-lg font-semibold">Índice Global IEO</h3>
      {global.status === "ND" ? <p className="mt-2 text-slate-700">No disponible: {REASON_LABELS[global.reason ?? ""] ?? global.reason}.</p> : <div className="mt-3 flex flex-wrap items-center gap-4">
        <p className="text-5xl font-bold" aria-label={`Índice Global ${global.displayScore}`}>{global.displayScore}</p>
        <div><p className="text-lg font-semibold">{global.healthLabel} · Nivel {global.healthLevel}</p>
          <p className={`mt-1 inline-block rounded px-2 py-0.5 text-sm font-semibold ${LIGHT_CLASS[global.trafficLight ?? ""]}`}>Semáforo: {LIGHT_LABELS[global.trafficLight ?? ""]}</p></div>
        {global.status === "LIMITED" && <p className="w-full text-sm text-amber-900">Resultado limitado: {global.limitedElements.map(code => ELEMENT_NAMES[code]).join(", ")} {global.limitedElements.length === 1 ? "tiene" : "tienen"} una sola perspectiva válida.</p>}
      </div>}
      <p className="mt-3 text-xs text-slate-500">El Índice Global nunca se interpreta solo: léelo junto con los ocho Elementos y las perspectivas de abajo.</p>
    </section>

    <section className={card}>
      <div className="overflow-x-auto"><table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="mb-3 text-left text-lg font-semibold text-slate-900">Matriz de triangulación</caption>
        <thead><tr className="border-b"><th scope="col" className="p-2">Elemento</th>{PERSPECTIVES.map(code => <th key={code} scope="col" className="p-2">{PERSPECTIVE_NAMES[code]}</th>)}<th scope="col" className="p-2">RI</th><th scope="col" className="p-2">BT</th></tr></thead>
        <tbody>{ELEMENTS.map(element => {
          const row = view.elements.find(item => item.elementCode === element)!;
          return <tr key={element} className="border-b align-top">
            <th scope="row" className="p-2 font-semibold">{ELEMENT_NAMES[element]}</th>
            {PERSPECTIVES.map(perspective => { const value = cell(perspective, element); return <td key={perspective} className="p-2">{value.status === "VALID" ? <><span className="font-semibold">{oneDecimal(value.rpExact)}</span><span className="block text-xs text-slate-500">n={value.validPiCount} de {view.analyzed[perspective]}</span></> : <span className="text-xs text-slate-600">{REASON_LABELS[value.reason ?? ""] ?? value.status}</span>}</td>; })}
            <td className="p-2">{row.riStatus === "ND" ? <span className="text-xs text-slate-600">ND</span> : <><span className="font-semibold">{oneDecimal(row.riExact)}</span><span className="block text-xs text-slate-500">{row.riStatus === "INTEGRATED" ? `Integrado (${row.validPerspectiveCount})` : "Limitado (1)"}</span></>}</td>
            <td className="p-2">{row.btStatus === "NOT_CALCULABLE" ? <span className="text-xs text-slate-600">No calculable</span> : <><span className="font-semibold">{row.btDisplay}</span><span className="block text-xs text-slate-500">{GAP_CLASS_LABELS[row.btClass ?? ""]} · {row.btStatus === "PARTIAL" ? "parcial" : "integrada"}</span><span className="block text-xs text-slate-500">máx. {row.maxPerspectives.join(", ")} · mín. {row.minPerspectives.join(", ")}</span></>}</td>
          </tr>;
        })}</tbody>
        <tfoot><tr><th scope="row" className="p-2">Índice por perspectiva</th>{PERSPECTIVES.map(code => { const index = view.perspectiveIndexes.find(row => row.perspectiveCode === code)!; return <td key={code} className="p-2">{index.status === "COMPLETE" ? <><span className="font-semibold">{integer(index.valueExact)}</span><span className="block text-xs text-slate-500">{HEALTH_LABELS[index.healthLevel ?? 0]}</span></> : <span className="text-xs text-slate-600">{index.status === "NP" ? "NP" : `ND (${index.validElementCount} de 8)`}</span>}</td>; })}<td /><td /></tr></tfoot>
      </table></div>
      <p className="mt-2 text-xs text-slate-500">RP y RI con un decimal; BT y Global como enteros (un .5 exacto baja). n = personas con resultado válido de las analizadas. La BT expresa distancia entre perspectivas, no salud.</p>
      {view.verdicts.some(row => row.reservations) && <div className="mt-3 text-sm"><h4 className="font-semibold">Reservas del dictamen de calidad</h4><ul className="mt-1 list-disc pl-5">{view.verdicts.filter(row => row.reservations).map(row => <li key={`${row.perspectiveCode}-${row.elementCode}`}>{row.perspectiveCode ? PERSPECTIVE_NAMES[row.perspectiveCode] : "Global"}{row.elementCode ? ` · ${ELEMENT_NAMES[row.elementCode as Element]}` : ""} ({row.verdict}): {row.reservations}</li>)}</ul></div>}
    </section>

    {message && <p role="status" className="text-sm">{message}</p>}
    <section className={card}><h3 className="text-lg font-semibold">Patrones de triangulación</h3>
      <p className="mt-1 text-sm text-slate-600">El consultor registra el patrón con su justificación. El sistema no asigna patrones ni infiere causas.</p>
      <div className="mt-3 space-y-3">{ELEMENTS.map(element => <PatternRow key={element} element={element} current={view.patterns.find(row => row.elementCode === element)} busy={busy} save={data => save("patterns", { elementCode: element, ...data }, `Patrón de ${ELEMENT_NAMES[element]} registrado.`)} />)}</div>
    </section>

    <section className={card}><h3 className="text-lg font-semibold">Revisión de divulgación</h3>
      <p className="mt-1 text-sm text-slate-600">Ocultar una perspectiva no la quita del cálculo: RI, BT y Global no cambian.</p>
      <div className="mt-3 space-y-3">{applied.map(perspective => <DisclosureRow key={perspective} perspective={perspective} current={view.disclosures.find(row => row.perspectiveCode === perspective)} warnings={view.warnings.filter(row => row.perspectiveCode === perspective)} busy={busy} save={data => save("disclosure", { perspectiveCode: perspective, ...data }, `Divulgación de ${PERSPECTIVE_NAMES[perspective]} registrada.`)} />)}</div>
    </section>

    <QualitativeSection assessmentId={assessmentId} runId={view.run.id} applied={applied} busy={busy} save={(data, done) => save("qualitative", data, done)} />
  </div>;
}

function PatternRow({ element, current, busy, save }: { element: Element; current?: ResultsView["patterns"][number]; busy: boolean; save: (data: { patternCode: Pattern; justification: string }) => Promise<boolean> }) {
  const [patternCode, setPattern] = useState<Pattern>(current?.patternCode ?? "MIXED_RESULT"); const [justification, setJustification] = useState("");
  return <form className="grid gap-2 rounded border p-3 sm:grid-cols-[12rem_14rem_1fr_auto]" onSubmit={async event => { event.preventDefault(); if (await save({ patternCode, justification })) setJustification(""); }}>
    <div className="text-sm"><p className="font-semibold">{ELEMENT_NAMES[element]}</p><p className="text-slate-600">{current ? `${PATTERN_LABELS[current.patternCode]} — ${current.justification} (${current.recordedBy}${current.versions > 1 ? `, ${current.versions} versiones` : ""})` : "Sin patrón registrado"}</p></div>
    <label className="text-sm">Patrón<select aria-label={`Patrón ${ELEMENT_NAMES[element]}`} value={patternCode} onChange={event => setPattern(event.target.value as Pattern)} className={field}>{Object.entries(PATTERN_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
    <label className="text-sm">Justificación<input aria-label={`Justificación ${ELEMENT_NAMES[element]}`} required value={justification} onChange={event => setJustification(event.target.value)} className={field} /></label>
    <button disabled={busy} className="min-h-11 self-end rounded border px-4 font-semibold" aria-label={`Registrar patrón ${ELEMENT_NAMES[element]}`}>Registrar</button>
  </form>;
}

function DisclosureRow({ perspective, current, warnings, busy, save }: { perspective: Perspective; current?: ResultsView["disclosures"][number]; warnings: ResultsView["warnings"]; busy: boolean; save: (data: { decision: "REPORTABLE" | "NOT_REPORTABLE"; reason: string }) => Promise<boolean> }) {
  const [decision, setDecision] = useState<"REPORTABLE" | "NOT_REPORTABLE">(current?.decision ?? "REPORTABLE"); const [reason, setReason] = useState("");
  return <form className="rounded border p-3" onSubmit={async event => { event.preventDefault(); if (await save({ decision, reason })) setReason(""); }}>
    <p className="font-semibold">{PERSPECTIVE_NAMES[perspective]}: {current ? `${current.decision === "REPORTABLE" ? "Reportable" : "No reportable"} — ${current.reason} (${current.reviewedBy})` : "Sin revisar"}</p>
    {warnings.map(warning => <p key={warning.kind} className="mt-1 text-sm text-amber-900">⚠ {warning.kind === "FEW_PEOPLE" ? `Menos de 3 personas válidas en: ${warning.elements.map(code => ELEMENT_NAMES[code]).join(", ")}. Valora el riesgo de identificación.` : `Oculta, pero deducible a partir del RI o la BT de: ${warning.elements.map(code => ELEMENT_NAMES[code]).join(", ")}. Esos resultados integrados también la revelarían.`}</p>)}
    <div className="mt-2 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
      {(["REPORTABLE", "NOT_REPORTABLE"] as const).map(option => <label key={option} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`disclosure-${perspective}`} checked={decision === option} onChange={() => setDecision(option)} />{option === "REPORTABLE" ? "Reportable" : "No reportable"}</label>)}
      <input aria-label={`Motivo ${PERSPECTIVE_NAMES[perspective]}`} required placeholder="Motivo" value={reason} onChange={event => setReason(event.target.value)} className="min-h-11 rounded border px-3" />
      <button disabled={busy} className="min-h-11 rounded border px-4 font-semibold" aria-label={`Guardar divulgación ${PERSPECTIVE_NAMES[perspective]}`}>Guardar</button>
    </div>
  </form>;
}

function QualitativeSection({ assessmentId, runId, applied, busy, save }: { assessmentId: string; runId: string; applied: Perspective[]; busy: boolean; save: (data: unknown, done: string) => Promise<boolean> }) {
  const [perspective, setPerspective] = useState(""); const [element, setElement] = useState("");
  const [items, setItems] = useState<Qualitative[] | null>(null); const [error, setError] = useState("");
  async function load() {
    setError("");
    const query = new URLSearchParams({ run: runId, ...(perspective ? { perspective } : {}), ...(element ? { element } : {}) });
    const response = await fetch(`/api/assessments/${assessmentId}/results/qualitative?${query}`, { cache: "no-store" });
    if (response.ok) setItems(await response.json() as Qualitative[]); else setError("No se pudo cargar la evidencia cualitativa.");
  }
  return <section className={card}><h3 className="text-lg font-semibold">Evidencia cualitativa</h3>
    <p className="mt-1 text-sm text-slate-600">Respuestas abiertas de los cuestionarios analizados, sin identificadores y en orden aleatorio. El texto original nunca se modifica.</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-sm font-medium">Perspectiva<select value={perspective} onChange={event => setPerspective(event.target.value)} className={field}><option value="">Todas</option>{applied.map(code => <option key={code} value={code}>{PERSPECTIVE_NAMES[code]}</option>)}</select></label>
      <label className="text-sm font-medium">Elemento<select value={element} onChange={event => setElement(event.target.value)} className={field}><option value="">Todos</option>{ELEMENTS.map(code => <option key={code} value={code}>{ELEMENT_NAMES[code]}</option>)}</select></label>
      <button type="button" onClick={load} className={`${button} self-end`}>Ver respuestas</button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {items && (items.length ? <ul className="mt-4 space-y-3">{items.map(item => <QualitativeItem key={item.id} item={item} busy={busy} save={async data => { const ok = await save({ surveyResponseId: item.id, ...data }, "Revisión guardada."); if (ok) await load(); return ok; }} />)}</ul> : <p className="mt-3 text-sm text-slate-600">No hay respuestas abiertas para este filtro.</p>)}
  </section>;
}

function QualitativeItem({ item, busy, save }: { item: Qualitative; busy: boolean; save: (data: { status: QualitativeStatus; redactedText: string | null }) => Promise<boolean> }) {
  const [status, setStatus] = useState<QualitativeStatus>(item.status); const [redacted, setRedacted] = useState(item.redactedText ?? item.text);
  return <li className="rounded border p-3 text-sm">
    <p className="text-xs text-slate-500">{PERSPECTIVE_NAMES[item.perspectiveCode]}{item.elementCode ? ` · ${ELEMENT_NAMES[item.elementCode]}` : " · General"} · {item.question}</p>
    <blockquote className="mt-1 border-l-4 border-slate-300 pl-3">{item.text}</blockquote>
    {item.status === "REDACTED" && item.redactedText && <p className="mt-1 text-slate-700"><span className="font-semibold">Versión redactada:</span> {item.redactedText}</p>}
    <form className="mt-2 grid gap-2 sm:grid-cols-[14rem_1fr_auto]" onSubmit={async event => { event.preventDefault(); await save({ status, redactedText: status === "REDACTED" ? redacted : null }); }}>
      <label>Estado<select aria-label={`Estado de la respuesta ${item.questionCode}`} value={status} onChange={event => setStatus(event.target.value as QualitativeStatus)} className={field}>{Object.entries(QUALITATIVE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
      {status === "REDACTED" ? <label>Texto redactado<input aria-label={`Texto redactado ${item.questionCode}`} required value={redacted} onChange={event => setRedacted(event.target.value)} className={field} /></label> : <span />}
      <button disabled={busy} className="min-h-11 self-end rounded border px-4 font-semibold">Guardar</button>
    </form>
  </li>;
}
