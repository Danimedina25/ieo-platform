"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Profiles = { consultant: boolean; coordinator: boolean; custodian: boolean; technicalAdmin: boolean };
type Step = { title: string; body: ReactNode };

// Seen-state is a per-browser convenience; the guide can always be reopened from the header.
const storageKey = (userId: string) => `ieo-quick-guide-v1:${userId}`;
function seen(userId: string) { try { return window.localStorage.getItem(storageKey(userId)) === "seen"; } catch { return false; } }
function markSeen(userId: string) { try { window.localStorage.setItem(storageKey(userId), "seen"); } catch { /* private mode: show again next time */ } }

function steps(profiles: Profiles): Step[] {
  const list: Step[] = [{ title: "Te damos la bienvenida al Sistema Digital IEO®", body: <>
    <p>El sistema es como un <strong>chequeo médico de la organización</strong>. Cinco grupos de personas (las <em>perspectivas</em>: Dirección, Especialistas, Liderazgo, Colaboradores y Voz del Cliente) opinan sobre los mismos ocho temas (los <em>Elementos</em>).</p>
    <p>El sistema envía los cuestionarios, protege la confidencialidad, calcula los resultados con las reglas oficiales y entrega la evidencia para interpretarla.</p>
  </> }];
  if (profiles.consultant) list.push(
    { title: "Tu trabajo, en cinco etapas", body: <>
      <p>Cada diagnóstico avanza así:</p>
      <ol className="list-decimal space-y-1 pl-5"><li><strong>Preparar:</strong> datos generales, perspectivas y participantes.</li><li><strong>Responder:</strong> abres la aplicación y las personas contestan.</li><li><strong>Documentar cierre:</strong> cierras, registras incidencias, dictamen de calidad y checklist.</li><li><strong>Calcular:</strong> congelas los datos y procesas.</li><li><strong>Interpretar:</strong> lees la matriz, registras patrones y descargas las exportaciones.</li></ol>
      <p>Arriba de cada diagnóstico verás esta barra de etapas.</p>
    </> },
    { title: "Siempre sabrás qué sigue", body: <>
      <p>La tarjeta azul <strong>«Siguiente paso»</strong> te dice qué falta para avanzar y te lleva a la pestaña correcta. Por ejemplo: «Para poder congelar falta el dictamen de Colaboradores».</p>
      <p>Las acciones que no se pueden deshacer (abrir, cerrar, congelar, reabrir, cancelar una invitación) siempre piden confirmación y te explican qué va a pasar.</p>
    </> },
    { title: "Las pestañas de un diagnóstico", body: <ul className="space-y-1">
      <li><strong>General:</strong> nombre, periodo, objetivo, fechas y responsables.</li>
      <li><strong>Perspectivas:</strong> qué grupos participan y cuántas personas tienen.</li>
      <li><strong>Participantes:</strong> las invitaciones por correo.</li>
      <li><strong>Cierre:</strong> abrir, cerrar, documentar la calidad, congelar y procesar.</li>
      <li><strong>Resultados:</strong> Índice Global, matriz, patrones, divulgación y citas.</li>
      <li><strong>Exportaciones:</strong> los archivos para tu reporte.</li>
    </ul> },
  );
  if (profiles.coordinator) list.push({ title: "Tu papel como coordinador interno", body: <>
    <p>Puedes consultar la información general y las perspectivas de los diagnósticos de tu organización, para apoyar la comunicación y la logística.</p>
    <p>No verás participantes, respuestas ni resultados individuales. Así se protege la confidencialidad: nadie de la organización puede saber quién respondió qué.</p>
  </> });
  if (profiles.custodian) list.push({ title: "Tu papel como custodio metodológico", body: <>
    <p>En la página <strong>Custodia</strong> apruebas, rechazas o revocas las solicitudes para descargar datos individuales.</p>
    <p>Sólo ves quién lo pide, para qué y por cuánto tiempo; nunca las respuestas. Aprueba cuando el propósito sea claro y la vigencia la mínima necesaria. Nadie, ni tú, puede aprobar su propia solicitud.</p>
  </> });
  if (profiles.technicalAdmin) list.push({ title: "Tu papel técnico", body: <p>Puedes ver los datos técnicos de los diagnósticos para dar mantenimiento a la plataforma. Por tu rol no ves resultados ni respuestas.</p> });
  list.push({ title: "¿Dudas en el camino?", body: <>
    <p>Junto a los conceptos difíciles hay un botón <span className="inline-flex size-6 items-center justify-center rounded-full border border-slate-400 text-xs font-bold" aria-hidden="true">?</span>. Tócalo y verás una explicación sencilla con un ejemplo.</p>
    <p>Puedes volver a ver esta guía cuando quieras desde <strong>«Guía rápida»</strong>, arriba a la derecha.</p>
  </> });
  return list;
}

export function QuickGuide({ userId, profiles, autoOpen }: { userId: string; profiles: Profiles; autoOpen: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const list = steps(profiles);
  const open = () => { setIndex(0); dialog.current?.showModal(); };
  useEffect(() => { if (autoOpen && !seen(userId)) dialog.current?.showModal(); }, [autoOpen, userId]);
  const step = list[index];
  const last = index === list.length - 1;
  return <>
    <button type="button" onClick={open} className="min-h-11 rounded-md px-3 text-sm font-semibold text-blue-900 underline underline-offset-4">Guía rápida</button>
    <dialog ref={dialog} aria-labelledby="guide-title" onClose={() => markSeen(userId)} className="m-auto w-[min(94vw,36rem)] rounded-xl border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/45">
      <div className="px-6 pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Guía rápida · Paso {index + 1} de {list.length}</p>
        <div className="mt-2 flex gap-1" aria-hidden="true">{list.map((_, position) => <span key={position} className={`h-1 flex-1 rounded ${position <= index ? "bg-blue-900" : "bg-slate-200"}`} />)}</div>
        <h2 id="guide-title" className="mt-4 text-xl font-semibold">{step.title}</h2>
        <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">{step.body}</div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
        <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 px-2 text-sm font-semibold text-slate-600 underline underline-offset-4">Saltar guía</button>
        <div className="flex gap-3">
          {index > 0 && <button type="button" onClick={() => setIndex(index - 1)} className="min-h-11 rounded-md border border-slate-300 px-4 font-semibold">Anterior</button>}
          <button type="button" autoFocus onClick={() => last ? dialog.current?.close() : setIndex(index + 1)} className="min-h-11 rounded-md bg-blue-900 px-4 font-semibold text-white">{last ? "Empezar" : "Siguiente"}</button>
        </div>
      </div>
    </dialog>
  </>;
}
