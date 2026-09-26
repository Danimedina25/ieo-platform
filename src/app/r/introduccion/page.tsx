import { redirect } from "next/navigation";
import { cookieValue } from "@/lib/participant-http";
import { authParticipant } from "@/application/participant/access";
import { AcceptIntro } from "@/components/participant-access";
export default async function IntroPage() { let submitted = false; try { submitted = (await authParticipant(await cookieValue("auth"))).binding.responseSession.status === "SUBMITTED"; } catch { redirect("/r/acceso"); } if (submitted) redirect("/r/gracias");
  return <article className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL</h1><p className="mt-5 text-slate-700">Este formulario contiene preguntas ficticias para probar acceso, guardado y envío. No produce diagnóstico, resultados ni puntuación IEO®. Puedes reanudarlo con el enlace y un nuevo código mientras esté vigente.</p><AcceptIntro /></article>; }
