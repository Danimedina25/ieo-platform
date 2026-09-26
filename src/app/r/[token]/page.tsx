import { notFound } from "next/navigation";
import { landing } from "@/application/participant/access";
import { StartAccess } from "@/components/participant-access";
export const dynamic = "force-dynamic";
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try { await landing(token); } catch { notFound(); }
  return <article className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL</h1><p className="mt-5 text-slate-700">Este enlace individual permite acceder a un cuestionario técnico de prueba. Al continuar enviaremos un código al correo de la invitación.</p><StartAccess /></article>;
}
