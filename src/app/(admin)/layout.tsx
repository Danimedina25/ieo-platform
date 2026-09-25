import Link from "next/link";
import { requirePageUser } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:block focus:bg-white focus:p-4">Saltar al contenido</a>
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-4 px-5 py-5 sm:px-8">
      <Link href="/diagnosticos" className="text-lg font-bold tracking-tight">Sistema Digital IEO®</Link>
      <nav aria-label="Principal"><Link href="/diagnosticos" className="text-sm font-semibold underline decoration-slate-300 underline-offset-8">Diagnósticos</Link></nav>
      <div className="ml-auto flex flex-wrap items-center gap-5"><span className="break-all text-sm text-slate-600">{user.name ?? user.email}</span>
        <form action="/api/auth/logout" method="post"><button className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50">Cerrar sesión</button></form>
      </div>
    </div></header>
    <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
  </>;
}
