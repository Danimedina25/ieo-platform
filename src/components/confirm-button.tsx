"use client";
import { useId, useRef, type ReactNode } from "react";

/** A button that asks for confirmation in a modal before running an action that is hard or impossible to undo. */
export function ConfirmButton({ label, title, children, confirmLabel, onConfirm, disabled, className, type = "button" }: {
  label: string; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; disabled?: boolean; className?: string;
  /** "submit" lets a surrounding form validate its required fields before the dialog opens. */
  type?: "button" | "submit";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return <>
    <button type={type} disabled={disabled} className={className} onClick={event => {
      if (type === "submit") { const form = event.currentTarget.form; event.preventDefault(); if (form && !form.reportValidity()) return; }
      dialog.current?.showModal();
    }}>{label}</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="m-auto w-[min(94vw,32rem)] rounded-xl border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/45">
      <div className="space-y-3 px-6 py-5">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <div className="space-y-2 text-sm text-slate-700">{children}</div>
      </div>
      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <button type="button" autoFocus onClick={() => dialog.current?.close()} className="min-h-11 rounded-md border border-slate-300 px-4 font-semibold">Cancelar</button>
        <button type="button" onClick={() => { dialog.current?.close(); onConfirm(); }} className="min-h-11 rounded-md bg-blue-900 px-4 font-semibold text-white">{confirmLabel}</button>
      </div>
    </dialog>
  </>;
}
