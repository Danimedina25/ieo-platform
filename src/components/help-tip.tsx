"use client";
import { useEffect, useId, useRef } from "react";
import { HELP, type HelpKey } from "@/domain/help/glossary";

const WIDTH = 288;

/**
 * A "?" button that opens a short explanation. Uses the native popover (top layer, closes with Esc or a tap
 * outside) and works with a tap, a click or the keyboard — never hover only. Phrasing content only (spans), so it
 * can sit inside a <p>, <th> or <caption>. Keep it outside <label> and <legend> so it does not become part of a field's accessible name.
 */
export function HelpTip({ term }: { term: HelpKey }) {
  const entry = HELP[term];
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLSpanElement>(null);
  function place() {
    const anchor = button.current?.getBoundingClientRect(); const node = panel.current;
    if (!anchor || !node) return;
    const left = Math.min(Math.max(8, anchor.left + anchor.width / 2 - WIDTH / 2), window.innerWidth - Math.min(WIDTH, window.innerWidth - 16) - 8);
    const below = anchor.bottom + 240 < window.innerHeight;
    node.style.left = `${left}px`; node.style.right = "auto";
    node.style.top = below ? `${anchor.bottom + 6}px` : "auto";
    node.style.bottom = below ? "auto" : `${window.innerHeight - anchor.top + 6}px`;
  }
  useEffect(() => {
    // The panel is fixed to the viewport: follow the button when the page (or a scrolling table) moves.
    const follow = () => { if (panel.current?.matches(":popover-open")) place(); };
    window.addEventListener("scroll", follow, { passive: true, capture: true });
    window.addEventListener("resize", follow);
    return () => { window.removeEventListener("scroll", follow, { capture: true }); window.removeEventListener("resize", follow); };
  }, []);
  return <>
    <button ref={button} type="button" popoverTarget={id} onClick={place} aria-label={`Ayuda: ${entry.title}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-400 bg-white align-middle text-xs font-bold text-slate-700 hover:border-blue-900 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900">?</button>
    <span ref={panel} id={id} popover="auto" className="fixed m-0 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-slate-300 bg-white p-4 text-left text-sm font-normal text-slate-800 shadow-xl">
      <span className="block font-semibold text-slate-900">{entry.title}</span>
      <span className="mt-1 block">{entry.text}</span>
      {"example" in entry && <span className="mt-2 block border-t border-dashed border-slate-300 pt-2 text-slate-600"><span className="font-semibold">Ejemplo:</span> {entry.example}</span>}
    </span>
  </>;
}
