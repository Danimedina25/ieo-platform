import type { PrismaClient } from "@/generated/prisma/client";
import { catalogContentHash, type InstrumentCatalog } from "@/domain/survey/catalog";
import { CURRENT_PACKAGE } from "@/domain/survey/package";
import dirCatalogJson from "@/domain/survey/catalogs/ieo-dir-01-v1.0.json";
import espCatalogJson from "@/domain/survey/catalogs/ieo-esp-01-v1.0.json";
import lidCatalogJson from "@/domain/survey/catalogs/ieo-lid-01-v1.0.json";
import colCatalogJson from "@/domain/survey/catalogs/ieo-col-01-v1.0.json";
import cliCatalogJson from "@/domain/survey/catalogs/ieo-cli-01-v1.0.json";

export type VersionedCatalog = InstrumentCatalog & { contentHash: string };
export const colCatalog = colCatalogJson as unknown as VersionedCatalog;
/** The five official v1.0 instruments, in perspective order DIR, ESP, LID, COL, CLI. */
export const officialCatalogs = [dirCatalogJson, espCatalogJson, lidCatalogJson, colCatalogJson, cliCatalogJson] as unknown as readonly VersionedCatalog[];

/** Verifies the stored hash still matches the catalog content (detects hand edits of the JSON). */
export function verifiedCatalog(file: VersionedCatalog): InstrumentCatalog {
  const { contentHash, ...catalog } = file;
  if (catalogContentHash(catalog) !== contentHash) throw new Error(`${file.instrumentCode} ${file.version}: el contenido no coincide con su contentHash.`);
  return catalog;
}

/** Idempotent, immutable load: an existing version must carry the same hash; it is never updated. */
export async function loadInstrumentCatalog(client: PrismaClient, file: VersionedCatalog) {
  const catalog = verifiedCatalog(file);
  return client.$transaction(async tx => {
    const existing = await tx.instrumentVersion.findUnique({ where: { instrumentCode_version: { instrumentCode: catalog.instrumentCode, version: catalog.version } } });
    if (existing) {
      if (existing.contentHash !== file.contentHash) throw new Error(`${catalog.instrumentCode} ${catalog.version} ya existe con otro contenido; publique una versión nueva.`);
      return { id: existing.id, created: false };
    }
    const version = await tx.instrumentVersion.create({ data: {
      instrumentCode: catalog.instrumentCode, version: catalog.version, perspectiveCode: catalog.perspectiveCode, title: catalog.title, certified: catalog.certified,
      contentHash: file.contentHash, sourcesJson: catalog.sources, correctionsJson: catalog.corrections, introJson: catalog.intro, thanksText: catalog.thanks,
    } });
    await tx.instrumentScaleOption.createMany({ data: catalog.scale.map((option, index) => ({ instrumentVersionId: version.id, valueCode: option.valueCode, label: option.label, displayOrder: index + 1 })) });
    const sectionIds = new Map<number, string>();
    for (const section of catalog.sections) {
      const row = await tx.instrumentSection.create({ data: { instrumentVersionId: version.id, elementCode: section.elementCode, label: section.label, title: section.title, introduction: section.introduction, instructions: section.instructions, displayOrder: section.displayOrder } });
      sectionIds.set(section.displayOrder, row.id);
    }
    await tx.questionVersion.createMany({ data: catalog.questions.map(question => ({
      instrumentVersionId: version.id, sectionId: sectionIds.get(question.sectionOrder)!, code: question.code, kind: question.kind, elementCode: question.elementCode,
      text: question.text, orientation: question.orientation, allowNA: question.allowNA, officialOrder: question.officialOrder, orderInElement: question.orderInElement,
      displayOrder: question.displayOrder, sourceGlobalId: question.sourceGlobalId, sourceOfficialCode: question.sourceOfficialCode, sourceLocator: question.sourceLocator,
    })) });
    await tx.auditLog.create({ data: { action: "INSTRUMENT_VERSION_LOADED", entityType: "InstrumentVersion", entityId: version.id, metadataJson: { instrumentCode: catalog.instrumentCode, version: catalog.version, contentHash: file.contentHash, certified: catalog.certified } } });
    return { id: version.id, created: true };
  });
}

/**
 * Loads the five catalogs and the IEO 1.0 package (exactly one instrument per perspective), then pins
 * DRAFT assessments created before Phase 4 to it. An existing package must reference the same versions.
 */
export async function loadOfficialCatalogs(client: PrismaClient) {
  const loaded: { perspectiveCode: VersionedCatalog["perspectiveCode"]; id: string; created: boolean }[] = [];
  for (const file of officialCatalogs) loaded.push({ perspectiveCode: file.perspectiveCode, ...await loadInstrumentCatalog(client, file) });
  return client.$transaction(async tx => {
    let pkg = await tx.methodologyPackage.findUnique({ where: { code_version: { code: CURRENT_PACKAGE.code, version: CURRENT_PACKAGE.version } }, include: { instruments: true } });
    if (pkg) {
      const same = pkg.instruments.length === loaded.length && loaded.every(row => pkg!.instruments.some(item => item.perspectiveCode === row.perspectiveCode && item.instrumentVersionId === row.id));
      if (!same) throw new Error(`Paquete ${CURRENT_PACKAGE.code} ${CURRENT_PACKAGE.version} ya existe con otros instrumentos; publique un paquete nuevo.`);
    } else {
      const created = await tx.methodologyPackage.create({ data: { ...CURRENT_PACKAGE, instruments: { create: loaded.map(row => ({ perspectiveCode: row.perspectiveCode, instrumentVersionId: row.id })) } } });
      await tx.auditLog.create({ data: { action: "METHODOLOGY_PACKAGE_LOADED", entityType: "MethodologyPackage", entityId: created.id, metadataJson: { code: CURRENT_PACKAGE.code, version: CURRENT_PACKAGE.version, instruments: officialCatalogs.map(file => `${file.instrumentCode}@${file.version}`) } } });
      pkg = { ...created, instruments: [] };
    }
    const pinned = await tx.assessment.updateMany({ where: { methodologyPackageId: null, status: "DRAFT" }, data: { methodologyPackageId: pkg.id } });
    return { packageId: pkg.id, instrumentsCreated: loaded.filter(row => row.created).length, assessmentsPinned: pinned.count };
  });
}
