import "server-only";
import { authenticateSession } from "./authentication";
import { db } from "@/infrastructure/persistence/db";
import { hasOrganizationAccess, hasOrganizationRole, isTechnicalAdmin, type OrganizationRole } from "@/domain/auth";
export class UnauthenticatedError extends Error {}
export class AccessDeniedError extends Error {}
export async function requireAuthenticatedUser(token: string | undefined) {
  const user = await authenticateSession(token);
  if (!user) throw new UnauthenticatedError("Autenticación requerida.");
  return user;
}
export async function requireTechnicalAdmin(token: string | undefined) {
  const user = await requireAuthenticatedUser(token);
  if (!isTechnicalAdmin(user)) throw new AccessDeniedError("Recurso no disponible.");
  return user;
}
export async function requireOrganizationAccess(token: string | undefined, organizationId: string) {
  const user = await requireAuthenticatedUser(token);
  const memberships = await db().organizationMembership.findMany({ where: { userId: user.id, organizationId }, include: { organization: { select: { status: true } } } });
  if (!hasOrganizationAccess(memberships, organizationId)) throw new AccessDeniedError("Recurso no disponible.");
  return user;
}
export async function requireOrganizationRole(token: string | undefined, organizationId: string, role: OrganizationRole) {
  const user = await requireAuthenticatedUser(token);
  const memberships = await db().organizationMembership.findMany({ where: { userId: user.id, organizationId }, include: { organization: { select: { status: true } } } });
  if (!hasOrganizationRole(memberships, organizationId, role)) throw new AccessDeniedError("Recurso no disponible.");
  return user;
}
