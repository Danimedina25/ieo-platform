import { NextResponse } from "next/server";
import { listQualitative, reviewQualitative } from "@/application/results";
import { mutationResponse } from "@/lib/mutation-response";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
// Open answers can hold identifying details: never cached, never logged.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const query = new URL(request.url).searchParams;
  try { return NextResponse.json(await listQualitative(await requestToken(), (await params).id, { runId: query.get("run") ?? "", perspectiveCode: query.get("perspective") || null, elementCode: query.get("element") || null }), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Recurso no disponible." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mutationResponse(request, async input => reviewQualitative(await requestToken(), (await params).id, input));
}
