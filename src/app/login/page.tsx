import { redirect } from "next/navigation";
import { authenticateSession } from "@/application/authentication";
import { requestToken } from "@/lib/server-session";
import { LoginForm } from "@/components/login-form";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  if (await authenticateSession(await requestToken())) redirect("/diagnosticos");
  return <main className="flex min-h-dvh items-center justify-center px-5 py-12"><div className="w-full max-w-md">
    <p className="mb-8 text-center text-lg font-bold tracking-tight">Sistema Digital IEO®</p>
    <section className="rounded-xl border border-slate-200 bg-white p-7 sm:p-10" aria-labelledby="login-heading">
      <h1 id="login-heading" className="text-2xl font-semibold tracking-tight">Acceso administrativo</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-slate-600">Ingresa con tus credenciales para acceder a tus diagnósticos.</p>
      <LoginForm />
    </section>
  </div></main>;
}
