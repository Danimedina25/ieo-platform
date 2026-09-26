import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "@/domain/auth";
import { participantConfig } from "./config";
export function randomBearer() { return randomBytes(32).toString("base64url"); }
export function isBearer(value: string): boolean { return /^[A-Za-z0-9_-]{43}$/.test(value); }
export function hashBearer(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function generateOtp() { return randomInt(0, 1_000_000).toString().padStart(6, "0"); }
export function emailLookupHmac(email: string) { return createHmac("sha256", participantConfig().lookupSecret).update(normalizeEmail(email)).digest("hex"); }
export function otpHmac(challengeId: string, invitationId: string, generation: number, otp: string) {
  return createHmac("sha256", participantConfig().otpSecret).update(`TECH-OTP-1:${challengeId}:${invitationId}:${generation}:${otp}`).digest("hex");
}
export function matchesOtp(expectedHex: string, challengeId: string, invitationId: string, generation: number, otp: string) {
  if (!/^\d{6}$/.test(otp) || !/^[a-f0-9]{64}$/.test(expectedHex)) return false;
  return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(otpHmac(challengeId, invitationId, generation, otp), "hex"));
}
function encrypt(value: string, purpose: "email" | "open") {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", participantConfig().encryptionKey, nonce);
  cipher.setAAD(Buffer.from(`ieo-${purpose}-v1`));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString("base64url")}`;
}
function decrypt(value: string, purpose: "email" | "open") {
  if (!value.startsWith("v1.")) throw new Error("Formato cifrado inválido.");
  const raw = Buffer.from(value.slice(3), "base64url");
  if (raw.length < 29) throw new Error("Cifrado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", participantConfig().encryptionKey, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(`ieo-${purpose}-v1`));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
export function encryptEmail(email: string) { return encrypt(normalizeEmail(email), "email"); }
export function decryptEmail(ciphertext: string) { return decrypt(ciphertext, "email"); }
export function encryptOpenText(text: string) { return encrypt(text, "open"); }
export function decryptOpenText(ciphertext: string) { return decrypt(ciphertext, "open"); }
