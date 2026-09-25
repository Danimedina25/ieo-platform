import { updateAssessmentGeneral } from "@/application/workspace";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mutationResponse(request, async input => updateAssessmentGeneral(await requestToken(), (await params).id, input));
}
