import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ParticipantError } from "@/application/participant/access";
import { boundedJson, validMutationOrigin } from "@/lib/http-security";
import { participantCookie } from "@/infrastructure/participant/config";
export const privateHeaders = { "Cache-Control": "no-store, max-age=0", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
export function participantResponse(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: privateHeaders }); }
export function participantFailure(error: unknown) {
  if (error instanceof ParticipantError) return participantResponse({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return participantResponse({ error: "Datos inválidos." }, 400);
  console.error("PARTICIPANT_OPERATION_FAILED_INTERNAL");
  return participantResponse({ error: "No se pudo procesar la solicitud." }, 500);
}
export async function participantMutation(request: Request, action: (body: unknown) => Promise<NextResponse>, hasBody = false, maxBytes = 16_384) {
  if (!validMutationOrigin(request)) return participantResponse({ error: "Solicitud no permitida." }, 403);
  let body: unknown;
  if (hasBody) { try { body = await boundedJson(request, maxBytes); } catch { return participantResponse({ error: "Datos inválidos." }, 400); } }
  try { return await action(body); } catch (error) { return participantFailure(error); }
}
export async function cookieValue(kind: "auth" | "preauth") { return (await cookies()).get(participantCookie(kind).name)?.value; }
export function setParticipantCookie(response: NextResponse, kind: "auth" | "preauth", value: string, expires: Date) {
  const setting = participantCookie(kind);
  response.cookies.set(setting.name, value, { ...setting.options, expires });
}
export function clearParticipantCookie(response: NextResponse, kind: "auth" | "preauth") {
  const setting = participantCookie(kind);
  response.cookies.set(setting.name, "", { ...setting.options, maxAge: 0 });
}
