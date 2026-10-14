import { redirect } from "next/navigation";
import { cookieValue } from "@/lib/participant-http";
import { participantContent } from "@/application/participant/survey";
import { AcceptIntro } from "@/components/participant-access";
import { TestNotice } from "@/components/survey-form";
export default async function IntroPage() {
  let state: Awaited<ReturnType<typeof participantContent>>;
  try { state = await participantContent(await cookieValue("auth")); } catch { redirect("/r/acceso"); }
  if (state.submitted) redirect("/r/gracias");
  const content = state.content;
  if (!content) return <article className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL</h1><p className="mt-5 text-slate-700">Este formulario contiene preguntas ficticias para probar acceso, guardado y envío. No produce diagnóstico, resultados ni puntuación IEO®. Puedes reanudarlo con el enlace y un nuevo código mientras esté vigente.</p><AcceptIntro label="Comenzar prueba técnica" /></article>;
  const blocks = [["Presentación", content.intro.presentation], ["Objetivo", content.intro.objective], ["Confidencialidad", content.intro.confidentiality], ["¿Quién debe responder este instrumento?", content.intro.audience], ["Instrucciones", content.intro.instructions]];
  return <article className="rounded-lg border bg-white p-6">
    <TestNotice certified={content.certified} />
    <h1 className="mt-5 text-2xl font-semibold">{content.title}</h1>
    {blocks.map(([heading, text]) => <section key={heading} className="mt-5"><h2 className="font-semibold">{heading}</h2><p className="mt-1 text-slate-700">{text}</p></section>)}
    <section className="mt-5"><h2 className="font-semibold">Escala de respuesta</h2><dl className="mt-2 grid grid-cols-[3rem_1fr] gap-y-1 text-slate-700">{content.scale.map(option => <div key={option.value} className="contents"><dt className="font-semibold">{option.value === "NA" ? "N/A" : option.value}</dt><dd>{option.label}</dd></div>)}</dl></section>
    <p className="mt-5 text-sm text-slate-600">Puedes guardar y continuar después con el enlace de tu invitación y un nuevo código. Para enviar, cada Elemento necesita al menos 60 % de respuestas válidas; las preguntas abiertas son opcionales.</p>
    <AcceptIntro label="Comenzar cuestionario" />
  </article>;
}
