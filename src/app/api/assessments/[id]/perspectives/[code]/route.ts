import { updateAssessmentPerspective } from "@/application/workspace";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; code: string }> }) {
  return mutationResponse(request, async input => { const { id, code } = await params; return updateAssessmentPerspective(await requestToken(), id, code, input); });
}
