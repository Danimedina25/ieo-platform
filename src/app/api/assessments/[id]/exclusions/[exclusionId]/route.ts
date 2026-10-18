import { revokeExclusion } from "@/application/closure";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; exclusionId: string }> }) {
  return mutationResponse(request, async () => { const { id, exclusionId } = await params; return revokeExclusion(await requestToken(), id, exclusionId); }, false);
}
