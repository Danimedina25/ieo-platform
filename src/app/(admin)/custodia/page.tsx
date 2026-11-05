import { notFound } from "next/navigation";
import { listCustodianGrants } from "@/application/grants";
import { CustodianQueue } from "@/components/custodian-queue";
import { HelpTip } from "@/components/help-tip";
import { requestToken, requirePageUser } from "@/lib/server-session";
export default async function CustodianPage() {
  await requirePageUser();
  let rows;
  try { rows = JSON.parse(JSON.stringify(await listCustodianGrants(await requestToken()))); } catch { notFound(); }
  return <><div className="flex items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight">Custodia metodológica</h1><HelpTip term="grant" /></div>
    <p className="mt-3 max-w-3xl text-slate-600">Aquí apruebas o rechazas las solicitudes para descargar datos individuales de un diagnóstico. Sólo ves quién lo pide, para qué y por cuánto tiempo; nunca respuestas ni resultados. Regla provisional, pendiente de confirmar (GAP-011).</p>
    <div className="mt-8"><CustodianQueue rows={rows} /></div></>;
}
