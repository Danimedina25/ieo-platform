"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { workspaceRequest } from "./workspace-api";
type OrganizationOption = { id: string; name: string };
type Fields = { organization: string; newOrganizationName: string; name: string; period: string; objective: string };
export function CreateAssessment({ organizations }: { organizations: OrganizationOption[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control, reset } = useForm<Fields>({ defaultValues: { organization: organizations[0]?.id ?? "new", newOrganizationName: "", name: "", period: "", objective: "" } });
  const choice = useWatch({ control, name: "organization" });
  async function submit(values: Fields) {
    setError(""); setSaving(true);
    try {
      const organization = values.organization === "new" ? { kind: "new" as const, name: values.newOrganizationName } : { kind: "existing" as const, id: values.organization };
      const result = await workspaceRequest<{ id: string }>("/api/assessments", "POST", { organization, name: values.name, period: values.period, objective: values.objective || null });
      reset(); router.push(`/diagnosticos/${result.id}?tab=general`); router.refresh();
    } catch (issue) { setError(issue instanceof Error ? issue.message : "No se pudo crear el diagnóstico."); }
    finally { setSaving(false); }
  }
  return <>
    <button type="button" onClick={() => { setError(""); dialog.current?.showModal(); }} className="min-h-11 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700">Nuevo diagnóstico</button>
    <dialog ref={dialog} aria-labelledby="create-title" onClose={() => { setError(""); reset(); }} className="m-auto w-[min(94vw,36rem)] rounded-xl border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/45">
      <div className="border-b border-slate-200 px-6 py-5"><h2 id="create-title" className="text-xl font-semibold">Nuevo diagnóstico</h2><p className="mt-1 text-sm text-slate-600">Crea el borrador y continúa en su espacio de trabajo.</p></div>
      <form onSubmit={handleSubmit(submit)} className="space-y-5 p-6">
        <div><label htmlFor="create-org" className="mb-2 block text-sm font-semibold">Organización</label><select id="create-org" {...register("organization")} className="min-h-11 w-full rounded-md border border-slate-400 bg-white px-3"><option value="new">Crear organización nueva</option>{organizations.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
        {choice === "new" && <div><label htmlFor="create-org-name" className="mb-2 block text-sm font-semibold">Nombre de organización</label><input id="create-org-name" required maxLength={160} {...register("newOrganizationName")} className="min-h-11 w-full rounded-md border border-slate-400 px-3" /></div>}
        <div><label htmlFor="create-name" className="mb-2 block text-sm font-semibold">Nombre del diagnóstico</label><input id="create-name" required maxLength={160} {...register("name")} className="min-h-11 w-full rounded-md border border-slate-400 px-3" /></div>
        <div><label htmlFor="create-period" className="mb-2 block text-sm font-semibold">Periodo</label><input id="create-period" required maxLength={80} {...register("period")} className="min-h-11 w-full rounded-md border border-slate-400 px-3" /></div>
        <div><label htmlFor="create-objective" className="mb-2 block text-sm font-semibold">Objetivo (opcional)</label><textarea id="create-objective" rows={3} maxLength={4000} {...register("objective")} className="w-full rounded-md border border-slate-400 p-3" /></div>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-md border border-slate-300 px-4">Cancelar</button><button disabled={saving} className="min-h-11 rounded-md bg-slate-900 px-5 font-semibold text-white disabled:opacity-60">{saving ? "Creando…" : "Crear diagnóstico"}</button></div>
      </form>
    </dialog>
  </>;
}
