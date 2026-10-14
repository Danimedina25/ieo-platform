import "server-only";
import { CURRENT_PACKAGE } from "@/domain/survey/package";
import { Prisma, type Assessment, type AssessmentPerspective, type Segment } from "@/generated/prisma/client";
import { db } from "@/infrastructure/persistence/db";
import { requireAuthenticatedUser, AccessDeniedError } from "./authorization";
import { createAssessmentSchema, updateGeneralSchema, validatePerspectiveForCode, segmentSchema, perspectiveCodes } from "@/domain/assessment/schemas";
import { z } from "zod";

function unavailable(): never { throw new AccessDeniedError("Recurso no disponible."); }
function ensureDraft(status: Assessment["status"]) { if (status !== "DRAFT") unavailable(); }
async function consultantMembership(tx: Prisma.TransactionClient, userId: string, organizationId: string) {
  const membership = await tx.organizationMembership.findFirst({ where: { userId, organizationId, role: "IEO_CONSULTANT", active: true, user: { status: "ACTIVE" }, organization: { status: "ACTIVE" } } });
  if (!membership) unavailable();
}
async function draftForEdit(tx: Prisma.TransactionClient, userId: string, assessmentId: string) {
  const assessment = await tx.assessment.findUnique({ where: { id: assessmentId }, select: { id: true, organizationId: true, status: true } });
  if (!assessment) unavailable();
  await consultantMembership(tx, userId, assessment.organizationId);
  ensureDraft(assessment.status);
  return assessment;
}
export async function listCreationOrganizations(token: string | undefined) {
  const user = await requireAuthenticatedUser(token);
  const memberships = await db().organizationMembership.findMany({ where: { userId: user.id, role: "IEO_CONSULTANT", active: true, organization: { status: "ACTIVE" } }, select: { organization: { select: { id: true, name: true } } }, orderBy: { organization: { name: "asc" } } });
  return memberships.map(item => item.organization);
}
export async function createAssessment(token: string | undefined, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  const data = createAssessmentSchema.parse(input);
  const canCreate = await db().organizationMembership.count({ where: { userId: user.id, role: "IEO_CONSULTANT", active: true, organization: { status: "ACTIVE" } } });
  if (!canCreate) unavailable();
  return db().$transaction(async tx => {
    let organizationId: string;
    if (data.organization.kind === "new") {
      const organization = await tx.organization.create({ data: { name: data.organization.name } });
      organizationId = organization.id;
      await tx.organizationMembership.create({ data: { organizationId, userId: user.id, role: "IEO_CONSULTANT" } });
      await tx.auditLog.create({ data: { organizationId, actorUserId: user.id, action: "ORGANIZATION_CREATED", entityType: "Organization", entityId: organizationId } });
    } else {
      organizationId = data.organization.id;
      await consultantMembership(tx, user.id, organizationId);
    }
    // Pins the current methodology package so later instrument versions never change this assessment.
    const methodologyPackage = await tx.methodologyPackage.findUnique({ where: { code_version: { code: CURRENT_PACKAGE.code, version: CURRENT_PACKAGE.version } }, select: { id: true } });
    const assessment = await tx.assessment.create({ data: { organizationId, name: data.name, period: data.period, objective: data.objective, consultantUserId: user.id, methodologyPackageId: methodologyPackage?.id ?? null } });
    await tx.assessmentPerspective.createMany({ data: perspectiveCodes.map(perspectiveCode => ({ assessmentId: assessment.id, perspectiveCode })) });
    await tx.auditLog.create({ data: { organizationId, assessmentId: assessment.id, actorUserId: user.id, action: "ASSESSMENT_CREATED", entityType: "Assessment", entityId: assessment.id } });
    return { id: assessment.id };
  });
}
export async function updateAssessmentGeneral(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(assessmentId).success) unavailable();
  const data = updateGeneralSchema.parse(input);
  await db().$transaction(async tx => {
    const assessment = await draftForEdit(tx, user.id, assessmentId);
    if (data.consultantUserId) {
      const valid = await tx.organizationMembership.findFirst({ where: { organizationId: assessment.organizationId, userId: data.consultantUserId, role: "IEO_CONSULTANT", active: true, user: { status: "ACTIVE" } } });
      if (!valid) unavailable();
    }
    if (data.coordinatorUserId) {
      const valid = await tx.organizationMembership.findFirst({ where: { organizationId: assessment.organizationId, userId: data.coordinatorUserId, role: "ORG_COORDINATOR", active: true, user: { status: "ACTIVE" } } });
      if (!valid) unavailable();
    }
    const previous = await tx.assessment.findUniqueOrThrow({ where: { id: assessmentId } });
    const dates = { plannedOpensAt: data.plannedOpensAt ? new Date(data.plannedOpensAt) : null, plannedClosesAt: data.plannedClosesAt ? new Date(data.plannedClosesAt) : null };
    const update = { ...data, ...dates };
    const changed = Object.keys(update).filter(key => {
      const old = previous[key as keyof Assessment];
      const next = update[key as keyof typeof update];
      return old instanceof Date && next instanceof Date ? old.getTime() !== next.getTime() : old !== next;
    });
    await tx.assessment.update({ where: { id: assessmentId }, data: update });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "ASSESSMENT_UPDATED", entityType: "Assessment", entityId: assessmentId, metadataJson: { fieldNamesChanged: changed } } });
  });
  return { ok: true };
}
export async function updateAssessmentPerspective(token: string | undefined, assessmentId: string, code: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(assessmentId).success) unavailable();
  const { perspectiveCode, data } = validatePerspectiveForCode(code, input);
  await db().$transaction(async tx => {
    const assessment = await draftForEdit(tx, user.id, assessmentId);
    const previous = await tx.assessmentPerspective.findUnique({ where: { assessmentId_perspectiveCode: { assessmentId, perspectiveCode } } });
    if (!previous) unavailable();
    const updated = await tx.assessmentPerspective.update({ where: { assessmentId_perspectiveCode: { assessmentId, perspectiveCode } }, data });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "PERSPECTIVE_UPDATED", entityType: "AssessmentPerspective", entityId: updated.id, metadataJson: { code: perspectiveCode, oldStatus: previous.applicability, newStatus: updated.applicability } } });
  });
  return { ok: true };
}
export async function createSegment(token: string | undefined, assessmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(assessmentId).success) unavailable();
  const data = segmentSchema.parse(input);
  return db().$transaction(async tx => {
    const assessment = await draftForEdit(tx, user.id, assessmentId);
    const segment = await tx.segment.create({ data: { ...data, assessmentId } });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "SEGMENT_CREATED", entityType: "Segment", entityId: segment.id, metadataJson: { reportabilityStatus: data.reportabilityStatus } } });
    return { id: segment.id };
  });
}
export async function updateSegment(token: string | undefined, assessmentId: string, segmentId: string, input: unknown) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(assessmentId).success || !z.uuid().safeParse(segmentId).success) unavailable();
  const data = segmentSchema.parse(input);
  await db().$transaction(async tx => {
    const assessment = await draftForEdit(tx, user.id, assessmentId);
    const previous = await tx.segment.findFirst({ where: { id: segmentId, assessmentId, active: true } });
    if (!previous) unavailable();
    await tx.segment.update({ where: { id: segmentId }, data });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "SEGMENT_UPDATED", entityType: "Segment", entityId: segmentId, metadataJson: { oldStatus: previous.reportabilityStatus, newStatus: data.reportabilityStatus } } });
  });
  return { ok: true };
}
export async function deactivateSegment(token: string | undefined, assessmentId: string, segmentId: string) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(assessmentId).success || !z.uuid().safeParse(segmentId).success) unavailable();
  await db().$transaction(async tx => {
    const assessment = await draftForEdit(tx, user.id, assessmentId);
    const segment = await tx.segment.findFirst({ where: { id: segmentId, assessmentId, active: true } });
    if (!segment) unavailable();
    await tx.segment.update({ where: { id: segmentId }, data: { active: false } });
    await tx.auditLog.create({ data: { organizationId: assessment.organizationId, assessmentId, actorUserId: user.id, action: "SEGMENT_DEACTIVATED", entityType: "Segment", entityId: segmentId } });
  });
  return { ok: true };
}
export type WorkspacePerspective = Pick<AssessmentPerspective, "id" | "perspectiveCode" | "applicability" | "populationEstimate" | "collectionMode" | "notes" | "cliUnitType">;
export type WorkspaceSegment = Pick<Segment, "id" | "dimension" | "label" | "reportabilityStatus" | "reason" | "active">;
export async function readWorkspace(token: string | undefined, assessmentId: string) {
  const user = await requireAuthenticatedUser(token);
  if (!z.uuid().safeParse(assessmentId).success) return null;
  const assessment = await db().assessment.findUnique({ where: { id: assessmentId }, select: { id: true, organizationId: true, name: true, period: true, status: true, objective: true, timezone: true, plannedOpensAt: true, plannedClosesAt: true, scopeUnitsText: true, sponsorName: true, consultantUserId: true, coordinatorUserId: true, methodologyNotes: true, organization: { select: { name: true, status: true } }, perspectives: { orderBy: { perspectiveCode: "asc" }, select: { id: true, perspectiveCode: true, applicability: true, populationEstimate: true, collectionMode: true, notes: true, cliUnitType: true } }, segments: { orderBy: { createdAt: "asc" }, select: { id: true, dimension: true, label: true, reportabilityStatus: true, reason: true, active: true } } } });
  if (!assessment) return null;
  const membership = await db().organizationMembership.findMany({ where: { userId: user.id, organizationId: assessment.organizationId, active: true }, select: { role: true } });
  const hasMembership = assessment.organization.status === "ACTIVE" && membership.length > 0;
  if (!hasMembership && !user.technicalAdmin) return null;
  if (!hasMembership) return { kind: "technical" as const, metadata: { id: assessment.id, name: assessment.name, period: assessment.period, status: assessment.status, organization: { name: assessment.organization.name } } };
  const canEdit = membership.some(entry => entry.role === "IEO_CONSULTANT");
  const responsible = await db().organizationMembership.findMany({ where: { organizationId: assessment.organizationId, active: true, user: { status: "ACTIVE" } }, select: { role: true, user: { select: { id: true, name: true, email: true } } }, orderBy: { user: { email: "asc" } } });
  return { kind: "workspace" as const, assessment, canEdit, consultants: responsible.filter(item => item.role === "IEO_CONSULTANT").map(item => item.user), coordinators: responsible.filter(item => item.role === "ORG_COORDINATOR").map(item => item.user) };
}
