import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/infrastructure/persistence/db";
import { seedDemo, demoIds, seedEnvironment } from "../../prisma/seed-data";
import { login } from "@/application/authentication";
import { createAssessment, updateAssessmentGeneral, updateAssessmentPerspective, createSegment, updateSegment, deactivateSegment, readWorkspace } from "@/application/workspace";
import { listAssessmentMetadata } from "@/application/assessments";
const tokens: Record<string, string> = {};
const created: { assessmentIds: string[]; organizationIds: string[] } = { assessmentIds: [], organizationIds: [] };
const tag = randomUUID().slice(0, 8);
let assessmentId = "";
let segmentId = "";
const general = { name: `Actualizado ${tag}`, period: "2026", objective: "Objetivo sintético", timezone: "America/Cancun", plannedOpensAt: "2026-10-01T12:00:00.000Z", plannedClosesAt: "2026-10-02T12:00:00.000Z", scopeUnitsText: "Unidad demo", sponsorName: "Sponsor sintético", consultantUserId: null, coordinatorUserId: null, methodologyNotes: "Solo prueba" };
beforeAll(async () => {
  await seedDemo(db()); const env = seedEnvironment();
  for (const [key, email, password] of [["consultant", "consultor@ieo.local", env.SEED_USER_PASSWORD], ["coordinator", "coordinador@ieo.local", env.SEED_USER_PASSWORD], ["other", "consultor2@ieo.local", env.SEED_USER_PASSWORD], ["admin", env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD]]) {
    const result = await login({ email, password }); if (!result.ok) throw new Error("Fixture login falló"); tokens[key] = result.token;
  }
});
afterAll(async () => {
  for (const id of created.assessmentIds) {
    await db().auditLog.deleteMany({ where: { assessmentId: id } });
    await db().segment.deleteMany({ where: { assessmentId: id } });
    await db().assessmentPerspective.deleteMany({ where: { assessmentId: id } });
    await db().assessment.delete({ where: { id } });
  }
  for (const id of created.organizationIds) {
    await db().auditLog.deleteMany({ where: { organizationId: id } });
    await db().organizationMembership.deleteMany({ where: { organizationId: id } });
    await db().organization.delete({ where: { id } });
  }
  await db().$disconnect();
});
it("INT-01 crear en organización existente produce 1 diagnóstico y exactamente 5 perspectivas", async () => {
  const result = await createAssessment(tokens.consultant, { organization: { kind: "existing", id: demoIds.organizationA }, name: `Integración A ${tag}`, period: "2026", objective: null });
  assessmentId = result.id; created.assessmentIds.push(result.id);
  expect(await db().assessment.count({ where: { id: result.id } })).toBe(1);
  const rows = await db().assessmentPerspective.findMany({ where: { assessmentId } });
  expect(rows.map(row => row.perspectiveCode).sort()).toEqual(["CLI", "COL", "DIR", "ESP", "LID"]);
});
it("INT-02 nueva organización, membresía y cinco perspectivas quedan atómicas", async () => {
  const name = `Organización integrada ${tag}`;
  const result = await createAssessment(tokens.consultant, { organization: { kind: "new", name }, name: `Integración nueva ${tag}`, period: "2026", objective: null });
  created.assessmentIds.push(result.id);
  const row = await db().assessment.findUniqueOrThrow({ where: { id: result.id } }); created.organizationIds.push(row.organizationId);
  expect(await db().organizationMembership.count({ where: { organizationId: row.organizationId, role: "IEO_CONSULTANT" } })).toBe(1);
  expect(await db().assessmentPerspective.count({ where: { assessmentId: result.id } })).toBe(5);
  expect(await db().auditLog.count({ where: { organizationId: row.organizationId, action: "ORGANIZATION_CREATED" } })).toBe(1);
  await expect(db().$transaction(async tx => {
    const org = await tx.organization.create({ data: { name: `Rollback ${tag}` } });
    await tx.organizationMembership.create({ data: { organizationId: org.id, userId: (await db().user.findUniqueOrThrow({ where: { email: "consultor@ieo.local" } })).id, role: "IEO_CONSULTANT" } });
    throw new Error("Synthetic failure before assessment");
  })).rejects.toThrow();
  expect(await db().organization.count({ where: { name: `Rollback ${tag}` } })).toBe(0);
});
it("INT-03 consultor A no crea en B", async () => {
  await expect(createAssessment(tokens.consultant, { organization: { kind: "existing", id: demoIds.organizationB }, name: "Prohibido", period: "2026" })).rejects.toThrow();
});
it("INT-04/05 coordinador no crea ni edita General", async () => {
  await expect(createAssessment(tokens.coordinator, { organization: { kind: "existing", id: demoIds.organizationA }, name: "Prohibido", period: "2026" })).rejects.toThrow();
  await expect(updateAssessmentGeneral(tokens.coordinator, assessmentId, general)).rejects.toThrow();
});
it("INT-06 consultor actualiza General y responsables requieren rol/organización", async () => {
  const own = await db().user.findUniqueOrThrow({ where: { email: "consultor@ieo.local" } });
  const coord = await db().user.findUniqueOrThrow({ where: { email: "coordinador@ieo.local" } });
  await updateAssessmentGeneral(tokens.consultant, assessmentId, { ...general, consultantUserId: own.id, coordinatorUserId: coord.id });
  const stored = await db().assessment.findUniqueOrThrow({ where: { id: assessmentId } });
  expect(stored.objective).toBe("Objetivo sintético"); expect(stored.coordinatorUserId).toBe(coord.id);
  expect(stored.plannedOpensAt?.toISOString()).toBe("2026-10-01T12:00:00.000Z");
  expect(stored.plannedClosesAt?.toISOString()).toBe("2026-10-02T12:00:00.000Z");
  await expect(updateAssessmentGeneral(tokens.consultant, assessmentId, { ...general, consultantUserId: coord.id })).rejects.toThrow();
  const outsider = await db().user.findUniqueOrThrow({ where: { email: "consultor2@ieo.local" } });
  await expect(updateAssessmentGeneral(tokens.consultant, assessmentId, { ...general, coordinatorUserId: outsider.id })).rejects.toThrow();
  await expect(updateAssessmentGeneral(tokens.admin, assessmentId, general)).rejects.toThrow();
});
it("INT-07 configura DIR ESP LID COL CLI; INT-08 NULL sigue técnico", async () => {
  const rows = await db().assessmentPerspective.findMany({ where: { assessmentId } });
  expect(rows.every(row => row.applicability === null)).toBe(true);
  expect(await db().assessmentPerspective.count({ where: { assessmentId: demoIds.assessmentA } })).toBe(5);
  for (const perspectiveCode of ["DIR", "ESP", "LID", "COL", "CLI"]) {
    await updateAssessmentPerspective(tokens.consultant, assessmentId, perspectiveCode, { applicability: "APPLICABLE", populationEstimate: 15, collectionMode: "CENSUS", notes: null, cliUnitType: perspectiveCode === "CLI" ? "B2B" : null });
  }
  expect(await db().assessmentPerspective.count({ where: { assessmentId, applicability: "APPLICABLE" } })).toBe(5);
});
it("INT-09 estados no aplicable y no disponible permanecen distintos", async () => {
  await updateAssessmentPerspective(tokens.consultant, assessmentId, "ESP", { applicability: "NOT_APPLICABLE", populationEstimate: null, collectionMode: null, notes: null, cliUnitType: null });
  await updateAssessmentPerspective(tokens.consultant, assessmentId, "LID", { applicability: "NOT_AVAILABLE", populationEstimate: null, collectionMode: null, notes: "Motivo sintético", cliUnitType: null });
  const rows = await db().assessmentPerspective.findMany({ where: { assessmentId, perspectiveCode: { in: ["ESP", "LID"] } } });
  expect(rows.find(row => row.perspectiveCode === "ESP")?.applicability).toBe("NOT_APPLICABLE");
  expect(rows.find(row => row.perspectiveCode === "LID")?.applicability).toBe("NOT_AVAILABLE");
});
it("INT-10/11 población negativa y B2B en DIR rechazados", async () => {
  await expect(updateAssessmentPerspective(tokens.consultant, assessmentId, "DIR", { applicability: "APPLICABLE", populationEstimate: -1, collectionMode: null, notes: null, cliUnitType: null })).rejects.toThrow();
  await expect(updateAssessmentPerspective(tokens.consultant, assessmentId, "DIR", { applicability: "APPLICABLE", populationEstimate: 1, collectionMode: null, notes: null, cliUnitType: "B2B" })).rejects.toThrow();
  const dir = await db().assessmentPerspective.findUniqueOrThrow({ where: { assessmentId_perspectiveCode: { assessmentId, perspectiveCode: "DIR" } } });
  expect(dir.populationEstimate).toBe(15); expect(dir.cliUnitType).toBeNull();
});
it("INT-12/13 segmento creado en A; B no lo modifica", async () => {
  const result = await createSegment(tokens.consultant, assessmentId, { dimension: "Área", label: `Ventas ${tag}`, reportabilityStatus: "PENDING", reason: null });
  segmentId = result.id;
  expect((await db().segment.findUniqueOrThrow({ where: { id: segmentId } })).assessmentId).toBe(assessmentId);
  await expect(updateSegment(tokens.other, assessmentId, segmentId, { dimension: "Área", label: `Ventas ${tag}`, reportabilityStatus: "NOT_REPORTABLE", reason: null })).rejects.toThrow();
});
it("INT-14 desactivar conserva registro, INT-15 auditoría registra operaciones", async () => {
  await updateSegment(tokens.consultant, assessmentId, segmentId, { dimension: "Área", label: `Ventas ${tag}`, reportabilityStatus: "NOT_REPORTABLE", reason: "Segmento singular" });
  await deactivateSegment(tokens.consultant, assessmentId, segmentId);
  expect((await db().segment.findUniqueOrThrow({ where: { id: segmentId } })).active).toBe(false);
  const actions = (await db().auditLog.findMany({ where: { assessmentId }, select: { action: true } })).map(row => row.action);
  for (const action of ["ASSESSMENT_CREATED", "ASSESSMENT_UPDATED", "PERSPECTIVE_UPDATED", "SEGMENT_CREATED", "SEGMENT_UPDATED", "SEGMENT_DEACTIVATED"]) expect(actions).toContain(action);
  expect(JSON.stringify(await db().auditLog.findMany({ where: { assessmentId } }))).not.toContain(seedEnvironment().SEED_USER_PASSWORD);
});
it("consultor y coordinador leen workspace; admin sólo metadata", async () => {
  expect((await readWorkspace(tokens.consultant, assessmentId))?.kind).toBe("workspace");
  const coordinator = await readWorkspace(tokens.coordinator, assessmentId);
  expect(coordinator?.kind).toBe("workspace"); if (coordinator?.kind === "workspace") expect(coordinator.canEdit).toBe(false);
  expect((await readWorkspace(tokens.other, assessmentId))).toBeNull();
  const admin = await readWorkspace(tokens.admin, assessmentId);
  expect(admin?.kind).toBe("technical"); if (admin?.kind === "technical") expect(Object.keys(admin.metadata).sort()).toEqual(["id", "name", "organization", "period", "status"]);
  expect((await listAssessmentMetadata(tokens.consultant)).some(x => x.id === assessmentId)).toBe(true);
});

it("TECH_ADMIN con membresía explícita de consultor puede configurar sólo esa organización", async () => {
  const admin = await db().user.findUniqueOrThrow({ where: { email: seedEnvironment().SEED_ADMIN_EMAIL } });
  const key = { organizationId: demoIds.organizationA, userId: admin.id, role: "IEO_CONSULTANT" as const };
  await db().organizationMembership.create({ data: key });
  try {
    const view = await readWorkspace(tokens.admin, assessmentId);
    expect(view?.kind).toBe("workspace"); if (view?.kind === "workspace") expect(view.canEdit).toBe(true);
    await updateAssessmentPerspective(tokens.admin, assessmentId, "COL", { applicability: "APPLICABLE", populationEstimate: 20, collectionMode: "SAMPLE", notes: null, cliUnitType: null });
    await expect(updateAssessmentGeneral(tokens.admin, demoIds.assessmentB, general)).rejects.toThrow();
  } finally { await db().organizationMembership.delete({ where: { organizationId_userId_role: key } }); }
});
