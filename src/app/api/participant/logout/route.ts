import { logoutParticipant } from "@/application/participant/access";
import { cookieValue, clearParticipantCookie, participantMutation, participantResponse } from "@/lib/participant-http";
export const runtime = "nodejs";
export async function POST(request: Request) { return participantMutation(request, async () => {
  const result = await logoutParticipant(await cookieValue("auth"));
  const response = participantResponse(result);
  clearParticipantCookie(response, "auth"); clearParticipantCookie(response, "preauth");
  return response;
}); }
