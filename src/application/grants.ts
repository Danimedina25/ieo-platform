import "server-only";
import { z } from "zod";
import type { GrantScope, Prisma } from "@/generated/prisma/client";
import { db } from "@/infrastructure/persistence/db";
import { requireAuthenticatedUser, AccessDeniedError } from "./authorization";
import { LifecycleError } from "./closure";

// GAP-011 (provisional, 2026-10-18): the IEO consultant requests; a methodology custodian approves or rejects;
// nobody approves their own request and the technical administrator has no approval power. Max 30 days.
export const MAX_GRANT_DAYS = 30;
const requestSchema = z.object({ scope: z.enum(["RAW_RESPONSES", "INDIVIDUAL_SCORES", "QUALITATIVE_ORIGINAL"]), purpose: z.string().trim().min(10).max(2000), days: z.number().int().min(1).max(MAX_GRANT_DAYS) }).strict();
const decisionSchema = z.object({ action: z.enum(["approve", "reject", "revoke"]), note: z.string().trim().max(2000).nullable().optional() }).strict();
type Client = Prisma.TransactionClient | ReturnType<typeof db>;
type GrantRow = { approved: boolean | null; decidedAt: Date | null; revokedAt: Date | null; expiresAt: Date };
export function grantStatus(grant: GrantRow, now = new Date()) {
  if (grant.revokedAt) return "REVOKED" as const;
  if (grant.approved === false) return "REJECTED" as const;
  if (grant.expiresAt <= now) return "EXPIRED" as const;
  return grant.approved ? "ACTIVE" as const : "PENDING" as const;
}

async function consultantAssessment(client: Client, userId: string, assessmentId: string) {
  if (!z.uuid().safeParse(assessmentId).success) throw new AccessDeniedError();
  const assessment = await client.assessment.findFirst({ where: { id: assessmentId, organization: { status: "ACTIVE", memberships: { some: { userId, role: "IEO_CONSULTANT", active: true, user: { status: "ACTIVE" } } } } }, select: { id: true, organizationId: true } });
  if (!assessment) throw new AccessDeniedError();
  return assessment;
}
/** The requester's own approved, unrevoked, unexpired grant for this scope, or null. Revalidated on every export. */
export async function activeGrant(client: Client, assessmentId: string, userId: string, scope: GrantScope) {
  return client.sensitiveAccessGrant.findFirst({ where: { assessmentId, requestedById: userId, scope, approved: true, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" } });
}

export async function requestGrant(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = requestSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await consultantAssessment(tx, user.id, assessmentId);
    const requestedAt = new Date();
    const grant = await tx.sensitiveAccessGrant.create({ data: { assessmentId, scope: data.scope, purpose: data.purpose, requestedById: user.id, requestedAt, expiresAt: new Date(requestedAt.getTime() + data.days * 86400_000) } });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "GRANT_REQUESTED", entityType: "SensitiveAccessGrant", entityId: grant.id, metadataJson: { scope: data.scope, days: data.days } } });
    return { id: grant.id, status: "PENDING" as const };
  });
}

export async function decideGrant(token: string | undefined, grantId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = decisionSchema.parse(input);
  if (!z.uuid().safeParse(grantId).success) throw new AccessDeniedError();
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM SensitiveAccessGrant WHERE id = ${grantId} FOR UPDATE`;
    const grant = await tx.sensitiveAccessGrant.findUnique({ where: { id: grantId }, include: { assessment: { select: { organizationId: true } } } });
    if (!grant) throw new AccessDeniedError();
    const custodian = (await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { methodologyCustodian: true } })).methodologyCustodian;
    const status = grantStatus(grant);
    const now = new Date();
    let action: "GRANT_APPROVED" | "GRANT_REJECTED" | "GRANT_REVOKED";
    if (data.action === "revoke") {
      // The requester may give up their own grant; the custodian may revoke any.
      if (!custodian && grant.requestedById !== user.id) throw new AccessDeniedError();
      if (status !== "ACTIVE" && status !== "PENDING") throw new LifecycleError("El permiso ya no está vigente.");
      await tx.sensitiveAccessGrant.update({ where: { id: grantId }, data: { revokedAt: now, revokedById: user.id } });
      action = "GRANT_REVOKED";
    } else {
      if (!custodian) throw new AccessDeniedError();
      if (grant.requestedById === user.id) throw new LifecycleError("Nadie aprueba su propia solicitud.", 403);
      if (status !== "PENDING") throw new LifecycleError("La solicitud ya fue resuelta o venció.");
      await tx.sensitiveAccessGrant.update({ where: { id: grantId }, data: { approved: data.action === "approve", decidedAt: now, decidedById: user.id, decisionNote: data.note || null } });
      action = data.action === "approve" ? "GRANT_APPROVED" : "GRANT_REJECTED";
    }
    await tx.auditLog.create({ data: { organizationId: grant.assessment.organizationId, assessmentId: grant.assessmentId, actorUserId: user.id, action, entityType: "SensitiveAccessGrant", entityId: grantId, metadataJson: { scope: grant.scope } } });
    return { id: grantId, status: grantStatus(await tx.sensitiveAccessGrant.findUniqueOrThrow({ where: { id: grantId } })) };
  });
}

const grantSelect = { id: true, scope: true, purpose: true, requestedAt: true, expiresAt: true, approved: true, decidedAt: true, decisionNote: true, revokedAt: true, requestedById: true, requestedBy: { select: { name: true, email: true } }, decidedBy: { select: { name: true, email: true } } } satisfies Prisma.SensitiveAccessGrantSelect;
const view = (row: Prisma.SensitiveAccessGrantGetPayload<{ select: typeof grantSelect }>, userId: string) => ({
  id: row.id, scope: row.scope, purpose: row.purpose, requestedAt: row.requestedAt, expiresAt: row.expiresAt, decidedAt: row.decidedAt, decisionNote: row.decisionNote,
  status: grantStatus(row), requestedBy: row.requestedBy.name ?? row.requestedBy.email, decidedBy: row.decidedBy ? row.decidedBy.name ?? row.decidedBy.email : null, mine: row.requestedById === userId,
});
export async function listAssessmentGrants(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  await consultantAssessment(db(), user.id, assessmentId);
  const rows = await db().sensitiveAccessGrant.findMany({ where: { assessmentId }, orderBy: { requestedAt: "desc" }, select: grantSelect });
  return rows.map(row => view(row, user.id));
}
/** Custodian queue: grant metadata only (never answers or results). */
export async function listCustodianGrants(token: string | undefined) {
  const user = await requireAuthenticatedUser(token);
  const custodian = (await db().user.findUniqueOrThrow({ where: { id: user.id }, select: { methodologyCustodian: true } })).methodologyCustodian;
  if (!custodian) throw new AccessDeniedError();
  const rows = await db().sensitiveAccessGrant.findMany({ orderBy: { requestedAt: "desc" }, take: 200, select: { ...grantSelect, assessment: { select: { name: true, organization: { select: { name: true } } } } } });
  return rows.map(row => ({ ...view(row, user.id), assessment: row.assessment.name, organization: row.assessment.organization.name }));
}

export async function isCustodian(token: string | undefined) {
  const user = await requireAuthenticatedUser(token);
  return (await db().user.findUniqueOrThrow({ where: { id: user.id }, select: { methodologyCustodian: true } })).methodologyCustodian;
}
