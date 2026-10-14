import { redirect } from "next/navigation";
import { participantContent } from "@/application/participant/survey";
import { cookieValue } from "@/lib/participant-http";
export default async function ThanksPage() {
  let state: Awaited<ReturnType<typeof participantContent>>;
  try { state = await participantContent(await cookieValue("auth")); } catch { redirect("/r/acceso"); }
  if (!state.submitted) redirect("/r/cuestionario");
  if (state.content) return <article className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">Gracias por tu participación</h1><p className="mt-4 text-slate-700">{state.content.thanks}</p><p className="mt-4 text-slate-700">Tus respuestas quedaron registradas y ya no pueden modificarse.</p><p className="mt-5 text-sm font-semibold">PRUEBA — DATOS FICTICIOS</p></article>;
  return <article className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">Envío recibido</h1><p className="mt-4 text-slate-700">Tus respuestas de prueba quedaron registradas. Ya no pueden modificarse desde este acceso.</p><p className="mt-5 font-semibold">PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL</p></article>;
}
