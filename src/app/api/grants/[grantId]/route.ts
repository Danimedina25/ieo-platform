import { decideGrant } from "@/application/grants";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ grantId: string }> }) {
  return mutationResponse(request, async input => decideGrant(await requestToken(), (await params).grantId, input));
}
