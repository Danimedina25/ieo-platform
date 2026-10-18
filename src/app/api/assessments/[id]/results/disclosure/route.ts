import { recordDisclosure } from "@/application/results";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mutationResponse(request, async input => recordDisclosure(await requestToken(), (await params).id, input));
}
