import { NextResponse } from "next/server";
import { z } from "zod";
import { buildExport } from "@/application/exports";
import { AccessDeniedError, UnauthenticatedError } from "@/application/authorization";
import { LifecycleError } from "@/application/closure";
import { boundedJson, validMutationOrigin } from "@/lib/http-security";
import { requestToken } from "@/lib/server-session";
export const runtime = "nodejs";
const json = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
// POST, not GET: generating an export writes its ExportRecord and audit entry, and must pass the Origin check.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) return json("Solicitud no permitida.", 403);
  let input: unknown;
  try { input = await boundedJson(request, 4_096); } catch { return json("Datos inválidos.", 400); }
  try {
    const { filename, buffer } = await buildExport(await requestToken(), (await params).id, input);
    return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return json("Sesión requerida.", 401);
    if (error instanceof AccessDeniedError) return json("Recurso no disponible.", 404);
    if (error instanceof LifecycleError) return json(error.message, error.status);
    if (error instanceof z.ZodError) return json("Datos inválidos.", 400);
    console.error("EXPORT_FAILED_INTERNAL");
    return json("No se pudo generar la exportación.", 500);
  }
}
