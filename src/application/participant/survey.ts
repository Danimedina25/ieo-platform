import "server-only";
import { db } from "@/infrastructure/persistence/db";
import { authParticipant, ParticipantError } from "./access";
import { sessionSurvey } from "./instruments";
import { surveyItems, validateAnswer, SurveyAnswerError, type SurveyAnswer } from "@/domain/survey/definition";
import { submissionCheck } from "@/domain/survey/coverage";
import { patchSurveySchema, submitSurveySchema } from "@/domain/survey/schemas";
import { decryptOpenText, encryptOpenText } from "@/infrastructure/participant/crypto";
const conflict = () => { throw new ParticipantError(409, "La sesión cambió. Vuelve a cargar el cuestionario."); };
// Sessions of the retired Phase 3A technical survey have no instrument and can no longer be answered.
async function surveyOf(client: Parameters<typeof sessionSurvey>[0], instrumentVersionId: string | null) {
  if (!instrumentVersionId) throw new ParticipantError(410, "Este cuestionario de prueba ya no está disponible.");
  return sessionSurvey(client, instrumentVersionId);
}
export async function acceptIntro(bearer: string | undefined) {
  const auth = await authParticipant(bearer);
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Invitation WHERE id = ${auth.binding.invitationId} FOR UPDATE`;
    const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: auth.binding.invitationId }, include: { assessment: { select: { status: true } } } });
    const currentAuth = await tx.participantAuthSession.findUniqueOrThrow({ where: { id: auth.id } });
    if (currentAuth.revokedAt || invitation.status !== "VERIFIED" || invitation.assessment.status !== "DRAFT" || invitation.expiresAt <= new Date()) throw new ParticipantError(401, "Acceso no disponible.");
    const response = await tx.responseSession.findUniqueOrThrow({ where: { id: auth.binding.responseSessionId } });
    if (response.status !== "STARTED") conflict();
    const survey = await surveyOf(tx, response.instrumentVersionId);
    await tx.responseSession.updateMany({ where: { id: response.id, status: "STARTED", introAcceptedAt: null }, data: { introAcceptedAt: new Date(), introVersion: survey.introVersion } });
    return { ok: true };
  });
}
/** Intro/thanks content of the participant's own instrument. */
export async function participantContent(bearer: string | undefined) {
  const auth = await authParticipant(bearer);
  const survey = await surveyOf(db(), auth.binding.responseSession.instrumentVersionId);
  return { submitted: auth.binding.responseSession.status === "SUBMITTED", content: survey.content };
}
export async function readSurvey(bearer: string | undefined) {
  const auth = await authParticipant(bearer);
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Invitation WHERE id = ${auth.binding.invitationId} FOR UPDATE`;
    const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: auth.binding.invitationId }, include: { assessment: { select: { status: true } } } });
    const currentAuth = await tx.participantAuthSession.findUniqueOrThrow({ where: { id: auth.id } });
    if (currentAuth.revokedAt || !["VERIFIED", "COMPLETED"].includes(invitation.status) || invitation.assessment.status !== "DRAFT" || invitation.expiresAt <= new Date()) throw new ParticipantError(401, "Acceso no disponible.");
    const response = await tx.responseSession.findUniqueOrThrow({ where: { id: auth.binding.responseSessionId } });
    if (!response.introAcceptedAt) throw new ParticipantError(403, "Introducción requerida.");
    if (response.status === "SUBMITTED") return { submitted: true as const };
    if (response.status !== "STARTED") conflict();
    const survey = await surveyOf(tx, response.instrumentVersionId);
    const rows = await tx.surveyResponse.findMany({ where: { responseSessionId: response.id } });
    const answers: SurveyAnswer[] = rows.map(row => ({ itemKey: row.itemKey, answerState: row.answerState, numericValue: row.numericValue, textValue: row.textCiphertext ? decryptOpenText(row.textCiphertext) : null }));
    return { submitted: false as const, definition: survey.definition, revision: response.revision, answers };
  });
}
export async function saveSurvey(bearer: string | undefined, input: unknown) {
  const data = patchSurveySchema.parse(input);
  const auth = await authParticipant(bearer);
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Invitation WHERE id = ${auth.binding.invitationId} FOR UPDATE`;
    const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: auth.binding.invitationId }, include: { assessment: { select: { status: true, organizationId: true } } } });
    const currentAuth = await tx.participantAuthSession.findUniqueOrThrow({ where: { id: auth.id } });
    if (currentAuth.revokedAt || invitation.status !== "VERIFIED" || invitation.assessment.status !== "DRAFT" || invitation.expiresAt <= new Date()) throw new ParticipantError(401, "Acceso no disponible.");
    const response = await tx.responseSession.findUniqueOrThrow({ where: { id: auth.binding.responseSessionId } });
    if (response.status !== "STARTED" || !response.introAcceptedAt || response.revision !== data.expectedRevision) conflict();
    const survey = await surveyOf(tx, response.instrumentVersionId);
    const items = new Map(surveyItems(survey.definition).map(item => [item.key, item]));
    let valid;
    try { valid = data.answers.map(answer => validateAnswer(survey.definition, answer, items)); }
    catch (error) { if (error instanceof SurveyAnswerError) throw new ParticipantError(400, "Datos inválidos."); throw error; }
    await tx.responseSession.update({ where: { id: response.id }, data: { revision: { increment: 1 } } });
    for (const answer of valid) {
      const values = { answerState: answer.answerState, numericValue: answer.numericValue, textCiphertext: answer.textValue ? encryptOpenText(answer.textValue) : null };
      const catalog = { instrumentVersionId: survey.instrumentVersionId, questionVersionId: survey.questionIds.get(answer.item.key)! };
      await tx.surveyResponse.upsert({ where: { responseSessionId_itemKey: { responseSessionId: response.id, itemKey: answer.item.key } }, create: { responseSessionId: response.id, itemKey: answer.item.key, itemType: answer.item.type, ...catalog, ...values }, update: values });
    }
    return { revision: response.revision + 1 };
  });
}
export async function submitSurvey(bearer: string | undefined, input: unknown) {
  const data = submitSurveySchema.parse(input);
  const auth = await authParticipant(bearer);
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Invitation WHERE id = ${auth.binding.invitationId} FOR UPDATE`;
    const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: auth.binding.invitationId }, include: { assessment: { select: { status: true, organizationId: true } } } });
    const currentAuth = await tx.participantAuthSession.findUniqueOrThrow({ where: { id: auth.id } });
    if (currentAuth.revokedAt || !["VERIFIED", "COMPLETED"].includes(invitation.status) || invitation.assessment.status !== "DRAFT" || invitation.expiresAt <= new Date()) throw new ParticipantError(401, "Acceso no disponible.");
    const response = await tx.responseSession.findUniqueOrThrow({ where: { id: auth.binding.responseSessionId } });
    if (response.status === "SUBMITTED") return { submitted: true };
    if (response.status !== "STARTED" || !response.introAcceptedAt || response.revision !== data.expectedRevision) conflict();
    const survey = await surveyOf(tx, response.instrumentVersionId);
    const rows = await tx.surveyResponse.findMany({ where: { responseSessionId: response.id }, select: { itemKey: true, answerState: true } });
    const check = submissionCheck(survey.definition, rows);
    if (check.elementsBelow.length) {
      const labels = survey.definition.sections.filter(section => section.elementCode && check.elementsBelow.includes(section.elementCode)).map(section => section.label ?? section.title);
      throw new ParticipantError(422, `Para enviar, cada Elemento necesita al menos 60 % de respuestas válidas (sin contar N/A). Revisa: ${labels.join(", ")}.`);
    }
    await tx.responseSession.update({ where: { id: response.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.auditLog.create({ data: { organizationId: invitation.assessment.organizationId, assessmentId: invitation.assessmentId, action: "PARTICIPANT_TEST_SUBMITTED", entityType: "ResponseSession", entityId: response.id, metadataJson: { surveyCode: survey.definition.code, surveyVersion: survey.definition.version, isTest: true } } });
    return { submitted: true };
  });
}
