"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceRequest } from "./workspace-api";

type Grant = { id: string; scope: Scope; purpose: string; requestedAt: string; expiresAt: string; status: "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED" | "EXPIRED"; requestedBy: string; decidedBy: string | null; decisionNote: string | null; mine: boolean };
type Scope = "RAW_RESPONSES" | "INDIVIDUAL_SCORES" | "QUALITATIVE_ORIGINAL";
type Record_ = { id: string; exportCode: string; variant: string; rowCount: number; manifestHash: string; requestedAt: string; grantId: string | null; requestedBy: string };
export const SCOPE_LABELS: Record<Scope, string> = { RAW_RESPONSES: "Datos crudos (EXP01)", INDIVIDUAL_SCORES: "Puntuaciones individuales (EXP03 técnico)", QUALITATIVE_ORIGINAL: "Cualitativo original (EXP02 completo)" };
export const GRANT_STATUS: Record<Grant["status"], string> = { PENDING: "Pendiente", ACTIVE: "Vigente", REJECTED: "Rechazado", REVOKED: "Revocado", EXPIRED: "Vencido" };
const EXPORTS: { code: string; variant: string; label: string; button: string; description: string; scope: Scope | null }[] = [
  { code: "EXP03", variant: "REPORT", label: "EXP03 · Resultados para reporte", button: "Descargar resultados para reporte (EXP03)", description: "Resultados por perspectiva y Elemento, resultados integrados, brechas, índices y Global. Respeta la revisión de divulgación: lo no reportable sale suprimido.", scope: null },
  { code: "EXP02", variant: "REPORT", label: "EXP02 · Citas para reporte", button: "Descargar citas para reporte (EXP02)", description: "Sólo las respuestas abiertas marcadas como aptas o redactadas, sin ningún identificador de participante.", scope: null },
  { code: "EXP04", variant: "STANDARD", label: "EXP04 · Metadatos metodológicos", button: "Descargar metadatos (EXP04)", description: "Instrumentos, versiones, reactivos y reglas usadas, para poder reproducir el cálculo.", scope: null },
  { code: "EXP01", variant: "STANDARD", label: "EXP01 · Respuestas crudas", button: "Descargar respuestas crudas (EXP01)", description: "Una fila por cada respuesta del 1 al 5, con un seudónimo por participante (P0001…) y la fecha de envío.", scope: "RAW_RESPONSES" },
  { code: "EXP03", variant: "TECHNICAL", label: "EXP03 · Resultados técnicos", button: "Descargar resultados técnicos (EXP03)", description: "Todos los resultados sin supresión, más la puntuación individual de cada participante (seudónima).", scope: "INDIVIDUAL_SCORES" },
  { code: "EXP02", variant: "FULL", label: "EXP02 · Respuestas abiertas completas", button: "Descargar respuestas abiertas completas (EXP02)", description: "Todas las respuestas abiertas con su texto original y su estado de revisión.", scope: "QUALITATIVE_ORIGINAL" },
];
const card = "rounded-lg border border-slate-200 bg-white p-5 sm:p-6";
const field = "mt-1 block min-h-11 w-full rounded border px-3";

export function ExportsWorkspace({ assessmentId, hasRun, records, grants }: { assessmentId: string; hasRun: boolean; records: Record_[]; grants: Grant[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  // The confirmation toast disappears by itself; errors stay until the next action.
  useEffect(() => { if (!message || /no se|error|requiere|revisa|falta/i.test(message)) return; const timer = setTimeout(() => setMessage(""), 5000); return () => clearTimeout(timer); }, [message]);
  const [scope, setScope] = useState<Scope>("RAW_RESPONSES"); const [purpose, setPurpose] = useState(""); const [days, setDays] = useState(7);
  const active = new Set(grants.filter(grant => grant.mine && grant.status === "ACTIVE").map(grant => grant.scope));
  async function download(code: string, variant: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/exports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, variant }) });
      if (!response.ok) { setMessage((await response.json() as { error?: string }).error ?? "No se pudo generar."); return; }
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1] ?? `${code}.zip`;
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
      setMessage(`Exportación ${name} generada.`); router.refresh();
    } finally { setBusy(false); }
  }
  async function grantAction(path: string, data: unknown, done: string) {
    setBusy(true); setMessage("");
    try { await workspaceRequest(path, "POST", data); setMessage(done); router.refresh(); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar."); return false; }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <section className={card}><h3 className="text-lg font-semibold">Exportaciones</h3>
      <p className="mt-1 text-sm text-slate-600">Cada descarga es un archivo ZIP con tablas CSV (se abren en Excel) y un manifiesto con sus huellas digitales. Se genera al momento desde el procesamiento vigente y queda registrada en el historial.</p>
      {!hasRun && <p className="mt-3 text-sm text-amber-900">Todavía no hay un procesamiento exitoso.</p>}
      <h4 className="mt-5 font-semibold">Para tu reporte</h4>
      <p className="text-sm text-slate-600">Datos agregados, sin información individual. Se descargan libremente.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">{EXPORTS.filter(item => !item.scope).map(item => <li key={`${item.code}-${item.variant}`} className="flex flex-col rounded border p-3">
        <p className="font-semibold">{item.label}</p><p className="mt-1 flex-1 text-sm text-slate-600">{item.description}</p>
        <button disabled={busy || !hasRun} onClick={() => download(item.code, item.variant)} className="mt-3 min-h-11 rounded bg-blue-900 px-4 text-left font-semibold text-white disabled:opacity-50">{item.button}</button>
      </li>)}</ul>
      <h4 className="mt-6 font-semibold">Datos individuales · requieren permiso del custodio</h4>
      <p className="text-sm text-slate-600">Contienen información por participante (con seudónimo). Sólo se descargan con un permiso vigente; solícitalo en la sección de abajo.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">{EXPORTS.filter(item => item.scope).map(item => { const allowed = active.has(item.scope!); return <li key={`${item.code}-${item.variant}`} className={`flex flex-col rounded border p-3 ${allowed ? "" : "border-dashed bg-slate-50"}`}>
        <p className="font-semibold">{allowed ? "" : <span aria-hidden="true">🔒 </span>}{item.label}</p><p className="mt-1 flex-1 text-sm text-slate-600">{item.description}</p>
        <p className={`mt-2 text-xs font-semibold ${allowed ? "text-green-800" : "text-slate-600"}`}>{allowed ? "Permiso vigente" : "Sin permiso vigente"}</p>
        <button disabled={busy || !hasRun || !allowed} onClick={() => download(item.code, item.variant)} className="mt-2 min-h-11 rounded border px-4 text-left font-semibold enabled:border-blue-900 enabled:bg-blue-900 enabled:text-white disabled:border-slate-300 disabled:bg-white disabled:text-slate-500">{item.button}</button>
      </li>; })}</ul>
      {message && <p role="status" className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg">{message}</p>}
    </section>
    <section className={card}><h3 className="text-lg font-semibold">Permisos excepcionales</h3>
      <p className="mt-1 text-sm text-slate-600">Los datos individuales requieren la aprobación del custodio metodológico. Nadie aprueba su propia solicitud. Vigencia máxima: 30 días.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_9rem_auto]" onSubmit={async event => { event.preventDefault(); if (await grantAction(`/api/assessments/${assessmentId}/grants`, { scope, purpose, days }, "Solicitud enviada al custodio.")) setPurpose(""); }}>
        <label className="text-sm font-medium">Datos que necesitas<select value={scope} onChange={event => setScope(event.target.value as Scope)} className={field}>{Object.entries(SCOPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        <label className="text-sm font-medium">Para qué los necesitas<input required minLength={10} placeholder="Ej.: auditoría metodológica del procesamiento" value={purpose} onChange={event => setPurpose(event.target.value)} className={field} /></label>
        <label className="text-sm font-medium">Vigencia (días, máx. 30)<input type="number" min={1} max={30} required value={days} onChange={event => setDays(Number(event.target.value))} className={field} /></label>
        <button disabled={busy} className="min-h-11 self-end rounded border px-4 font-semibold">Solicitar permiso</button>
      </form>
      {grants.length > 0 && <ul className="mt-4 space-y-2">{grants.map(grant => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
        <span><span className="font-semibold">{SCOPE_LABELS[grant.scope]} · {GRANT_STATUS[grant.status]}</span> — {grant.purpose} ({grant.requestedBy}; vence {new Date(grant.expiresAt).toLocaleDateString("es-MX")}{grant.decidedBy ? `; resolvió ${grant.decidedBy}` : ""})</span>
        {grant.mine && (grant.status === "ACTIVE" || grant.status === "PENDING") && <button disabled={busy} onClick={() => grantAction(`/api/grants/${grant.id}`, { action: "revoke" }, grant.status === "PENDING" ? "Solicitud cancelada." : "Permiso revocado.")} className="min-h-11 px-2 text-blue-900 underline">{grant.status === "PENDING" ? "Cancelar solicitud" : "Revocar permiso"}</button>}
      </li>)}</ul>}
    </section>
    <section className={card}><h3 className="text-lg font-semibold">Historial de descargas</h3>
      {records.length ? <ul className="mt-3 space-y-1 text-sm">{records.map(record => <li key={record.id} className="break-all">{new Date(record.requestedAt).toLocaleString("es-MX")} · {record.exportCode} {record.variant} · {record.rowCount} filas · {record.requestedBy}{record.grantId ? " · con permiso" : ""} · huella {record.manifestHash.slice(0, 16)}…</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Todavía no se ha descargado ninguna exportación de este diagnóstico.</p>}
    </section>
  </div>;
}
