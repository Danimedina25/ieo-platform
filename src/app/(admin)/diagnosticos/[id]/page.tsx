import Link from "next/link";
import { notFound } from "next/navigation";
import { readAssessmentMetadata } from "@/application/assessments";
import { requestToken, requirePageUser } from "@/lib/server-session";
export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const assessment = await readAssessmentMetadata(await requestToken(), (await params).id);
  if (!assessment) notFound();
  return <><Link href="/diagnosticos" className="text-sm font-semibold text-blue-900 underline underline-offset-4">← Volver a diagnósticos</Link>
    <p className="mt-9 text-sm text-slate-600">{assessment.organization.name}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{assessment.name}</h1>
    <dl className="mt-7 flex flex-wrap gap-10"><div><dt className="text-sm text-slate-600">Periodo</dt><dd className="mt-2 font-semibold">{assessment.period}</dd></div><div><dt className="text-sm text-slate-600">Estado</dt><dd className="mt-2 font-semibold">Borrador</dd></div></dl>
    <p className="mt-10 rounded-lg border border-slate-200 bg-white p-6 text-slate-600">La configuración del diagnóstico estará disponible en Phase 2.</p>
  </>;
}
