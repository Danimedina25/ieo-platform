"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceRequest } from "./workspace-api";
import { CHECKLIST_ITEMS } from "@/domain/closure/checklist";
import { statusLabel, type AssessmentStatus } from "@/domain/closure/lifecycle";
import { exclusionReasons } from "@/domain/closure/schemas";

type Perspective = "DIR" | "ESP" | "LID" | "COL" | "CLI";
type Verdict = "A" | "B" | "C";
export type ClosureView = {
  status: AssessmentStatus; revisionNumber: number; openedAt: string | null; closedAt: string | null; plannedClosesAt: string | null; currentRunId: string | null;
  perspectives: { perspectiveCode: Perspective; applicability: string | null }[];
  participation: { perspectiveCode: Perspective; applicability: string | null; invited: number; submitted: number; drafts: number; excluded: number }[];
  submittedInvitations: { id: string; email: string; perspectiveCode: Perspective }[];
  exclusions: { id: string; invitationId: string | null; perspectiveCode: Perspective; reasonCode: keyof typeof exclusionReasons; description: string }[];
  incidents: { id: string; occurredOn: string; perspectiveCode: Perspective | null; description: string; impact: string; action: string; responsible: string }[];
  verdicts: { perspectiveCode: Perspective | null; elementCode: string | null; verdict: Verdict; reservations: string | null }[];
  checklist: { item: number; answer: "YES" | "NO" | "NA"; observation: string | null }[] | null;
  acta: Record<string, unknown> | null; actaHash: string | null;
  snapshot: { id: string; sha256: string; frozenAt: string; schemaVersion: number } | null;
  runs: { id: string; status: "SUCCEEDED" | "FAILED"; publishable: boolean; engineVersion: string; inputHash: string | null; outputHash: string | null; errorMessage: string | null; requestedAt: string; revisionNumber: number; globalStatus: string | null }[];
};
const NAMES: Record<Perspective, string> = { DIR: "Dirección", ESP: "Especialistas", LID: "Liderazgo", COL: "Colaboradores", CLI: "Voz del Cliente" };
const APPLICABILITY: Record<string, string> = { APPLICABLE: "Aplicable", NOT_APPLICABLE: "No aplicable", NOT_AVAILABLE: "No disponible" };
const field = "mt-1 block min-h-11 w-full rounded border px-3";
const button = "min-h-11 rounded bg-blue-900 px-4 font-semibold text-white disabled:opacity-50";
const card = "rounded-lg border border-slate-200 bg-white p-5 sm:p-6";

export function ClosureWorkspace({ assessmentId, initial }: { assessmentId: string; initial: ClosureView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  async function act(path: string, method: "POST" | "PATCH" | "DELETE", data: unknown, done: string) {
    setBusy(true); setMessage("");
    try {
      await workspaceRequest(`/api/assessments/${assessmentId}/${path}`, method, data);
      const response = await fetch(`/api/assessments/${assessmentId}/closure`, { cache: "no-store" });
      if (response.ok) setView(await response.json() as ClosureView);
      setMessage(done); router.refresh();
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar la acción."); return false; }
    finally { setBusy(false); }
  }
  const lifecycle = (action: string, done: string, extra: Record<string, string> = {}) => act("lifecycle", "POST", { action, ...extra }, done);
  const closed = view.status === "CLOSED";
  const applicable = view.perspectives.filter(row => row.applicability === "APPLICABLE").map(row => row.perspectiveCode);

  return <div className="space-y-6">
    <section className={card} aria-labelledby="estado">
      <h3 id="estado" className="text-lg font-semibold">Estado: {statusLabel[view.status]} · Revisión {view.revisionNumber}</h3>
      <p className="mt-2 text-sm text-slate-600">Apertura: {view.openedAt ? new Date(view.openedAt).toLocaleString("es-MX") : "—"} · Cierre: {view.closedAt ? new Date(view.closedAt).toLocaleString("es-MX") : "—"}{view.plannedClosesAt ? ` · Cierre planeado: ${new Date(view.plannedClosesAt).toLocaleString("es-MX")}` : ""}</p>
      <p className="mt-2 rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">PRUEBA — datos ficticios. El acta y los resultados no constituyen una aplicación oficial del IEO®.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {view.status === "DRAFT" && <button disabled={busy} className={button} onClick={() => lifecycle("open", "Aplicación abierta.")}>Abrir aplicación</button>}
        {view.status === "OPEN" && <button disabled={busy} className={button} onClick={() => lifecycle("close", "Aplicación cerrada.")}>Cerrar aplicación</button>}
        {view.status === "FROZEN" && <button disabled={busy} className={button} onClick={() => lifecycle("process", "Procesamiento terminado.")}>Procesar</button>}
        {view.status === "PROCESSED" && <button disabled={busy} className={button} onClick={() => lifecycle("process", "Reprocesamiento terminado.")}>Reprocesar</button>}
      </div>
      {["CLOSED", "FROZEN", "PROCESSED"].includes(view.status) && <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]" onSubmit={async event => { event.preventDefault(); if (await lifecycle("reopen", "Diagnóstico reabierto en una revisión nueva.", { reason })) setReason(""); }}>
        <label className="text-sm font-medium">Motivo de reapertura<input required value={reason} onChange={event => setReason(event.target.value)} className={field} /></label>
        <button disabled={busy} className="min-h-11 self-end rounded border px-4 font-semibold">Reabrir</button>
      </form>}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </section>

    <section className={card}><h3 className="text-lg font-semibold">Participación</h3>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Perspectiva</th><th className="p-2">Clasificación</th><th className="p-2">Invitados</th><th className="p-2">Enviados</th><th className="p-2">Borradores</th><th className="p-2">Excluidos</th></tr></thead>
        <tbody>{view.participation.map(row => <tr key={row.perspectiveCode} className="border-b last:border-0"><td className="p-2">{NAMES[row.perspectiveCode]}</td><td className="p-2">{row.applicability ? APPLICABILITY[row.applicability] : "Sin clasificar"}</td><td className="p-2">{row.invited}</td><td className="p-2">{row.submitted}</td><td className="p-2">{row.drafts}</td><td className="p-2">{row.excluded}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-xs text-slate-500">Los borradores se conservan pero no entran al cálculo.</p>
    </section>

    {closed && <ExclusionsForm view={view} busy={busy} submit={data => act("exclusions", "POST", data, "Exclusión registrada.")} />}
    <section className={card}><h3 className="text-lg font-semibold">Exclusiones</h3>
      {view.exclusions.length ? <ul className="mt-3 space-y-2">{view.exclusions.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm"><span>{NAMES[row.perspectiveCode]} · {exclusionReasons[row.reasonCode]}: {row.description}{row.invitationId ? ` (${view.submittedInvitations.find(item => item.id === row.invitationId)?.email ?? "invitación"})` : ""}</span>{closed && <button disabled={busy} onClick={() => act(`exclusions/${row.id}`, "DELETE", undefined, "Exclusión revocada.")} className="min-h-11 px-2 text-blue-900 underline">Revocar</button>}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Sin exclusiones.</p>}
    </section>

    {closed && <IncidentForm busy={busy} submit={data => act("incidents", "POST", data, "Incidencia registrada.")} />}
    <section className={card}><h3 className="text-lg font-semibold">Incidencias</h3>
      {view.incidents.length ? <ul className="mt-3 space-y-2">{view.incidents.map(row => <li key={row.id} className="rounded border p-3 text-sm">{row.occurredOn} · {row.perspectiveCode ? NAMES[row.perspectiveCode] : "General"} · {row.description} — Impacto: {row.impact}. Acción: {row.action}. Responsable: {row.responsible}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Sin incidencias registradas.</p>}
    </section>

    <section className={card}><h3 className="text-lg font-semibold">Dictamen de calidad</h3>
      <p className="mt-1 text-sm text-slate-600">A: válida · B: válida con reservas · C: evidencia insuficiente (sus resultados quedan ND y no entran a la triangulación).</p>
      <div className="mt-3 space-y-3">
        <VerdictRow label="Global" current={view.verdicts.find(row => !row.perspectiveCode)} editable={closed} busy={busy} save={data => act("quality", "POST", { perspectiveCode: null, elementCode: null, ...data }, "Dictamen global guardado.")} />
        {applicable.map(code => <VerdictRow key={code} label={NAMES[code]} current={view.verdicts.find(row => row.perspectiveCode === code && !row.elementCode)} editable={closed} busy={busy} save={data => act("quality", "POST", { perspectiveCode: code, elementCode: null, ...data }, `Dictamen de ${NAMES[code]} guardado.`)} />)}
        {view.verdicts.filter(row => row.elementCode).map(row => <p key={`${row.perspectiveCode}-${row.elementCode}`} className="text-sm">{NAMES[row.perspectiveCode!]} · {row.elementCode}: {row.verdict}{row.reservations ? ` — ${row.reservations}` : ""}</p>)}
      </div>
    </section>

    <Checklist initial={view.checklist} editable={closed} busy={busy} save={items => act("checklist", "PATCH", { items }, "Checklist guardado.")} />

    {closed && <section className={card}><h3 className="text-lg font-semibold">Congelar y autorizar procesamiento</h3>
      <p className="mt-2 text-sm text-slate-600">Genera el acta oficial y una copia inmutable de los datos (sin identidad, sin borradores ni excluidos). Después ya no se podrán registrar exclusiones ni dictámenes en esta revisión.</p>
      <button disabled={busy} className={`${button} mt-3`} onClick={() => lifecycle("freeze", "Datos congelados y procesamiento autorizado.")}>Congelar y autorizar procesamiento</button>
    </section>}

    {view.acta && <section className={card}><h3 className="text-lg font-semibold">Acta Oficial de Cierre</h3>
      <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[14rem_1fr]">
        {["organizacion", "diagnostico", "revision", "fechaApertura", "fechaCierre", "dictamenGlobal", "consultorResponsable", "fechaAutorizacionProcesamiento"].map(key => <div key={key} className="contents"><dt className="font-semibold">{key}</dt><dd>{String(view.acta![key] ?? "—")}</dd></div>)}
      </dl>
      <p className="mt-3 break-all text-xs text-slate-500">Hash del acta: {view.actaHash} · Hash de la copia congelada: {view.snapshot?.sha256}</p>
    </section>}

    {view.runs.length > 0 && <section className={card}><h3 className="text-lg font-semibold">Procesamientos</h3>
      <ul className="mt-3 space-y-2">{view.runs.map(run => <li key={run.id} className="rounded border p-3 text-sm"><p className="font-semibold">{new Date(run.requestedAt).toLocaleString("es-MX")} · Revisión {run.revisionNumber} · {run.status === "SUCCEEDED" ? "Exitoso" : "Fallido"}{run.id === view.currentRunId ? " · vigente" : ""}{run.status === "SUCCEEDED" ? (run.publishable ? " · publicable" : " · no publicable (dictamen C global)") : ""}</p>
        <p className="break-all text-xs text-slate-500">Motor {run.engineVersion} · Global: {run.globalStatus ?? "—"} · entrada {run.inputHash ?? "—"} · salida {run.outputHash ?? "—"}{run.errorMessage ? ` · ${run.errorMessage}` : ""}</p></li>)}</ul>
      <p className="mt-2 text-xs text-slate-500">Los resultados se consultan en la fase de resultados (Phase 6).</p>
    </section>}
  </div>;
}

function ExclusionsForm({ view, busy, submit }: { view: ClosureView; busy: boolean; submit: (data: unknown) => Promise<boolean> }) {
  const excluded = new Set(view.exclusions.map(row => row.invitationId));
  const options = view.submittedInvitations.filter(row => !excluded.has(row.id));
  const [invitationId, setInvitation] = useState(""); const [reasonCode, setReason] = useState("DUPLICATE"); const [description, setDescription] = useState("");
  return <form className={`${card} grid gap-3 sm:grid-cols-3`} onSubmit={async event => { event.preventDefault(); if (await submit({ invitationId, reasonCode, description })) { setInvitation(""); setDescription(""); } }}>
    <h3 className="text-lg font-semibold sm:col-span-3">Excluir un cuestionario enviado</h3>
    <label className="text-sm font-medium">Cuestionario<select required value={invitationId} onChange={event => setInvitation(event.target.value)} className={field}><option value="">Selecciona…</option>{options.map(row => <option key={row.id} value={row.id}>{row.perspectiveCode} · {row.email}</option>)}</select></label>
    <label className="text-sm font-medium">Motivo<select value={reasonCode} onChange={event => setReason(event.target.value)} className={field}>{Object.entries(exclusionReasons).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
    <label className="text-sm font-medium">Descripción<input required value={description} onChange={event => setDescription(event.target.value)} className={field} /></label>
    <button disabled={busy || !options.length} className={`${button} sm:col-span-3 sm:justify-self-start`}>Registrar exclusión</button>
  </form>;
}

function IncidentForm({ busy, submit }: { busy: boolean; submit: (data: unknown) => Promise<boolean> }) {
  const empty = { occurredOn: new Date().toISOString().slice(0, 10), perspectiveCode: "", description: "", impact: "", action: "", responsible: "" };
  const [form, setForm] = useState(empty);
  const set = (key: keyof typeof empty) => (event: { target: { value: string } }) => setForm(previous => ({ ...previous, [key]: event.target.value }));
  return <form className={`${card} grid gap-3 sm:grid-cols-2`} onSubmit={async event => { event.preventDefault(); if (await submit({ ...form, perspectiveCode: form.perspectiveCode || null })) setForm(empty); }}>
    <h3 className="text-lg font-semibold sm:col-span-2">Registrar incidencia</h3>
    <label className="text-sm font-medium">Fecha<input type="date" required value={form.occurredOn} onChange={set("occurredOn")} className={field} /></label>
    <label className="text-sm font-medium">Perspectiva<select value={form.perspectiveCode} onChange={set("perspectiveCode")} className={field}><option value="">General</option>{Object.entries(NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
    <label className="text-sm font-medium">Incidencia<input required value={form.description} onChange={set("description")} className={field} /></label>
    <label className="text-sm font-medium">Impacto<input required value={form.impact} onChange={set("impact")} className={field} /></label>
    <label className="text-sm font-medium">Acción tomada<input required value={form.action} onChange={set("action")} className={field} /></label>
    <label className="text-sm font-medium">Responsable<input required value={form.responsible} onChange={set("responsible")} className={field} /></label>
    <button disabled={busy} className={`${button} sm:col-span-2 sm:justify-self-start`}>Registrar incidencia</button>
  </form>;
}

function VerdictRow({ label, current, editable, busy, save }: { label: string; current?: { verdict: Verdict; reservations: string | null }; editable: boolean; busy: boolean; save: (data: { verdict: Verdict; reservations: string | null }) => Promise<boolean> }) {
  const [verdict, setVerdict] = useState<Verdict>(current?.verdict ?? "A"); const [reservations, setReservations] = useState(current?.reservations ?? "");
  if (!editable) return <p className="text-sm"><span className="font-semibold">{label}:</span> {current ? `${current.verdict}${current.reservations ? ` — ${current.reservations}` : ""}` : "Sin dictamen"}</p>;
  return <form className="grid gap-2 rounded border p-3 sm:grid-cols-[10rem_6rem_1fr_auto]" onSubmit={async event => { event.preventDefault(); await save({ verdict, reservations: reservations.trim() || null }); }}>
    <span className="self-center font-semibold">{label}{current ? ` (${current.verdict})` : ""}</span>
    <label className="text-sm">Dictamen<select aria-label={`Dictamen ${label}`} value={verdict} onChange={event => setVerdict(event.target.value as Verdict)} className={field}><option>A</option><option>B</option><option>C</option></select></label>
    <label className="text-sm">Reservas<input aria-label={`Reservas ${label}`} required={verdict !== "A"} value={reservations} onChange={event => setReservations(event.target.value)} className={field} /></label>
    <button disabled={busy} className="min-h-11 self-end rounded border px-4 font-semibold" aria-label={`Guardar dictamen ${label}`}>Guardar</button>
  </form>;
}

function Checklist({ initial, editable, busy, save }: { initial: ClosureView["checklist"]; editable: boolean; busy: boolean; save: (items: unknown) => Promise<boolean> }) {
  const [items, setItems] = useState(CHECKLIST_ITEMS.map((_, index) => initial?.find(row => row.item === index + 1) ?? { item: index + 1, answer: "" as "" | "YES" | "NO" | "NA", observation: null as string | null }));
  const complete = items.every(row => row.answer);
  return <section className={card}><h3 className="text-lg font-semibold">Checklist oficial de aplicación</h3>
    <ol className="mt-3 space-y-3">{CHECKLIST_ITEMS.map((text, index) => <li key={text} className="rounded border p-3"><fieldset disabled={!editable}><legend className="text-sm font-medium">{index + 1}. {text}</legend>
      <div className="mt-2 flex flex-wrap items-center gap-3">{(["YES", "NO", "NA"] as const).map(answer => <label key={answer} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`check-${index}`} checked={items[index].answer === answer} onChange={() => setItems(previous => previous.map((row, position) => position === index ? { ...row, answer } : row))} />{{ YES: "Sí", NO: "No", NA: "N/A" }[answer]}</label>)}
        <input aria-label={`Observación ${index + 1}`} placeholder="Observación (opcional)" value={items[index].observation ?? ""} onChange={event => setItems(previous => previous.map((row, position) => position === index ? { ...row, observation: event.target.value || null } : row))} className="min-h-11 flex-1 rounded border px-3 text-sm" /></div></fieldset></li>)}</ol>
    {editable && <button disabled={busy || !complete} className={`${button} mt-4`} onClick={() => save(items)}>Guardar checklist</button>}
  </section>;
}
