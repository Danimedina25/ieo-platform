import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { AccessDeniedError, UnauthenticatedError } from "@/application/authorization";
import { boundedJson, validMutationOrigin } from "./http-security";

export async function mutationResponse<T>(request: Request, operation: (input: unknown) => Promise<T>, hasBody = true): Promise<NextResponse> {
  try {
    if (!validMutationOrigin(request)) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
    let input: unknown = undefined;
    if (hasBody) {
      try { input = await boundedJson(request, 16_384); }
      catch { return NextResponse.json({ error: "Datos inválidos." }, { status: 400 }); }
    }
    const result = await operation(input);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof UnauthenticatedError) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });
    if (error instanceof AccessDeniedError) return NextResponse.json({ error: "Recurso no disponible." }, { status: 404 });
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Revisa los campos indicados.", fields: error.issues.map(issue => issue.path.join(".")) }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Ya existe un registro con esos datos." }, { status: 409 });
    console.error("WORKSPACE_MUTATION_FAILED_INTERNAL");
    return NextResponse.json({ error: "No se pudieron guardar los cambios." }, { status: 500 });
  }
}
