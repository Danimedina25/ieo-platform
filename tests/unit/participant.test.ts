import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { randomBearer, hashBearer, isBearer, encryptEmail, decryptEmail, emailLookupHmac, generateOtp, otpHmac, matchesOtp, encryptOpenText, decryptOpenText } from "@/infrastructure/participant/crypto";
import { participantSessionExpiry, participantSessionUsable } from "@/domain/participant/session";
import { technicalSurvey, technicalItems, validateTechnicalAnswer, missingRequiredKeys } from "@/domain/survey/fixtures/technical-survey-v1";
import { patchSurveySchema } from "@/domain/survey/schemas";
beforeSecrets();
function beforeSecrets() { for (const key of ["PARTICIPANT_ENCRYPTION_KEY", "PARTICIPANT_LOOKUP_SECRET", "OTP_HMAC_SECRET"]) process.env[key] ||= randomBytes(32).toString("base64url"); }
describe("Phase 3A crypto", () => {
  it("generates distinct 256-bit magic bearers", () => { const a = randomBearer(), b = randomBearer(); expect(a).not.toBe(b); expect(isBearer(a)).toBe(true); expect(a).toHaveLength(43); });
  it("stores only hash-shaped token verifiers", () => { const token = randomBearer(); expect(hashBearer(token)).toMatch(/^[a-f0-9]{64}$/); expect(hashBearer(token)).not.toBe(token); });
  it("encrypts and decrypts email without plaintext", () => { const raw = "Demo@Example.Test"; const cipher = encryptEmail(raw); expect(cipher).not.toContain(raw); expect(decryptEmail(cipher)).toBe("demo@example.test"); });
  it("uses stable normalized lookup HMAC", () => { expect(emailLookupHmac("Demo@Example.Test")).toBe(emailLookupHmac("demo@example.test")); expect(emailLookupHmac("other@example.test")).not.toBe(emailLookupHmac("demo@example.test")); });
  it("creates six-digit OTP and validates HMAC context", () => { const otp = generateOtp(); expect(otp).toMatch(/^\d{6}$/); const hmac = otpHmac("challenge", "invitation", 1, otp); expect(matchesOtp(hmac, "challenge", "invitation", 1, otp)).toBe(true); expect(matchesOtp(hmac, "challenge", "invitation", 2, otp)).toBe(false); });
  it("encrypts open answers using separate purpose", () => { const cipher = encryptOpenText("ficticio"); expect(cipher).not.toContain("ficticio"); expect(decryptOpenText(cipher)).toBe("ficticio"); expect(() => decryptEmail(cipher)).toThrow(); });
});
describe("Phase 3A synthetic survey", () => {
  it("has exactly two blocks and five synthetic items", () => { expect(technicalSurvey.code).toBe("TECH-SURVEY-01"); expect(technicalSurvey.sections).toHaveLength(2); expect(technicalItems).toHaveLength(5); });
  it("requires only Q1 and Q4", () => { expect(missingRequiredKeys([])).toEqual(["TECH_Q1", "TECH_Q4"]); expect(missingRequiredKeys([{ itemKey: "TECH_Q1", answerState: "VALUE" }, { itemKey: "TECH_Q4", answerState: "VALUE" }])).toEqual([]); });
  it("allows NA only where declared", () => { expect(validateTechnicalAnswer({ itemKey: "TECH_Q3", answerState: "NA" }).answerState).toBe("NA"); expect(() => validateTechnicalAnswer({ itemKey: "TECH_Q1", answerState: "NA" })).toThrow(); });
  it("rejects out-of-scale and unknown items", () => { expect(() => validateTechnicalAnswer({ itemKey: "TECH_Q1", answerState: "VALUE", numericValue: 6 })).toThrow(); expect(() => validateTechnicalAnswer({ itemKey: "COL_Q1", answerState: "VALUE", numericValue: 3 })).toThrow(); });
  it("rejects duplicate keys and invalid patch", () => { expect(patchSurveySchema.safeParse({ expectedRevision: 0, answers: [{ itemKey: "TECH_Q1", answerState: "VALUE", numericValue: 3 }, { itemKey: "TECH_Q1", answerState: "VALUE", numericValue: 4 }] }).success).toBe(false); });
});

describe("participant session bounds", () => {
  it("caps absolute expiry at invitation expiration", () => { const now = new Date("2026-09-25T12:00:00Z"); expect(participantSessionExpiry(new Date("2026-09-25T13:00:00Z"), now, 12).toISOString()).toBe("2026-09-25T13:00:00.000Z"); });
  it("rejects absolute, idle and revoked sessions", () => { const now = new Date("2026-09-25T12:00:00Z"); const valid = { expiresAt: new Date("2026-09-25T13:00:00Z"), lastSeenAt: new Date("2026-09-25T11:45:00Z"), revokedAt: null }; expect(participantSessionUsable(valid, now, 30)).toBe(true); expect(participantSessionUsable({ ...valid, lastSeenAt: new Date("2026-09-25T11:30:00Z") }, now, 30)).toBe(false); expect(participantSessionUsable({ ...valid, expiresAt: now }, now, 30)).toBe(false); expect(participantSessionUsable({ ...valid, revokedAt: now }, now, 30)).toBe(false); });
});
