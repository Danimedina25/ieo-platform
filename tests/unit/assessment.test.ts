import { describe, expect, it } from "vitest";
import { createAssessmentSchema, updateGeneralSchema, configurePerspectiveSchema, perspectiveCodeSchema, segmentSchema, validatePerspectiveForCode } from "@/domain/assessment/schemas";
const configured = { applicability: "APPLICABLE", populationEstimate: 15, collectionMode: "CENSUS", notes: null, cliUnitType: null };
describe("captura del diagnóstico", () => {
  it("acepta sólo cinco códigos y preserva estado técnico nullable", () => {
    for (const code of ["DIR", "ESP", "LID", "COL", "CLI"]) expect(perspectiveCodeSchema.parse(code)).toBe(code);
    expect(perspectiveCodeSchema.safeParse("OTHER").success).toBe(false);
    expect(configurePerspectiveSchema.parse({ ...configured, applicability: null, populationEstimate: null, collectionMode: null }).applicability).toBeNull();
  });
  it("mantiene distintos no aplicable y no disponible, sin exigir población", () => {
    expect(configurePerspectiveSchema.parse({ ...configured, applicability: "NOT_APPLICABLE", populationEstimate: null, collectionMode: null }).applicability).toBe("NOT_APPLICABLE");
    expect(configurePerspectiveSchema.parse({ ...configured, applicability: "NOT_AVAILABLE", populationEstimate: null, collectionMode: null, notes: "No disponible en este periodo" }).applicability).toBe("NOT_AVAILABLE");
    expect(configurePerspectiveSchema.safeParse({ ...configured, applicability: "NOT_APPLICABLE" }).success).toBe(false);
  });
  it("población es entero no negativo y plan puede estar pendiente", () => {
    expect(configurePerspectiveSchema.parse({ ...configured, populationEstimate: 0, collectionMode: null }).populationEstimate).toBe(0);
    for (const bad of [-1, 1.5, "5"]) expect(configurePerspectiveSchema.safeParse({ ...configured, populationEstimate: bad }).success).toBe(false);
  });
  it("B2B/B2C sólo en CLI", () => {
    expect(validatePerspectiveForCode("CLI", { ...configured, cliUnitType: "B2B" }).data.cliUnitType).toBe("B2B");
    expect(() => validatePerspectiveForCode("DIR", { ...configured, cliUnitType: "B2C" })).toThrow();
  });
  it("reportabilidad inicia pendiente y usa sólo tres valores explícitos", () => {
    expect(segmentSchema.parse({ dimension: "Área", label: "Ventas", reportabilityStatus: "PENDING", reason: null }).reportabilityStatus).toBe("PENDING");
    expect(segmentSchema.safeParse({ dimension: "Área", label: "Ventas", reportabilityStatus: "PUBLIC", reason: null }).success).toBe(false);
  });
  it("creación valida organización/nombre/periodo y fechas UTC coherentes", () => {
    const creation = { organization: { kind: "new", name: "Organización de prueba" }, name: "Diagnóstico", period: "2026" };
    expect(createAssessmentSchema.parse(creation).objective).toBeNull();
    expect(createAssessmentSchema.safeParse({ ...creation, organization: { kind: "existing", id: "not-a-uuid" } }).success).toBe(false);
    const general = { name: "Diagnóstico", period: "2026", objective: null, timezone: "America/Cancun", plannedOpensAt: "2026-09-25T12:00:00.000Z", plannedClosesAt: "2026-09-25T13:00:00.000Z", scopeUnitsText: null, sponsorName: null, consultantUserId: null, coordinatorUserId: null, methodologyNotes: null };
    expect(updateGeneralSchema.safeParse(general).success).toBe(true);
    expect(updateGeneralSchema.safeParse({ ...general, plannedClosesAt: general.plannedOpensAt }).success).toBe(false);
    expect(updateGeneralSchema.safeParse({ ...general, timezone: "Invalid/Zone" }).success).toBe(false);
  });
});
