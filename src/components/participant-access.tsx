"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function StartAccess() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function start() { setBusy(true); setError(""); try { const response = await fetch("/api/participant/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: window.location.pathname.split("/").at(-1) }) }); if (!response.ok) throw new Error((await response.json()).error); router.replace("/r/acceso"); } catch (issue) { setError(issue instanceof Error ? issue.message : "No fue posible continuar."); } finally { setBusy(false); } }
  return <><button onClick={start} disabled={busy} className="mt-8 min-h-12 w-full rounded-md bg-blue-900 px-5 py-3 font-semibold text-white disabled:opacity-50">Continuar y recibir código</button>{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</>;
}
export function VerifyAccess() {
  const router = useRouter(); const [otp, setOtp] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function verify(event: React.FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); try { const response = await fetch("/api/participant/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ otp }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); router.replace(body.next); } catch (issue) { setMessage(issue instanceof Error ? issue.message : "Código inválido."); } finally { setBusy(false); } }
  async function resend() { setBusy(true); setMessage(""); try { const response = await fetch("/api/participant/resend", { method: "POST" }); if (!response.ok) throw new Error((await response.json()).error); setMessage("Enviamos un nuevo código."); } catch (issue) { setMessage(issue instanceof Error ? issue.message : "No fue posible reenviar."); } finally { setBusy(false); } }
  return <><form onSubmit={verify} className="mt-7 space-y-4"><label className="block text-sm font-semibold">Código de 6 dígitos<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ""))} className="mt-2 min-h-12 w-full rounded border px-4 text-lg tracking-widest" /></label><button disabled={busy} className="min-h-12 w-full rounded bg-blue-900 px-5 font-semibold text-white disabled:opacity-50">Verificar</button></form><button onClick={resend} disabled={busy} className="mt-5 min-h-11 text-blue-900 underline">Solicitar otro código</button>{message && <p role="status" className="mt-3">{message}</p>}</>;
}
export function AcceptIntro({ label }: { label: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function accept() { setBusy(true); try { const response = await fetch("/api/participant/intro", { method: "POST" }); if (!response.ok) throw new Error((await response.json()).error); router.replace("/r/cuestionario"); } catch (issue) { setError(issue instanceof Error ? issue.message : "No fue posible continuar."); } finally { setBusy(false); } }
  return <><button onClick={accept} disabled={busy} className="mt-8 min-h-12 w-full rounded bg-blue-900 px-5 font-semibold text-white disabled:opacity-50">{label}</button>{error && <p role="alert" className="mt-3 text-red-700">{error}</p>}</>;
}
