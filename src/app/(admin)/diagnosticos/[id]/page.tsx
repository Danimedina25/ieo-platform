import Link from "next/link";
import { notFound } from "next/navigation";
import { readWorkspace } from "@/application/workspace";
import { GeneralForm } from "@/components/general-form";
import { PerspectivesWorkspace } from "@/components/perspectives-workspace";
import { requestToken, requirePageUser } from "@/lib/server-session";
export default async function AssessmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  await requirePageUser();
  const workspace = await readWorkspace(await requestToken(), (await params).id);
  if (!workspace) notFound();
  if (workspace.kind === "technical") {
    const item = workspace.metadata;
    return <><Link href="/diagnosticos" className="text-sm font-semibold text-blue-900 underline underline-offset-4">← Volver a diagnósticos</Link><header className="mt-9"><p className="text-sm text-slate-600">{item.organization.name}</p><h1 className="mt-2 text-3xl font-semibold">{item.name}</h1><p className="mt-3 text-sm text-slate-600">Periodo: {item.period} · Borrador</p></header><section className="mt-10 rounded-lg border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold">Metadata técnica</h2><p className="mt-2 text-slate-600">La configuración requiere membresía de la organización.</p></section></>;
  }
  const item = workspace.assessment;
  const tab = (await searchParams).tab === "perspectivas" ? "perspectivas" : "general";
  return <><Link href="/diagnosticos" className="text-sm font-semibold text-blue-900 underline underline-offset-4">← Volver a diagnósticos</Link>
    <header className="mt-9 flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-600">{item.organization.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{item.name}</h1><p className="mt-3 text-sm text-slate-600">Periodo: {item.period}</p></div><span className="rounded-md bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800">Borrador</span></header>
    <nav aria-label="Espacio de trabajo del diagnóstico" className="mt-10 flex gap-2 border-b border-slate-300"><Link href={`/diagnosticos/${item.id}?tab=general`} aria-current={tab === "general" ? "page" : undefined} className={`min-h-11 px-5 py-3 text-sm font-semibold ${tab === "general" ? "border-b-2 border-blue-900 text-blue-900" : "text-slate-600 hover:text-slate-900"}`}>General</Link><Link href={`/diagnosticos/${item.id}?tab=perspectivas`} aria-current={tab === "perspectivas" ? "page" : undefined} className={`min-h-11 px-5 py-3 text-sm font-semibold ${tab === "perspectivas" ? "border-b-2 border-blue-900 text-blue-900" : "text-slate-600 hover:text-slate-900"}`}>Perspectivas</Link></nav>
    <section className="mt-8"><div className="mb-7"><h2 className="text-xl font-semibold">{tab === "general" ? "Información general" : "Perspectivas y segmentos"}</h2>{!workspace.canEdit && <p className="mt-2 text-sm text-slate-600">Vista de consulta. Los cambios requieren rol de consultor.</p>}</div>
      {tab === "general" ? <div className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8"><GeneralForm id={item.id} canEdit={workspace.canEdit} consultants={workspace.consultants} coordinators={workspace.coordinators} general={{ name: item.name, period: item.period, objective: item.objective, timezone: item.timezone, plannedOpensAt: item.plannedOpensAt?.toISOString() ?? null, plannedClosesAt: item.plannedClosesAt?.toISOString() ?? null, scopeUnitsText: item.scopeUnitsText, sponsorName: item.sponsorName, consultantUserId: item.consultantUserId, coordinatorUserId: item.coordinatorUserId, methodologyNotes: item.methodologyNotes }} /></div> : <PerspectivesWorkspace id={item.id} canEdit={workspace.canEdit} perspectives={item.perspectives} segments={item.segments} />}
    </section>
    <aside className="mt-10 rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">Paquete metodológico</h2><p className="mt-2 text-sm text-slate-700">Estado: Pendiente de certificación</p><p className="mt-1 text-sm text-slate-600">La asociación formal de instrumentos y versiones se incorporará en una fase posterior.</p></aside>
  </>;
}
