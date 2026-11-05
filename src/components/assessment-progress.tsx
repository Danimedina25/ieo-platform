import Link from "next/link";
import { STAGES, type Guidance } from "@/domain/closure/guidance";
import type { AssessmentStatus } from "@/domain/closure/lifecycle";

/** The five lifecycle stages with the current one highlighted, plus (for consultants) what to do next. */
export function AssessmentProgress({ assessmentId, status, guidance, currentTab }: { assessmentId: string; status: AssessmentStatus; guidance: Guidance | null; currentTab: string }) {
  const current = STAGES.findIndex(stage => stage.status === status);
  return <div className="mt-8 space-y-4">
    <ol aria-label="Etapas del diagnóstico" className="grid grid-cols-5 gap-1 sm:gap-2">
      {STAGES.map((stage, index) => {
        const state = index < current ? "done" : index === current ? "current" : "next";
        return <li key={stage.status} aria-current={state === "current" ? "step" : undefined} className={`min-w-0 border-t-4 pt-2 ${state === "done" ? "border-green-700" : state === "current" ? "border-blue-900" : "border-slate-300"}`}>
          <p className={`text-xs font-semibold sm:text-sm ${state === "next" ? "text-slate-500" : state === "current" ? "text-blue-900" : "text-green-800"}`}>
            <span aria-hidden="true">{state === "done" ? "✓ " : `${index + 1}. `}</span>{stage.label}
            <span className="sr-only">{state === "done" ? " (completada)" : state === "current" ? " (etapa actual)" : " (pendiente)"}</span>
          </p>
          <p className="hidden text-xs text-slate-500 sm:block">{stage.description}</p>
        </li>;
      })}
    </ol>
    {guidance && <section aria-labelledby="next-step" className="rounded-lg border border-blue-200 bg-blue-50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Siguiente paso</p>
      <h2 id="next-step" className="mt-1 text-lg font-semibold">{guidance.title}</h2>
      <p className="mt-1 text-sm text-slate-700">{guidance.detail}</p>
      {guidance.pending.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-800">{guidance.pending.map(item => <li key={item}>{item}</li>)}</ul>}
      {guidance.tab !== currentTab && <Link href={`/diagnosticos/${assessmentId}?tab=${guidance.tab}`} className="mt-3 inline-flex min-h-11 items-center rounded bg-blue-900 px-4 text-sm font-semibold text-white">{guidance.action}</Link>}
    </section>}
  </div>;
}
