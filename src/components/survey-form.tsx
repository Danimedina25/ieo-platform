"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SurveyAnswer, SurveyDefinition, SurveyItem, SurveySection } from "@/domain/survey/definition";
import { elementCoverage, validNeeded, type ElementCoverage } from "@/domain/survey/coverage";

type Payload = { submitted: false; definition: SurveyDefinition; revision: number; answers: SurveyAnswer[] } | { submitted: true };
type Answers = Record<string, SurveyAnswer>;

export function TestNotice({ certified }: { certified: boolean }) {
  return <p role="note" className="rounded border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-950">PRUEBA — USE ÚNICAMENTE DATOS FICTICIOS.{certified ? "" : " Catálogo pendiente de certificación."} Esta aplicación no constituye aviso de privacidad ni consentimiento oficial.</p>;
}

const statusText: Record<ElementCoverage["status"], string> = { MEETS: "Cumple", BELOW: "Falta", ALL_NA: "Todo N/A" };
function coverageLine(row: ElementCoverage) {
  if (row.status === "ALL_NA") return "Todas las afirmaciones marcadas N/A: puedes enviar; este Elemento no se calificará para ti.";
  const needed = validNeeded(row);
  return `${row.valid} de ${row.total} respondidas · ${row.na} N/A · ${row.status === "MEETS" ? "cumple el mínimo" : `necesitas al menos ${needed} respuestas (1–5) para enviar`}`;
}

export function SurveyForm() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const current = useRef<Answers>({}); const dirty = useRef(new Set<string>()); const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const activeSave = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch("/api/participant/survey", { cache: "no-store" }).then(async response => {
      if (!response.ok) { router.replace(response.status === 403 ? "/r/introduccion" : "/r/acceso"); return; }
      const payload = await response.json() as Payload;
      if (payload.submitted) { router.replace("/r/gracias"); return; }
      if (!mounted) return;
      revision.current = payload.revision;
      current.current = Object.fromEntries(payload.answers.map(answer => [answer.itemKey, answer]));
      setAnswers(current.current); setData(payload);
    }).catch(() => { if (mounted) setMessage("No se pudo cargar el cuestionario."); });
    return () => { mounted = false; if (timer.current) clearTimeout(timer.current); };
  }, [router]);

  function update(answer: SurveyAnswer) {
    current.current = { ...current.current, [answer.itemKey]: answer }; dirty.current.add(answer.itemKey);
    setAnswers(current.current); setMessage("Cambios pendientes de guardar");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 700);
  }
  // Sends only the answers changed since the last successful save.
  async function save(): Promise<boolean> {
    if (activeSave.current) { await activeSave.current; }
    if (!dirty.current.size) return true;
    const keys = [...dirty.current]; dirty.current.clear();
    setSaving(true); setMessage("Guardando…");
    const task = (async () => {
      try {
        const response = await fetch("/api/participant/survey", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision.current, answers: keys.map(key => current.current[key]) }) });
        const body = await response.json();
        if (!response.ok) { keys.forEach(key => dirty.current.add(key)); setMessage(response.status === 409 ? "El cuestionario cambió en otra sesión. Recarga la página para continuar." : body.error || "No se pudieron guardar los cambios."); return false; }
        revision.current = body.revision; setMessage("Guardado"); return true;
      } catch { keys.forEach(key => dirty.current.add(key)); setMessage("Sin conexión. Vuelve a intentar guardar."); return false; }
      finally { setSaving(false); activeSave.current = null; }
    })();
    activeSave.current = task; return task;
  }
  async function go(target: number) { if (timer.current) clearTimeout(timer.current); if (await save()) { setStep(target); window.scrollTo(0, 0); } }
  async function submit() {
    if (timer.current) clearTimeout(timer.current);
    if (!await save()) return;
    setSaving(true);
    try {
      const response = await fetch("/api/participant/submit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedRevision: revision.current }) });
      const body = await response.json();
      if (!response.ok) { setMessage(body.error || "No se pudo enviar."); return; }
      router.replace("/r/gracias");
    } catch { setMessage("Sin conexión. Vuelve a intentar el envío."); }
    finally { setSaving(false); }
  }

  if (!data || data.submitted) return <p role="status">{message || "Cargando cuestionario…"}</p>;
  const { definition } = data;
  const status = <p role="status" className="mt-4 text-sm text-slate-600">{message || (saving ? "Guardando…" : "Los cambios se guardan automáticamente.")}</p>;
  const items = (section: SurveySection) => <div className="mt-6 space-y-6">{section.items.map(item => <Question key={item.key} item={item} answer={answers[item.key]} scale={definition.scale} byElement={definition.submissionRule === "ELEMENT_COVERAGE"} onChange={update} />)}</div>;

  if (definition.submissionRule === "REQUIRED_ITEMS") {
    const section = definition.sections[step];
    const last = step === definition.sections.length - 1;
    return <article className="rounded-lg border bg-white p-5 sm:p-7"><h1 className="text-xl font-bold">{definition.title}</h1><p className="mt-3 text-sm text-slate-600">Bloque {step + 1} de {definition.sections.length} · {section.title}</p>{items(section)}{status}
      <div className="mt-6 flex gap-3">{step > 0 && <button disabled={saving} onClick={() => setStep(value => value - 1)} className="min-h-12 rounded border px-5">Anterior</button>}<button disabled={saving} onClick={last ? submit : () => go(step + 1)} className="min-h-12 flex-1 rounded bg-blue-900 px-5 font-semibold text-white">{last ? "Enviar definitivamente" : "Siguiente"}</button></div></article>;
  }

  const coverage = elementCoverage(definition, Object.values(answers));
  const coverageOf = (section: SurveySection) => coverage.find(row => row.elementCode === section.elementCode);
  const reviewStep = definition.sections.length;
  const progress = <nav aria-label="Avance por Elemento" className="mt-4"><ol className="grid grid-cols-4 gap-2 sm:grid-cols-8">{definition.sections.map((section, index) => {
    const row = coverageOf(section);
    const tone = row?.status === "BELOW" ? "border-amber-500 bg-amber-50" : row?.missing === 0 || row?.status === "ALL_NA" ? "border-green-700 bg-green-50" : "border-blue-800 bg-blue-50";
    return <li key={section.id}><button type="button" disabled={saving} onClick={() => go(index)} aria-current={index === step ? "step" : undefined} aria-label={`${section.label}: ${row ? statusText[row.status] : ""}`} className={`min-h-11 w-full rounded border px-1 text-xs font-semibold ${tone} ${index === step ? "ring-2 ring-blue-900" : ""}`}>{section.label?.replace("Elemento ", "")}<span className="block font-normal">{row ? statusText[row.status] : ""}</span></button></li>;
  })}</ol><button type="button" disabled={saving} onClick={() => go(reviewStep)} aria-current={step === reviewStep ? "step" : undefined} className={`mt-2 min-h-11 w-full rounded border px-3 text-sm font-semibold ${step === reviewStep ? "ring-2 ring-blue-900" : ""}`}>Revisión y envío</button></nav>;

  if (step === reviewStep) {
    const below = definition.sections.filter(section => coverageOf(section)?.status === "BELOW");
    return <article className="rounded-lg border bg-white p-5 sm:p-7"><h1 className="text-xl font-bold">{definition.title}</h1>{progress}
      <h2 className="mt-6 text-lg font-semibold">Revisión antes de enviar</h2>
      <ul className="mt-3 space-y-2">{definition.sections.map((section, index) => { const row = coverageOf(section)!; return <li key={section.id} className="rounded border p-3"><p className="font-semibold">{section.label} · {section.title} — {statusText[row.status]}</p><p className="text-sm text-slate-600">{coverageLine(row)}</p>{row.status === "BELOW" && <button type="button" onClick={() => go(index)} className="mt-2 min-h-11 text-blue-900 underline">Ir a {section.label}</button>}</li>; })}</ul>
      {below.length > 0 ? <p role="alert" className="mt-4 text-amber-900">Para enviar, cada Elemento necesita al menos 60 % de respuestas válidas (sin contar N/A). Revisa: {below.map(section => section.label).join(", ")}.</p> : <p className="mt-4 text-slate-700">Al enviar, tus respuestas quedan registradas y ya no podrás modificarlas.</p>}
      {status}
      <div className="mt-6 flex gap-3"><button disabled={saving} onClick={() => go(reviewStep - 1)} className="min-h-12 rounded border px-5">Anterior</button><button disabled={saving || below.length > 0} onClick={submit} className="min-h-12 flex-1 rounded bg-blue-900 px-5 font-semibold text-white disabled:opacity-50">Enviar definitivamente</button></div></article>;
  }

  const section = definition.sections[step];
  const row = coverageOf(section);
  return <article className="rounded-lg border bg-white p-5 sm:p-7"><h1 className="text-xl font-bold">{definition.title}</h1>{progress}
    <h2 className="mt-6 text-lg font-semibold">{section.label} · {section.title}</h2>
    {section.introduction && <p className="mt-3 text-slate-700">{section.introduction}</p>}
    {section.instructions && <p className="mt-3 font-semibold">{section.instructions}</p>}
    <ScaleLegend scale={definition.scale} />
    {items(section)}
    {row && <p className={`mt-6 rounded p-3 text-sm ${row.status === "BELOW" ? "bg-amber-50 text-amber-950" : "bg-slate-50 text-slate-700"}`}>{coverageLine(row)}</p>}
    {status}
    <div className="mt-6 flex gap-3">{step > 0 && <button disabled={saving} onClick={() => go(step - 1)} className="min-h-12 rounded border px-5">Anterior</button>}<button disabled={saving} onClick={() => go(step + 1)} className="min-h-12 flex-1 rounded bg-blue-900 px-5 font-semibold text-white">{step === reviewStep - 1 ? "Ir a revisión" : "Siguiente"}</button></div></article>;
}

function ScaleLegend({ scale }: { scale: SurveyDefinition["scale"] }) {
  return <dl className="mt-4 grid grid-cols-[2.5rem_1fr] gap-y-1 rounded bg-slate-50 p-3 text-sm text-slate-700">{scale.map(option => <div key={option.value} className="contents"><dt className="font-semibold">{option.value === "NA" ? "N/A" : option.value}</dt><dd>{option.label}</dd></div>)}</dl>;
}

function Question({ item, answer, scale, byElement, onChange }: { item: SurveyItem; answer?: SurveyAnswer; scale: SurveyDefinition["scale"]; byElement: boolean; onChange: (answer: SurveyAnswer) => void }) {
  const value = answer?.answerState === "VALUE" ? answer.numericValue : answer?.answerState === "NA" ? "NA" : undefined;
  if (item.type === "TEXT") return <fieldset className="border-b pb-6"><legend className="font-semibold">{item.text}</legend>{byElement && <p className="text-sm text-slate-600">Pregunta abierta (opcional)</p>}<textarea maxLength={4000} value={answer?.textValue ?? ""} onChange={event => onChange({ itemKey: item.key, answerState: event.target.value.trim() ? "VALUE" : "MISSING", textValue: event.target.value })} className="mt-3 min-h-28 w-full rounded border p-3" aria-label={item.text} /></fieldset>;
  const options = scale.filter(option => option.value !== "NA" || item.allowNA);
  return <fieldset className="border-b pb-6"><legend className="font-semibold">{item.number && <span className="mr-1 text-slate-500">{item.number}.</span>}{item.text}{item.required && <span className="text-red-700"> *</span>}</legend>
    <div className="mt-3 flex flex-wrap gap-2">{options.map(option => {
      const optionValue = option.value === "NA" ? "NA" : Number(option.value);
      const select = () => onChange(option.value === "NA" ? { itemKey: item.key, answerState: "NA" } : { itemKey: item.key, answerState: "VALUE", numericValue: Number(option.value) });
      const text = option.value === "NA" ? (byElement ? "N/A" : "No aplica") : option.value;
      return <label key={option.value} title={byElement ? option.label : undefined} className="flex min-h-11 min-w-11 items-center justify-center rounded border px-3 has-[:checked]:border-blue-900 has-[:checked]:bg-blue-50"><input className="mr-2" type="radio" name={item.key} checked={value === optionValue} onChange={select} aria-label={byElement ? `${text} — ${option.label}` : undefined} />{text}</label>;
    })}<button type="button" onClick={() => onChange({ itemKey: item.key, answerState: "MISSING" })} className="min-h-11 px-2 text-sm text-slate-600 underline">Borrar</button></div></fieldset>;
}
