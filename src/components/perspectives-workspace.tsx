"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { workspaceRequest } from "./workspace-api";
import type { WorkspacePerspective, WorkspaceSegment } from "@/application/workspace";
import { perspectiveCodes } from "@/domain/assessment/schemas";
const names: Record<string, string> = { DIR: "Dirección", ESP: "Especialistas", LID: "Liderazgo", COL: "Colaboradores", CLI: "Voz del Cliente" };
const applicabilityNames: Record<string, string> = { APPLICABLE: "Aplicable", NOT_APPLICABLE: "No aplicable", NOT_AVAILABLE: "No disponible" };
const reportNames: Record<string, string> = { PENDING: "Pendiente", REPORTABLE: "Reportable", NOT_REPORTABLE: "No reportable" };
const inputClass = "min-h-11 w-full rounded-md border border-slate-400 bg-white px-3";
const labelClass = "mb-2 block text-sm font-semibold";
export function PerspectivesWorkspace({ id, perspectives, segments, canEdit }: { id: string; perspectives: WorkspacePerspective[]; segments: WorkspaceSegment[]; canEdit: boolean }) {
  const router = useRouter();
  const perspectiveDialog = useRef<HTMLDialogElement>(null);
  const segmentDialog = useRef<HTMLDialogElement>(null);
  const [editingPerspective, setEditingPerspective] = useState<WorkspacePerspective | null>(null);
  const [editingSegment, setEditingSegment] = useState<WorkspaceSegment | null>(null);
  const [applicability, setApplicability] = useState("");
  const [population, setPopulation] = useState("");
  const [collectionMode, setCollectionMode] = useState("");
  const [notes, setNotes] = useState("");
  const [cliUnitType, setCliUnitType] = useState("");
  const [dimension, setDimension] = useState("");
  const [label, setLabel] = useState("");
  const [reportabilityStatus, setReportabilityStatus] = useState("PENDING");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  function openPerspective(item: WorkspacePerspective) {
    setEditingPerspective(item); setApplicability(item.applicability ?? ""); setPopulation(item.populationEstimate?.toString() ?? "");
    setCollectionMode(item.collectionMode ?? ""); setNotes(item.notes ?? ""); setCliUnitType(item.cliUnitType ?? ""); setError(""); perspectiveDialog.current?.showModal();
  }
  async function savePerspective(event: React.FormEvent) {
    event.preventDefault(); if (!editingPerspective) return;
    setSaving(true); setError("");
    try {
      await workspaceRequest(`/api/assessments/${id}/perspectives/${editingPerspective.perspectiveCode}`, "PATCH", {
        applicability: applicability || null, populationEstimate: applicability === "APPLICABLE" && population !== "" ? Number(population) : null,
        collectionMode: applicability === "APPLICABLE" ? collectionMode || null : null, notes: notes || null,
        cliUnitType: editingPerspective.perspectiveCode === "CLI" ? cliUnitType || null : null,
      });
      perspectiveDialog.current?.close(); setMessage("Perspectiva guardada"); router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Error al guardar"); }
    finally { setSaving(false); }
  }
  function openSegment(item: WorkspaceSegment | null) {
    setEditingSegment(item); setDimension(item?.dimension ?? ""); setLabel(item?.label ?? ""); setReportabilityStatus(item?.reportabilityStatus ?? "PENDING"); setReason(item?.reason ?? ""); setError(""); segmentDialog.current?.showModal();
  }
  async function saveSegment(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const path = editingSegment ? `/api/assessments/${id}/segments/${editingSegment.id}` : `/api/assessments/${id}/segments`;
      await workspaceRequest(path, editingSegment ? "PATCH" : "POST", { dimension, label, reportabilityStatus, reason: reason || null });
      segmentDialog.current?.close(); setMessage(editingSegment ? "Segmento guardado" : "Segmento agregado"); router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "Error al guardar"); }
    finally { setSaving(false); }
  }
  async function deactivate(item: WorkspaceSegment) {
    if (!window.confirm(`¿Desactivar el segmento «${item.label}»?`)) return;
    setMessage("");
    try { await workspaceRequest(`/api/assessments/${id}/segments/${item.id}`, "DELETE"); setMessage("Segmento desactivado"); router.refresh(); }
    catch (issue) { setMessage(issue instanceof Error ? issue.message : "Error al desactivar"); }
  }
  const configured = perspectives.filter(p => p.applicability !== null).length;
  return <div className="space-y-10">
    <section aria-labelledby="perspectives-heading"><div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><h2 id="perspectives-heading" className="text-xl font-semibold">Cinco perspectivas</h2><p className="text-sm text-slate-600">{configured} de 5 configuradas</p></div>
      <p className="mb-5 text-sm text-slate-600">Este conteo es operativo; no indica validez metodológica ni disponibilidad para aplicación.</p>
      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">{perspectiveCodes.map(code => {
        const item = perspectives.find(p => p.perspectiveCode === code);
        if (!item) return <div key={code} className="px-6 py-5 text-red-800">Falta perspectiva {names[code]}. Contacta soporte.</div>;
        return <div key={code} className="flex flex-wrap items-center justify-between gap-5 px-6 py-5"><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold">{names[code]}</h3><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{item.applicability ? applicabilityNames[item.applicability] : "Sin configurar"}</span></div>
          <p className="mt-2 text-sm text-slate-600">Población: {item.populationEstimate ?? "—"} · Plan: {item.collectionMode === "CENSUS" ? "Censo" : item.collectionMode === "SAMPLE" ? "Muestra" : "—"}{code === "CLI" ? ` · Unidad: ${item.cliUnitType ?? "—"}` : ""}</p></div>
          {canEdit && <button type="button" onClick={() => openPerspective(item)} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50">{item.applicability ? "Editar" : "Configurar"} {names[code]}</button>}</div>;
      })}</div>
    </section>
    <section aria-labelledby="segments-heading"><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><h2 id="segments-heading" className="text-xl font-semibold">Segmentos autorizados</h2><p className="mt-2 text-sm text-slate-600">Reportabilidad declarada pendiente de revisión antes de cualquier publicación.</p></div>{canEdit && <button type="button" onClick={() => openSegment(null)} className="min-h-11 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700">Agregar segmento</button>}</div>
      {segments.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">Todavía no existen segmentos.</p> : <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Segmentos del diagnóstico</caption><thead className="bg-slate-50 text-slate-700"><tr>{["Dimensión", "Segmento", "Reportabilidad", "Estado", "Acciones"].map(x => <th scope="col" key={x} className="px-5 py-4">{x}</th>)}</tr></thead><tbody>{segments.map(item => <tr key={item.id} className="border-t border-slate-200"><td className="px-5 py-4">{item.dimension}</td><td className="px-5 py-4 font-medium">{item.label}</td><td className="px-5 py-4">{reportNames[item.reportabilityStatus]}</td><td className="px-5 py-4">{item.active ? "Activo" : "Inactivo"}</td><td className="whitespace-nowrap px-5 py-4">{canEdit && item.active ? <div className="flex gap-3"><button onClick={() => openSegment(item)} className="text-blue-900 underline">Editar</button><button onClick={() => deactivate(item)} className="text-red-800 underline">Desactivar</button></div> : "—"}</td></tr>)}</tbody></table></div>}
    </section>
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    <dialog ref={perspectiveDialog} aria-labelledby="perspective-dialog-title" className="m-auto w-[min(94vw,34rem)] rounded-xl border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/45">
      <div className="border-b border-slate-200 px-6 py-5"><h2 id="perspective-dialog-title" className="text-xl font-semibold">Configurar {editingPerspective ? names[editingPerspective.perspectiveCode] : "perspectiva"}</h2></div>
      <form onSubmit={savePerspective} className="space-y-5 p-6"><div><label htmlFor="p-state" className={labelClass}>Estado</label><select id="p-state" value={applicability} onChange={e => setApplicability(e.target.value)} className={inputClass}><option value="">Sin configurar</option><option value="APPLICABLE">Aplicable</option><option value="NOT_APPLICABLE">No aplicable</option><option value="NOT_AVAILABLE">No disponible</option></select></div>
        {applicability === "APPLICABLE" && <div className="grid gap-5 sm:grid-cols-2"><div><label htmlFor="p-population" className={labelClass}>Población estimada</label><input id="p-population" type="number" min="0" step="1" value={population} onChange={e => setPopulation(e.target.value)} className={inputClass} /></div><div><label htmlFor="p-plan" className={labelClass}>Plan</label><select id="p-plan" value={collectionMode} onChange={e => setCollectionMode(e.target.value)} className={inputClass}><option value="">Sin definir</option><option value="CENSUS">Censo</option><option value="SAMPLE">Muestra</option></select></div></div>}
        {editingPerspective?.perspectiveCode === "CLI" && <div><label htmlFor="p-cli" className={labelClass}>Unidad de cliente</label><select id="p-cli" value={cliUnitType} onChange={e => setCliUnitType(e.target.value)} className={inputClass}><option value="">Sin definir</option><option value="B2B">B2B</option><option value="B2C">B2C</option></select></div>}
        <div><label htmlFor="p-notes" className={labelClass}>Notas / motivo</label><textarea id="p-notes" rows={3} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} className="w-full rounded-md border border-slate-400 p-3" /></div>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => perspectiveDialog.current?.close()} className="min-h-11 rounded-md border border-slate-300 px-4">Cancelar</button><button disabled={saving} className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-white disabled:opacity-60">{saving ? "Guardando…" : "Guardar cambios"}</button></div></form>
    </dialog>
    <dialog ref={segmentDialog} aria-labelledby="segment-dialog-title" className="m-auto w-[min(94vw,34rem)] rounded-xl border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/45">
      <div className="border-b border-slate-200 px-6 py-5"><h2 id="segment-dialog-title" className="text-xl font-semibold">{editingSegment ? "Editar segmento" : "Agregar segmento"}</h2></div>
      <form onSubmit={saveSegment} className="space-y-5 p-6"><div><label htmlFor="s-dimension" className={labelClass}>Dimensión</label><input id="s-dimension" required maxLength={80} value={dimension} onChange={e => setDimension(e.target.value)} placeholder="Área, unidad, sede…" className={inputClass} /></div>
        <div><label htmlFor="s-label" className={labelClass}>Nombre / etiqueta</label><input id="s-label" required maxLength={160} value={label} onChange={e => setLabel(e.target.value)} className={inputClass} /></div>
        <div><label htmlFor="s-report" className={labelClass}>Reportabilidad</label><select id="s-report" value={reportabilityStatus} onChange={e => setReportabilityStatus(e.target.value)} className={inputClass}><option value="PENDING">Pendiente</option><option value="REPORTABLE">Reportable</option><option value="NOT_REPORTABLE">No reportable</option></select></div>
        <div><label htmlFor="s-reason" className={labelClass}>Motivo / observaciones</label><textarea id="s-reason" rows={3} maxLength={4000} value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-md border border-slate-400 p-3" /></div>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => segmentDialog.current?.close()} className="min-h-11 rounded-md border border-slate-300 px-4">Cancelar</button><button disabled={saving} className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-white disabled:opacity-60">{saving ? "Guardando…" : "Guardar cambios"}</button></div></form>
    </dialog>
  </div>;
}
