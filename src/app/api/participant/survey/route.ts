import { readSurvey, saveSurvey } from "@/application/participant/survey";
import { cookieValue, participantFailure, participantMutation, participantResponse } from "@/lib/participant-http";
export const runtime = "nodejs";
export async function GET() { try { return participantResponse(await readSurvey(await cookieValue("auth"))); } catch (error) { return participantFailure(error); } }
export async function PATCH(request: Request) { return participantMutation(request, async body => participantResponse(await saveSurvey(await cookieValue("auth"), body)), true); }
