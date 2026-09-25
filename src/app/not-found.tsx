import Link from "next/link";
export default function NotFound() { return <section className="mx-auto max-w-xl px-6 py-20"><h1 className="text-2xl font-semibold">Página no disponible</h1><p className="my-5 text-slate-600">El recurso solicitado no está disponible.</p><Link href="/diagnosticos" className="text-blue-900 underline">Volver a diagnósticos</Link></section>; }
