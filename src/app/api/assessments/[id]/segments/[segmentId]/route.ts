import { updateSegment, deactivateSegment } from "@/application/workspace";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
type Params = { params: Promise<{ id: string; segmentId: string }> };
export async function PATCH(request: Request, { params }: Params) {
  return mutationResponse(request, async input => { const { id, segmentId } = await params; return updateSegment(await requestToken(), id, segmentId, input); });
}
export async function DELETE(request: Request, { params }: Params) {
  return mutationResponse(request, async () => { const { id, segmentId } = await params; return deactivateSegment(await requestToken(), id, segmentId); }, false);
}
