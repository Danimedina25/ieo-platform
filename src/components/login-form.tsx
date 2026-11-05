"use client";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { loginSchema } from "@/domain/auth";
type LoginFields = { email: string; password: string };
export function LoginForm() {
  const router = useRouter();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginFields>();
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const submit = handleSubmit(async (values) => {
    setError("");
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) { setError("Correo o contraseña incorrectos."); return; }
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      if (response.ok) { router.replace("/diagnosticos"); router.refresh(); return; }
      setError(response.status >= 500 ? "No se pudo iniciar sesión. Intenta nuevamente." : "Correo o contraseña incorrectos.");
    } catch { setError("No se pudo iniciar sesión. Revisa tu conexión e intenta nuevamente."); }
  });
  return <form onSubmit={submit} className="space-y-6" aria-describedby={error ? "login-error" : undefined}>
    <div><label htmlFor="email" className="mb-2 block text-sm font-semibold">Correo</label>
      <input id="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} required aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} {...register("email")} className="min-h-12 w-full rounded-md border border-slate-400 bg-white px-3 text-base" /></div>
    <div><label htmlFor="password" className="mb-2 block text-sm font-semibold">Contraseña</label>
      <div className="relative">
        <input id="password" type={visible ? "text" : "password"} autoComplete="current-password" autoCapitalize="none" spellCheck={false} maxLength={128} required aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} {...register("password")} className="min-h-12 w-full rounded-md border border-slate-400 bg-white py-0 pl-3 pr-14 text-base" />
        <button type="button" onClick={() => setVisible(value => !value)} aria-controls="password" aria-pressed={visible} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-slate-600 hover:text-slate-900 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-900">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" />}
          </svg>
        </button>
      </div></div>
    {error && <p id="login-error" role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="submit" disabled={isSubmitting} className="min-h-12 w-full rounded-md bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}</button>
  </form>;
}
