import { z } from "zod";
import { closeAssessment, freezeAssessment, openAssessment, processAssessment, reopenAssessment } from "@/application/closure";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
const actionSchema = z.object({ action: z.enum(["open", "close", "reopen", "freeze", "process"]), reason: z.string().optional() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mutationResponse(request, async input => {
    const { action, reason } = actionSchema.parse(input);
    const token = await requestToken(), id = (await params).id;
    if (action === "open") return openAssessment(token, id);
    if (action === "close") return closeAssessment(token, id);
    if (action === "reopen") return reopenAssessment(token, id, { reason: reason ?? "" });
    if (action === "freeze") return freezeAssessment(token, id);
    return processAssessment(token, id);
  });
}
