import { redirect } from "next/navigation";
import { authParticipant } from "@/application/participant/access";
import { cookieValue } from "@/lib/participant-http";
export default async function ThanksPage() { let submitted = false; try { submitted = (await authParticipant(await cookieValue("auth"))).binding.responseSession.status === "SUBMITTED"; } catch { redirect("/r/acceso"); } if (!submitted) redirect("/r/cuestionario"); return <article className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">Envío recibido</h1><p className="mt-4 text-slate-700">Tus respuestas de prueba quedaron registradas. Ya no pueden modificarse desde este acceso.</p><p className="mt-5 font-semibold">PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL</p></article>; }
