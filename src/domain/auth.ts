import { z } from "zod";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
export const loginSchema = z.object({
  email: z.string().max(254).transform(normalizeEmail).pipe(z.email()),
  password: z.string().min(1).max(128),
}).strict();

export type OrganizationRole = "IEO_CONSULTANT" | "ORG_COORDINATOR";
export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  technicalAdmin: boolean;
};
export type Membership = {
  organizationId: string;
  role: OrganizationRole;
  active: boolean;
  organization: { status: "ACTIVE" | "INACTIVE" };
};
export function hasOrganizationAccess(memberships: readonly Membership[], organizationId: string): boolean {
  return memberships.some(m => m.organizationId === organizationId && m.active && m.organization.status === "ACTIVE");
}
export function hasOrganizationRole(memberships: readonly Membership[], organizationId: string, role: OrganizationRole): boolean {
  return memberships.some(m => m.organizationId === organizationId && m.role === role && m.active && m.organization.status === "ACTIVE");
}
export function isTechnicalAdmin(user: AuthenticatedUser): boolean {
  return user.technicalAdmin;
}
export type SessionState = { expiresAt: Date; lastSeenAt: Date; revokedAt: Date | null };
export function isSessionValid(session: SessionState, now: Date, idleMinutes: number): boolean {
  return session.revokedAt === null && session.expiresAt > now &&
    session.lastSeenAt.getTime() + idleMinutes * 60_000 > now.getTime();
}
