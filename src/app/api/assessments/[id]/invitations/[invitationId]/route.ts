import { mutateInvitation } from "@/application/participant/invitations";
import { mutationResponse } from "@/lib/mutation-response";
import { z } from "zod";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function POST(request: Request, { params }: { params: Promise<{ id: string; invitationId: string }> }) {
  return mutationResponse(request, async input => {
    const data = z.object({ action: z.enum(["reissue", "cancel"]) }).strict().parse(input);
    const { id, invitationId } = await params;
    return mutateInvitation(await requestToken(), id, invitationId, data.action);
  });
}
