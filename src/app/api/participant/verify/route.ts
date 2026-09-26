import { verifyOtp } from "@/application/participant/access";
import { cookieValue, clearParticipantCookie, participantMutation, participantResponse, setParticipantCookie } from "@/lib/participant-http";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) { return participantMutation(request, async body => {
  const { otp } = z.object({ otp: z.string().regex(/^\d{6}$/) }).strict().parse(body);
  const result = await verifyOtp(await cookieValue("preauth"), otp);
  const response = participantResponse({ ok: true, next: result.submitted ? "/r/gracias" : result.introduced ? "/r/cuestionario" : "/r/introduccion" });
  setParticipantCookie(response, "auth", result.bearer, result.expiresAt);
  clearParticipantCookie(response, "preauth");
  return response;
}, true); }
