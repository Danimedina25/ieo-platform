import "server-only";
import type { PerspectiveCode, Prisma } from "@/generated/prisma/client";
import { db } from "@/infrastructure/persistence/db";
import { definitionFromCatalog } from "@/domain/survey/from-catalog";
import type { SurveyDefinition } from "@/domain/survey/definition";
import type { InstrumentCatalog } from "@/domain/survey/catalog";


export type SessionSurvey = Readonly<{
  definition: SurveyDefinition;
  /** itemKey → QuestionVersion id. */
  questionIds: ReadonlyMap<string, string>;
  instrumentVersionId: string;
  introVersion: string;
  content: Readonly<{ title: string; intro: InstrumentCatalog["intro"]; scale: SurveyDefinition["scale"]; thanks: string; certified: boolean }>;
}>;
// Published instrument versions are immutable, so a per-process cache by id is safe.
const cache = new Map<string, SessionSurvey>();

type Client = Prisma.TransactionClient | ReturnType<typeof db>;
/** Instrument of a perspective inside the assessment's pinned methodology package; null if none is pinned. */
export async function instrumentVersionForPerspective(client: Client, assessmentId: string, perspectiveCode: PerspectiveCode) {
  const assessment = await client.assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { methodologyPackage: { select: { instruments: { where: { perspectiveCode }, select: { instrumentVersion: { select: { id: true, instrumentCode: true, version: true } } } } } } } });
  const row = assessment.methodologyPackage?.instruments[0]?.instrumentVersion;
  if (!row) return null;
  // ResponseSession.surveyCode/surveyVersion keep the Phase 3A columns: instrument code and major version.
  return { instrumentVersionId: row.id, surveyCode: row.instrumentCode, surveyVersion: Number.parseInt(row.version, 10) };
}

export async function sessionSurvey(client: Client, instrumentVersionId: string): Promise<SessionSurvey> {
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
