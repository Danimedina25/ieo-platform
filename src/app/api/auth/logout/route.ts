import { NextResponse } from "next/server";
import { logout } from "@/application/authentication";
import { authConfig, sessionCookie } from "@/lib/config";
import { validMutationOrigin } from "@/lib/http-security";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (!validMutationOrigin(request)) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
    await logout(await requestToken());
    const response = NextResponse.redirect(new URL("/login", authConfig().origin), 303);
    const cookie = sessionCookie();
    response.cookies.set(cookie.name, "", { ...cookie.options, maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    console.error("AUTH_LOGOUT_FAILED_INTERNAL");
    return NextResponse.json({ error: "No se pudo cerrar sesión. Intenta nuevamente." }, { status: 500 });
  }
}
