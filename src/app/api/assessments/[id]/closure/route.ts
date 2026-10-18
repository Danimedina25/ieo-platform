import { NextResponse } from "next/server";
import { readClosure } from "@/application/closure";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await readClosure(await requestToken(), (await params).id), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Recurso no disponible." }, { status: 404, headers: { "Cache-Control": "no-store" } }); }
}
