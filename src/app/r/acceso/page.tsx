import { VerifyAccess } from "@/components/participant-access";
export default function AccessPage() { return <article className="rounded-lg border bg-white p-6"><h1 className="text-2xl font-semibold">Verifica tu acceso</h1><p className="mt-4 text-slate-700">Introduce el código de 6 dígitos que enviamos al correo de tu invitación.</p><VerifyAccess /></article>; }
