import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { randomBearer, hashBearer, isBearer, encryptEmail, decryptEmail, emailLookupHmac, generateOtp, otpHmac, matchesOtp, encryptOpenText, decryptOpenText } from "@/infrastructure/participant/crypto";
import { participantSessionExpiry, participantSessionUsable } from "@/domain/participant/session";
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
describe("survey patch shape", () => {
  it("rejects duplicate keys", () => { expect(patchSurveySchema.safeParse({ expectedRevision: 0, answers: [{ itemKey: "ESP_E01_R001", answerState: "VALUE", numericValue: 3 }, { itemKey: "ESP_E01_R001", answerState: "VALUE", numericValue: 4 }] }).success).toBe(false); });
});

describe("participant session bounds", () => {
  it("caps absolute expiry at invitation expiration", () => { const now = new Date("2026-09-25T12:00:00Z"); expect(participantSessionExpiry(new Date("2026-09-25T13:00:00Z"), now, 12).toISOString()).toBe("2026-09-25T13:00:00.000Z"); });
  it("rejects absolute, idle and revoked sessions", () => { const now = new Date("2026-09-25T12:00:00Z"); const valid = { expiresAt: new Date("2026-09-25T13:00:00Z"), lastSeenAt: new Date("2026-09-25T11:45:00Z"), revokedAt: null }; expect(participantSessionUsable(valid, now, 30)).toBe(true); expect(participantSessionUsable({ ...valid, lastSeenAt: new Date("2026-09-25T11:30:00Z") }, now, 30)).toBe(false); expect(participantSessionUsable({ ...valid, expiresAt: now }, now, 30)).toBe(false); expect(participantSessionUsable({ ...valid, revokedAt: now }, now, 30)).toBe(false); });
});
