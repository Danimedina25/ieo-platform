import { NextResponse } from "next/server";
import { readResults } from "@/application/results";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await readResults(await requestToken(), (await params).id, new URL(request.url).searchParams.get("run")), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Recurso no disponible." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
