import "server-only";
import { db } from "@/infrastructure/persistence/db";
import { authParticipant, ParticipantError } from "./access";
import { technicalSurvey, missingRequiredKeys, validateTechnicalAnswer, type SurveyAnswer } from "@/domain/survey/fixtures/technical-survey-v1";
import { patchSurveySchema, submitSurveySchema } from "@/domain/survey/schemas";
import { decryptOpenText, encryptOpenText } from "@/infrastructure/participant/crypto";
const conflict = () => { throw new ParticipantError(409, "La sesión cambió. Vuelve a cargar el cuestionario."); };
export async function acceptIntro(bearer: string | undefined) {
  const auth = await authParticipant(bearer);
  return db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM Invitation WHERE id = ${auth.binding.invitationId} FOR UPDATE`;
    const invitation = await tx.invitation.findUniqueOrThrow({ where: { id: auth.binding.invitationId }, include: { assessment: { select: { status: true } } } });
    const currentAuth = await tx.participantAuthSession.findUniqueOrThrow({ where: { id: auth.id } });
    if (currentAuth.revokedAt || invitation.status !== "VERIFIED" || invitation.assessment.status !== "DRAFT" || invitation.expiresAt <= new Date()) throw new ParticipantError(401, "Acceso no disponible.");
    const response = await tx.responseSession.findUniqueOrThrow({ where: { id: auth.binding.responseSessionId } });
    if (response.status !== "STARTED") conflict();
    await tx.responseSession.updateMany({ where: { id: response.id, status: "STARTED", introAcceptedAt: null }, data: { introAcceptedAt: new Date(), introVersion: "TECH-1" } });
    return { ok: true };
  });
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
    const rows = await tx.surveyResponse.findMany({ where: { responseSessionId: response.id } });
    const answers: SurveyAnswer[] = rows.map(row => ({ itemKey: row.itemKey, answerState: row.answerState, numericValue: row.numericValue, textValue: row.textCiphertext ? decryptOpenText(row.textCiphertext) : null }));
    return { submitted: false as const, definition: technicalSurvey, revision: response.revision, answers };
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
    await tx.responseSession.update({ where: { id: response.id }, data: { revision: { increment: 1 } } });
    for (const answer of data.answers) {
      const valid = validateTechnicalAnswer(answer);
      await tx.surveyResponse.upsert({ where: { responseSessionId_itemKey: { responseSessionId: response.id, itemKey: answer.itemKey } }, create: { responseSessionId: response.id, itemKey: answer.itemKey, itemType: valid.item.type, answerState: valid.answerState, numericValue: valid.numericValue, textCiphertext: valid.textValue ? encryptOpenText(valid.textValue) : null }, update: { answerState: valid.answerState, numericValue: valid.numericValue, textCiphertext: valid.textValue ? encryptOpenText(valid.textValue) : null } });
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
    const rows = await tx.surveyResponse.findMany({ where: { responseSessionId: response.id } });
    const missing = missingRequiredKeys(rows.map(row => ({ itemKey: row.itemKey, answerState: row.answerState })));
    if (missing.length) throw new ParticipantError(422, `Faltan respuestas obligatorias: ${missing.join(", ")}.`);
    await tx.responseSession.update({ where: { id: response.id }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    await tx.auditLog.create({ data: { organizationId: invitation.assessment.organizationId, assessmentId: invitation.assessmentId, action: "PARTICIPANT_TEST_SUBMITTED", entityType: "ResponseSession", entityId: response.id, metadataJson: { surveyCode: technicalSurvey.code, surveyVersion: technicalSurvey.version, isTest: true } } });
    return { submitted: true };
  });
}
