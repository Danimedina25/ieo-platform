"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { WorkspaceRequestError, workspaceRequest } from "./workspace-api";
type Person = { id: string; name: string | null; email: string };
type General = { name: string; period: string; objective: string | null; timezone: string | null; plannedOpensAt: string | null; plannedClosesAt: string | null; scopeUnitsText: string | null; sponsorName: string | null; consultantUserId: string | null; coordinatorUserId: string | null; methodologyNotes: string | null };
type Fields = { [K in keyof General]: string };
const inputClass = "min-h-11 w-full rounded-md border border-slate-400 bg-white px-3";
const fieldLabel = "mb-2 block text-sm font-semibold";
const toInputUtc = (value: string | null) => value ? value.slice(0, 16) : "";
const toUtc = (value: string) => value ? `${value}:00.000Z` : null;
export function GeneralForm({ id, general, consultants, coordinators, canEdit }: { id: string; general: General; consultants: Person[]; coordinators: Person[]; canEdit: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const { register, handleSubmit, setError, clearErrors, formState: { isSubmitting, errors } } = useForm<Fields>({ defaultValues: {
    name: general.name, period: general.period, objective: general.objective ?? "", timezone: general.timezone ?? "",
    plannedOpensAt: toInputUtc(general.plannedOpensAt), plannedClosesAt: toInputUtc(general.plannedClosesAt),
    scopeUnitsText: general.scopeUnitsText ?? "", sponsorName: general.sponsorName ?? "",
    consultantUserId: general.consultantUserId ?? "", coordinatorUserId: general.coordinatorUserId ?? "", methodologyNotes: general.methodologyNotes ?? "",
  } });
  async function submit(values: Fields) {
    setMessage(""); clearErrors();
    if (values.plannedOpensAt && values.plannedClosesAt && values.plannedOpensAt >= values.plannedClosesAt) {
      setError("plannedClosesAt", { message: "El cierre previsto debe ser posterior a la apertura." }); return;
    }
    try {
      await workspaceRequest(`/api/assessments/${id}/general`, "PATCH", {
        name: values.name, period: values.period, objective: values.objective || null, timezone: values.timezone || null,
        plannedOpensAt: toUtc(values.plannedOpensAt), plannedClosesAt: toUtc(values.plannedClosesAt),
        scopeUnitsText: values.scopeUnitsText || null, sponsorName: values.sponsorName || null,
        consultantUserId: values.consultantUserId || null, coordinatorUserId: values.coordinatorUserId || null,
        methodologyNotes: values.methodologyNotes || null,
      }); setMessage("Guardado"); router.refresh();
    } catch (issue) {
      if (issue instanceof WorkspaceRequestError) {
        for (const field of issue.fields) if (field in values) setError(field as keyof Fields, { message: "Revisa este campo." });
      }
      setMessage(issue instanceof Error ? issue.message : "Error al guardar");
    }
  }
  if (!canEdit) return <div className="space-y-5 text-sm"><dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
    {[["Nombre", general.name], ["Periodo", general.period], ["Objetivo", general.objective], ["Zona horaria", general.timezone], ["Apertura prevista (UTC)", general.plannedOpensAt], ["Cierre previsto (UTC)", general.plannedClosesAt], ["Unidades / sedes", general.scopeUnitsText], ["Sponsor", general.sponsorName], ["Consultor", consultants.find(x => x.id === general.consultantUserId)?.name], ["Coordinador", coordinators.find(x => x.id === general.coordinatorUserId)?.name], ["Observaciones metodológicas", general.methodologyNotes]].map(([label, value]) => <div key={label}><dt className="text-slate-600">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{value || "—"}</dd></div>)}</dl></div>;
  return <form onSubmit={handleSubmit(submit)} className="space-y-6">
    <div><label htmlFor="general-name" className={fieldLabel}>Nombre</label><input id="general-name" required maxLength={160} {...register("name")} className={inputClass} /></div>
    <div><label htmlFor="general-objective" className={fieldLabel}>Objetivo</label><textarea id="general-objective" rows={3} maxLength={4000} {...register("objective")} className="w-full rounded-md border border-slate-400 p-3" /></div>
    <div className="grid gap-6 sm:grid-cols-2"><div><label htmlFor="general-period" className={fieldLabel}>Periodo</label><input id="general-period" required maxLength={80} {...register("period")} className={inputClass} /></div><div><label htmlFor="general-timezone" className={fieldLabel}>Zona horaria IANA</label><input id="general-timezone" list="timezones" placeholder="America/Cancun" maxLength={64} {...register("timezone")} className={inputClass} /><datalist id="timezones"><option value="America/Cancun" /><option value="America/Mexico_City" /><option value="UTC" /></datalist></div></div>
    <p className="text-sm text-slate-600">Las fechas previstas se capturan en UTC. La zona horaria queda registrada como referencia del diagnóstico.</p>
    <div className="grid gap-6 sm:grid-cols-2"><div><label htmlFor="general-open" className={fieldLabel}>Apertura prevista (UTC)</label><input id="general-open" type="datetime-local" {...register("plannedOpensAt")} className={inputClass} /></div><div><label htmlFor="general-close" className={fieldLabel}>Cierre previsto (UTC)</label><input id="general-close" type="datetime-local" aria-invalid={!!errors.plannedClosesAt} aria-describedby={errors.plannedClosesAt ? "general-close-error" : undefined} {...register("plannedClosesAt")} className={inputClass} />{errors.plannedClosesAt && <p id="general-close-error" role="alert" className="mt-2 text-sm text-red-800">{errors.plannedClosesAt.message}</p>}</div></div>
    <div><label htmlFor="general-units" className={fieldLabel}>Unidades / sedes incluidas</label><textarea id="general-units" rows={3} maxLength={4000} {...register("scopeUnitsText")} className="w-full rounded-md border border-slate-400 p-3" /></div>
    <div><label htmlFor="general-sponsor" className={fieldLabel}>Sponsor</label><input id="general-sponsor" maxLength={160} {...register("sponsorName")} className={inputClass} /></div>
    <div className="grid gap-6 sm:grid-cols-2"><div><label htmlFor="general-consultant" className={fieldLabel}>Consultor responsable</label><select id="general-consultant" {...register("consultantUserId")} className={inputClass}><option value="">Sin asignar</option>{consultants.map(p => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}</select></div><div><label htmlFor="general-coordinator" className={fieldLabel}>Coordinador</label><select id="general-coordinator" {...register("coordinatorUserId")} className={inputClass}><option value="">Sin asignar</option>{coordinators.map(p => <option key={p.id} value={p.id}>{p.name ?? p.email}</option>)}</select></div></div>
    <div><label htmlFor="general-notes" className={fieldLabel}>Observaciones metodológicas</label><textarea id="general-notes" rows={3} maxLength={4000} {...register("methodologyNotes")} className="w-full rounded-md border border-slate-400 p-3" /></div>
    <div className="flex items-center justify-end gap-4"><span role="status" className={message === "Guardado" ? "text-sm text-green-800" : "text-sm text-red-800"}>{message}</span><button disabled={isSubmitting} className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-white disabled:opacity-60">{isSubmitting ? "Guardando…" : "Guardar cambios"}</button></div>
  </form>;
}
