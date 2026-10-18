import { notFound } from "next/navigation";
import { listCustodianGrants } from "@/application/grants";
import { CustodianQueue } from "@/components/custodian-queue";
import { requestToken, requirePageUser } from "@/lib/server-session";
export default async function CustodianPage() {
  await requirePageUser();
  let rows;
  try { rows = JSON.parse(JSON.stringify(await listCustodianGrants(await requestToken()))); } catch { notFound(); }
  return <><h1 className="text-3xl font-semibold tracking-tight">Custodia metodológica</h1>
    <p className="mt-3 max-w-3xl text-slate-600">Solicitudes de acceso excepcional a datos individuales (GAP-011, regla provisional). Aquí sólo se ven los metadatos de cada solicitud, nunca respuestas ni resultados.</p>
    <div className="mt-8"><CustodianQueue rows={rows} /></div></>;
}
