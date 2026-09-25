import { createAssessment } from "@/application/workspace";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return mutationResponse(request, async input => createAssessment(await requestToken(), input));
}
