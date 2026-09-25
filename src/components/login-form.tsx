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
      <input id="password" type="password" autoComplete="current-password" maxLength={128} required aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} {...register("password")} className="min-h-12 w-full rounded-md border border-slate-400 bg-white px-3 text-base" /></div>
    {error && <p id="login-error" role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <button type="submit" disabled={isSubmitting} className="min-h-12 w-full rounded-md bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-60">{isSubmitting ? "Iniciando sesión…" : "Iniciar sesión"}</button>
  </form>;
}
