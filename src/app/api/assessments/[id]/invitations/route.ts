import { createInvitation, listInvitations } from "@/application/participant/invitations";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await listInvitations(await requestToken(), (await params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Recurso no disponible." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mutationResponse(request, async input => createInvitation(await requestToken(), (await params).id, input));
}
