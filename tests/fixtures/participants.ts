import { db } from "@/infrastructure/persistence/db";
import { emailLookupHmac, encryptEmail, encryptOpenText, hashBearer, randomBearer } from "@/infrastructure/participant/crypto";

/**
 * Inserts a synthetic participant directly (no OTP flow): invitation, binding and a session answered uniformly,
 * reverse items as 6 − value so every score is the same. Optionally adds the open answer of Element I.
 */
export async function insertParticipant(assessmentId: string, email: string, perspectiveCode: "DIR" | "ESP" | "LID" | "COL" | "CLI", value: number, status: "SUBMITTED" | "STARTED", openText: string | null) {
  const pkg = await db().assessment.findUniqueOrThrow({ where: { id: assessmentId }, select: { methodologyPackage: { select: { instruments: { where: { perspectiveCode }, select: { instrumentVersion: { include: { questions: true } } } } } } } });
  const instrument = pkg.methodologyPackage!.instruments[0].instrumentVersion;
  const perspective = await db().assessmentPerspective.findUniqueOrThrow({ where: { assessmentId_perspectiveCode: { assessmentId, perspectiveCode } } });
  const user = await db().user.findUniqueOrThrow({ where: { email: "consultor@ieo.local" } });
  const invitation = await db().invitation.create({ data: { assessmentId, assessmentPerspectiveId: perspective.id, emailCiphertext: encryptEmail(email), emailLookupHmac: emailLookupHmac(email), tokenHash: hashBearer(randomBearer()), status: status === "SUBMITTED" ? "COMPLETED" : "VERIFIED", expiresAt: new Date(Date.now() + 86400_000), createdById: user.id, isTest: true } });
  const session = await db().responseSession.create({ data: { assessmentId, assessmentPerspectiveId: perspective.id, surveyCode: instrument.instrumentCode, surveyVersion: 1, instrumentVersionId: instrument.id, status, submittedAt: status === "SUBMITTED" ? new Date() : null, introAcceptedAt: new Date(), introVersion: "test", isTest: true } });
  await db().participantAccessBinding.create({ data: { invitationId: invitation.id, responseSessionId: session.id } });
  await db().surveyResponse.createMany({ data: instrument.questions.filter(question => question.kind === "QUANT").map(question => ({ responseSessionId: session.id, itemKey: question.code, itemType: "LIKERT" as const, answerState: "VALUE" as const, numericValue: question.orientation === "REVERSE" ? 6 - value : value, instrumentVersionId: instrument.id, questionVersionId: question.id })) });
  let openResponseId: string | null = null;
  const openQuestion = instrument.questions.find(item => item.code === `${perspectiveCode}_E01_O01`);
  if (openText && openQuestion) openResponseId = (await db().surveyResponse.create({ data: { responseSessionId: session.id, itemKey: openQuestion.code, itemType: "TEXT", answerState: "VALUE", textCiphertext: encryptOpenText(openText), instrumentVersionId: instrument.id, questionVersionId: openQuestion.id } })).id;
  return { invitationId: invitation.id, sessionId: session.id, openResponseId };
}
