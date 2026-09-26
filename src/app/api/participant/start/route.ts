import { startAccess } from "@/application/participant/access";
import { participantMutation, participantResponse, setParticipantCookie } from "@/lib/participant-http";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) { return participantMutation(request, async body => {
  const { token } = z.object({ token: z.string() }).strict().parse(body);
  const result = await startAccess(token);
  const response = participantResponse({ ok: true });
  setParticipantCookie(response, "preauth", result.bearer, result.expiresAt);
  return response;
}, true); }
