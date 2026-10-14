import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/infrastructure/persistence/db";
import { definitionFromCatalog } from "@/domain/survey/from-catalog";
import { technicalSurvey } from "@/domain/survey/fixtures/technical-survey-v1";
import type { SurveyDefinition } from "@/domain/survey/definition";
import type { InstrumentCatalog } from "@/domain/survey/catalog";

// Phase 3B: only COL is served from the official catalog; other perspectives keep the technical survey until Phase 4.
const INSTRUMENT_BY_PERSPECTIVE: Partial<Record<string, { instrumentCode: string; version: string }>> = { COL: { instrumentCode: "IEO-COL-01", version: "1.0" } };
export const TECHNICAL_INTRO_VERSION = "TECH-1";

export type SessionSurvey = Readonly<{
  definition: SurveyDefinition;
  /** itemKey → QuestionVersion id; null for the technical survey. */
  questionIds: ReadonlyMap<string, string> | null;
  instrumentVersionId: string | null;
  introVersion: string;
  content: null | Readonly<{ title: string; intro: InstrumentCatalog["intro"]; scale: SurveyDefinition["scale"]; thanks: string; certified: boolean }>;
}>;
const technical: SessionSurvey = { definition: technicalSurvey, questionIds: null, instrumentVersionId: null, introVersion: TECHNICAL_INTRO_VERSION, content: null };
// Published instrument versions are immutable, so a per-process cache by id is safe.
const cache = new Map<string, SessionSurvey>();

type Client = Prisma.TransactionClient | ReturnType<typeof db>;
export async function instrumentVersionForPerspective(client: Client, perspectiveCode: string) {
  const reference = INSTRUMENT_BY_PERSPECTIVE[perspectiveCode];
  if (!reference) return null;
  const row = await client.instrumentVersion.findUnique({ where: { instrumentCode_version: reference }, select: { id: true, instrumentCode: true, version: true } });
  if (!row) throw new Error(`Catálogo ${reference.instrumentCode} ${reference.version} no cargado.`);
  // ResponseSession.surveyCode/surveyVersion keep the Phase 3A columns: instrument code and major version.
  return { instrumentVersionId: row.id, surveyCode: row.instrumentCode, surveyVersion: Number.parseInt(row.version, 10) };
}

export async function sessionSurvey(client: Client, instrumentVersionId: string | null): Promise<SessionSurvey> {
  if (!instrumentVersionId) return technical;
  const cached = cache.get(instrumentVersionId);
  if (cached) return cached;
  const version = await client.instrumentVersion.findUniqueOrThrow({ where: { id: instrumentVersionId }, include: {
    scaleOptions: { orderBy: { displayOrder: "asc" } },
    sections: { orderBy: { displayOrder: "asc" } },
    questions: { orderBy: { displayOrder: "asc" }, include: { section: { select: { displayOrder: true } } } },
  } });
  const scale = version.scaleOptions.map(option => ({ valueCode: option.valueCode as InstrumentCatalog["scale"][number]["valueCode"], label: option.label }));
  const definition = definitionFromCatalog({
    instrumentCode: version.instrumentCode, version: version.version, title: version.title, scale,
    sections: version.sections.map(section => ({ displayOrder: section.displayOrder, elementCode: section.elementCode, label: section.label, title: section.title, introduction: section.introduction, instructions: section.instructions })),
    questions: version.questions.map(question => ({ code: question.code, kind: question.kind, sectionOrder: question.section.displayOrder, elementCode: question.elementCode, text: question.text, orientation: question.orientation, allowNA: question.allowNA, officialOrder: question.officialOrder, orderInElement: question.orderInElement, displayOrder: question.displayOrder, sourceGlobalId: question.sourceGlobalId, sourceOfficialCode: question.sourceOfficialCode, sourceLocator: question.sourceLocator })),
  });
  const resolved: SessionSurvey = {
    definition,
    questionIds: new Map(version.questions.map(question => [question.code, question.id])),
    instrumentVersionId: version.id,
    introVersion: `${version.instrumentCode}@${version.version}:${version.contentHash.slice(0, 16)}`,
    content: { title: version.title, intro: version.introJson as InstrumentCatalog["intro"], scale: definition.scale, thanks: version.thanksText, certified: version.certified },
  };
  cache.set(instrumentVersionId, resolved);
  return resolved;
}
