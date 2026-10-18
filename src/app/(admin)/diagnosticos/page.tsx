import Link from "next/link";
import { statusLabel } from "@/domain/closure/lifecycle";
import { listAssessmentMetadata } from "@/application/assessments";
import { listCreationOrganizations } from "@/application/workspace";
import { CreateAssessment } from "@/components/create-assessment";
import { requestToken, requirePageUser } from "@/lib/server-session";
export default async function AssessmentsPage() {
  await requirePageUser();
  const token = await requestToken();
  const [assessments, organizations] = await Promise.all([listAssessmentMetadata(token), listCreationOrganizations(token)]);
  return <>
    <div className="mb-8 flex flex-wrap items-start justify-between gap-5"><div><h1 className="text-3xl font-semibold tracking-tight">Diagnósticos</h1><p className="mt-3 text-slate-600">Consulta los diagnósticos a los que tienes acceso.</p></div>
      {organizations.length > 0 && <CreateAssessment organizations={organizations} />}
    </div>
    {assessments.length === 0 ? <p className="rounded-lg border border-slate-200 bg-white p-8 text-slate-600">Todavía no existen diagnósticos.</p> :
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><caption className="sr-only">Diagnósticos autorizados</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-slate-600"><tr>{["Organización", "Diagnóstico", "Periodo", "Estado"].map(label => <th key={label} scope="col" className="px-6 py-4 font-semibold">{label}</th>)}</tr></thead>
        <tbody>{assessments.map(item => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="px-6 py-5">{item.organization.name}</td><td className="px-6 py-5"><Link href={`/diagnosticos/${item.id}`} className="font-semibold text-blue-900 underline decoration-blue-200 underline-offset-4">{item.name}</Link></td><td className="whitespace-nowrap px-6 py-5">{item.period}</td><td className="px-6 py-5"><span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{statusLabel[item.status]}</span></td></tr>)}</tbody>
      </table></div>}
  </>;
}
