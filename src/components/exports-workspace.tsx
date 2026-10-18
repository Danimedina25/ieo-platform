"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceRequest } from "./workspace-api";

type Grant = { id: string; scope: Scope; purpose: string; requestedAt: string; expiresAt: string; status: "PENDING" | "ACTIVE" | "REJECTED" | "REVOKED" | "EXPIRED"; requestedBy: string; decidedBy: string | null; decisionNote: string | null; mine: boolean };
type Scope = "RAW_RESPONSES" | "INDIVIDUAL_SCORES" | "QUALITATIVE_ORIGINAL";
type Record_ = { id: string; exportCode: string; variant: string; rowCount: number; manifestHash: string; requestedAt: string; grantId: string | null; requestedBy: string };
export const SCOPE_LABELS: Record<Scope, string> = { RAW_RESPONSES: "Datos crudos (EXP01)", INDIVIDUAL_SCORES: "Puntuaciones individuales (EXP03 técnico)", QUALITATIVE_ORIGINAL: "Cualitativo original (EXP02 completo)" };
export const GRANT_STATUS: Record<Grant["status"], string> = { PENDING: "Pendiente", ACTIVE: "Vigente", REJECTED: "Rechazado", REVOKED: "Revocado", EXPIRED: "Vencido" };
const EXPORTS: { code: string; variant: string; label: string; description: string; scope: Scope | null }[] = [
  { code: "EXP04", variant: "STANDARD", label: "EXP04 · Metadatos metodológicos", description: "Instrumentos, versiones, reactivos, reglas y hashes para reproducir el cálculo.", scope: null },
  { code: "EXP03", variant: "REPORT", label: "EXP03 · Resultados (reporte)", description: "RP, RI, BT, índices y Global, aplicando la revisión de divulgación.", scope: null },
  { code: "EXP02", variant: "REPORT", label: "EXP02 · Cualitativas (reporte)", description: "Sólo respuestas aptas o redactadas, sin seudónimo de participante.", scope: null },
  { code: "EXP03", variant: "TECHNICAL", label: "EXP03 · Resultados técnicos con PI", description: "Sin supresión y con puntuaciones individuales seudónimas.", scope: "INDIVIDUAL_SCORES" },
  { code: "EXP02", variant: "FULL", label: "EXP02 · Cualitativas completas", description: "Todas las respuestas con texto original y estado de revisión.", scope: "QUALITATIVE_ORIGINAL" },
  { code: "EXP01", variant: "STANDARD", label: "EXP01 · Respuestas crudas", description: "Una fila por respuesta cuantitativa, con seudónimo y fecha de envío.", scope: "RAW_RESPONSES" },
];
const card = "rounded-lg border border-slate-200 bg-white p-5 sm:p-6";
const field = "mt-1 block min-h-11 w-full rounded border px-3";

export function ExportsWorkspace({ assessmentId, hasRun, records, grants }: { assessmentId: string; hasRun: boolean; records: Record_[]; grants: Grant[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
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
      <p className="mt-1 text-sm text-slate-600">Cada descarga es un ZIP con CSV y un manifiesto con hashes. Se genera al momento desde el procesamiento vigente y queda registrada.</p>
      {!hasRun && <p className="mt-3 text-sm text-amber-900">Todavía no hay un procesamiento exitoso.</p>}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">{EXPORTS.map(item => <li key={`${item.code}-${item.variant}`} className="rounded border p-3">
        <p className="font-semibold">{item.label}</p><p className="mt-1 text-sm text-slate-600">{item.description}</p>
        {item.scope && <p className="mt-1 text-xs text-slate-500">Requiere permiso: {SCOPE_LABELS[item.scope]} — {active.has(item.scope) ? "vigente" : "sin permiso vigente"}</p>}
        <button disabled={busy || !hasRun || (!!item.scope && !active.has(item.scope))} onClick={() => download(item.code, item.variant)} className="mt-2 min-h-11 rounded bg-blue-900 px-4 font-semibold text-white disabled:opacity-50">Descargar {item.code}</button>
      </li>)}</ul>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </section>
    <section className={card}><h3 className="text-lg font-semibold">Permisos excepcionales</h3>
      <p className="mt-1 text-sm text-slate-600">Los datos individuales requieren la aprobación del custodio metodológico. Nadie aprueba su propia solicitud. Vigencia máxima: 30 días.</p>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_7rem_auto]" onSubmit={async event => { event.preventDefault(); if (await grantAction(`/api/assessments/${assessmentId}/grants`, { scope, purpose, days }, "Solicitud enviada al custodio.")) setPurpose(""); }}>
        <label className="text-sm font-medium">Alcance<select value={scope} onChange={event => setScope(event.target.value as Scope)} className={field}>{Object.entries(SCOPE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
        <label className="text-sm font-medium">Propósito<input required minLength={10} value={purpose} onChange={event => setPurpose(event.target.value)} className={field} /></label>
        <label className="text-sm font-medium">Días<input type="number" min={1} max={30} required value={days} onChange={event => setDays(Number(event.target.value))} className={field} /></label>
        <button disabled={busy} className="min-h-11 self-end rounded border px-4 font-semibold">Solicitar permiso</button>
      </form>
      {grants.length > 0 && <ul className="mt-4 space-y-2">{grants.map(grant => <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-3 text-sm">
        <span><span className="font-semibold">{SCOPE_LABELS[grant.scope]} · {GRANT_STATUS[grant.status]}</span> — {grant.purpose} ({grant.requestedBy}; vence {new Date(grant.expiresAt).toLocaleDateString("es-MX")}{grant.decidedBy ? `; resolvió ${grant.decidedBy}` : ""})</span>
        {grant.mine && (grant.status === "ACTIVE" || grant.status === "PENDING") && <button disabled={busy} onClick={() => grantAction(`/api/grants/${grant.id}`, { action: "revoke" }, "Permiso revocado.")} className="min-h-11 px-2 text-blue-900 underline">Revocar</button>}
      </li>)}</ul>}
    </section>
    <section className={card}><h3 className="text-lg font-semibold">Historial de descargas</h3>
      {records.length ? <ul className="mt-3 space-y-1 text-sm">{records.map(record => <li key={record.id} className="break-all">{new Date(record.requestedAt).toLocaleString("es-MX")} · {record.exportCode} {record.variant} · {record.rowCount} filas · {record.requestedBy}{record.grantId ? " · con permiso" : ""} · manifiesto {record.manifestHash.slice(0, 16)}…</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Sin descargas.</p>}
    </section>
  </div>;
}
