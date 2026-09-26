import { resendOtp } from "@/application/participant/access";
import { cookieValue, participantMutation, participantResponse, setParticipantCookie } from "@/lib/participant-http";
export const runtime = "nodejs";
export async function POST(request: Request) { return participantMutation(request, async () => {
  const result = await resendOtp(await cookieValue("preauth"));
  const response = participantResponse({ ok: true });
  setParticipantCookie(response, "preauth", result.bearer, result.expiresAt);
  return response;
}); }
