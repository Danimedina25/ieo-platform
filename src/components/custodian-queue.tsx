"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceRequest } from "./workspace-api";
import { GRANT_STATUS, SCOPE_LABELS } from "./exports-workspace";

type Row = { id: string; scope: keyof typeof SCOPE_LABELS; purpose: string; requestedAt: string; expiresAt: string; status: keyof typeof GRANT_STATUS; requestedBy: string; decidedBy: string | null; mine: boolean; assessment: string; organization: string };
export function CustodianQueue({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [notes, setNotes] = useState<Record<string, string>>({});
  async function act(id: string, action: "approve" | "reject" | "revoke") {
    setBusy(true); setMessage("");
    try { await workspaceRequest(`/api/grants/${id}`, "POST", { action, note: notes[id] || null }); setMessage({ approve: "Permiso aprobado.", reject: "Solicitud rechazada.", revoke: "Permiso revocado." }[action]); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo completar."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    {message && <p role="status" className="text-sm">{message}</p>}
    {rows.length ? rows.map(row => <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <p className="font-semibold">{SCOPE_LABELS[row.scope]} · {GRANT_STATUS[row.status]}</p>
      <p className="mt-1">{row.organization} · {row.assessment}</p>
      <p className="mt-1 text-slate-700">Propósito: {row.purpose}</p>
      <p className="mt-1 text-slate-500">Solicitó {row.requestedBy} el {new Date(row.requestedAt).toLocaleString("es-MX")} · vence {new Date(row.expiresAt).toLocaleDateString("es-MX")}{row.decidedBy ? ` · resolvió ${row.decidedBy}` : ""}</p>
      {row.status === "PENDING" && !row.mine && <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input aria-label={`Nota ${row.purpose}`} placeholder="Nota (opcional)" value={notes[row.id] ?? ""} onChange={event => setNotes(previous => ({ ...previous, [row.id]: event.target.value }))} className="min-h-11 rounded border px-3" />
        <button disabled={busy} onClick={() => act(row.id, "approve")} className="min-h-11 rounded bg-blue-900 px-4 font-semibold text-white">Aprobar</button>
        <button disabled={busy} onClick={() => act(row.id, "reject")} className="min-h-11 rounded border px-4 font-semibold">Rechazar</button>
      </div>}
      {row.status === "ACTIVE" && <button disabled={busy} onClick={() => act(row.id, "revoke")} className="mt-2 min-h-11 text-blue-900 underline">Revocar</button>}
    </article>) : <p className="text-slate-600">No hay solicitudes.</p>}
  </div>;
}
