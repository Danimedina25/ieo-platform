import "server-only";
import { db } from "@/infrastructure/persistence/db";
import { requireAuthenticatedUser, requireTechnicalAdmin } from "./authorization";
import type { Prisma } from "@/generated/prisma/client";
import type { AuthenticatedUser } from "@/domain/auth";
import { z } from "zod";
// This projection is the complete Phase 1 metadata contract. Never add analytical content here.
const metadata = { id: true, name: true, period: true, status: true, organization: { select: { name: true } } } satisfies Prisma.AssessmentSelect;
function organizationScope(user: AuthenticatedUser): Prisma.AssessmentWhereInput {
  return { organization: { status: "ACTIVE", memberships: { some: { userId: user.id, active: true, user: { status: "ACTIVE" } } } } };
}
export async function listAssessmentMetadata(token: string | undefined) {
  const user = await requireAuthenticatedUser(token);
  if (user.technicalAdmin) {
    await requireTechnicalAdmin(token);
    return db().assessment.findMany({ select: metadata, orderBy: { createdAt: "desc" } });
  }
  return db().assessment.findMany({ where: organizationScope(user), select: metadata, orderBy: { createdAt: "desc" } });
}
export async function readAssessmentMetadata(token: string | undefined, id: string) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(id).success) return null;
  if (user.technicalAdmin) {
    await requireTechnicalAdmin(token);
    return db().assessment.findUnique({ where: { id }, select: metadata });
  }
  return db().assessment.findFirst({ where: { id, ...organizationScope(user) }, select: metadata });
}
