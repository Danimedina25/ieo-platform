import { NextResponse } from "next/server";
import { login, logout } from "@/application/authentication";
import { sessionCookie } from "@/lib/config";
import { boundedJson, validMutationOrigin } from "@/lib/http-security";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!validMutationOrigin(request)) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
    let input: unknown;
    try { input = await boundedJson(request); }
    catch { return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: 400 }); }
    const result = await login(input);
    if (!result.ok) return NextResponse.json({ error: "Correo o contraseña incorrectos." }, { status: result.limited ? 429 : 401, headers: { "Cache-Control": "no-store" } });
    await logout(await requestToken());
    const cookie = sessionCookie();
    const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(cookie.name, result.token, { ...cookie.options, expires: result.expiresAt });
    return response;
  } catch {
    console.error("AUTH_LOGIN_FAILED_INTERNAL");
    return NextResponse.json({ error: "No se pudo iniciar sesión. Intenta nuevamente." }, { status: 500 });
  }
}
