import { acceptIntro } from "@/application/participant/survey";
import { cookieValue, participantMutation, participantResponse } from "@/lib/participant-http";
export const runtime = "nodejs";
export async function POST(request: Request) { return participantMutation(request, async () => participantResponse(await acceptIntro(await cookieValue("auth")))); }
