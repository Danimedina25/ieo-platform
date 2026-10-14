import type { PrismaClient } from "@/generated/prisma/client";
import { catalogContentHash, type InstrumentCatalog } from "@/domain/survey/catalog";
import colCatalogJson from "@/domain/survey/catalogs/ieo-col-01-v1.0.json";

export type VersionedCatalog = InstrumentCatalog & { contentHash: string };
export const colCatalog = colCatalogJson as unknown as VersionedCatalog;

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
