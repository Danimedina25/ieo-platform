import { z } from "zod";
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/).transform(value => Buffer.from(value, "base64url")).refine(value => value.length === 32);
const schema = z.object({
  PARTICIPANT_ENCRYPTION_KEY: secret,
  PARTICIPANT_LOOKUP_SECRET: secret,
  OTP_HMAC_SECRET: secret,
  PARTICIPANT_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(48).default(12),
  PARTICIPANT_SESSION_IDLE_MINUTES: z.coerce.number().int().min(1).max(240).default(30),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(5),
  OTP_RESEND_SECONDS: z.coerce.number().int().min(30).max(300).default(60),
  OTP_MAX_SENDS_PER_15_MINUTES: z.coerce.number().int().min(1).max(5).default(3),
});
export function participantConfig() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) throw new Error("Configuración de participante incompleta. Configure claves independientes de 32 bytes.");
  return {
    encryptionKey: parsed.data.PARTICIPANT_ENCRYPTION_KEY,
    lookupSecret: parsed.data.PARTICIPANT_LOOKUP_SECRET,
    otpSecret: parsed.data.OTP_HMAC_SECRET,
    sessionHours: parsed.data.PARTICIPANT_SESSION_TTL_HOURS,
    idleMinutes: parsed.data.PARTICIPANT_SESSION_IDLE_MINUTES,
    otpMinutes: parsed.data.OTP_TTL_MINUTES,
    maxAttempts: parsed.data.OTP_MAX_ATTEMPTS,
    resendSeconds: parsed.data.OTP_RESEND_SECONDS,
    maxSends: parsed.data.OTP_MAX_SENDS_PER_15_MINUTES,
  };
}
export function participantCookie(kind: "preauth" | "auth") {
  const production = process.env.NODE_ENV === "production";
  return { name: `${production ? "__Host-" : ""}ieo-participant${kind === "preauth" ? "-preauth" : ""}`,
    options: { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/" } };
}
