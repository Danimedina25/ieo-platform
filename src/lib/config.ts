import { z } from "zod";
const authEnvironment = z.object({
  AUTH_SECRET: z.string().min(32),
  APP_ORIGIN: z.url(),
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(8),
  ADMIN_SESSION_IDLE_MINUTES: z.coerce.number().int().positive().max(480).default(30),
});
export function authConfig() {
  const parsed = authEnvironment.safeParse(process.env);
  if (!parsed.success) throw new Error("Configuración de autenticación incompleta. Revise las variables requeridas.");
  const url = new URL(parsed.data.APP_ORIGIN);
  if (url.origin !== parsed.data.APP_ORIGIN || url.username || url.password ||
      !["http:", "https:"].includes(url.protocol) ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:" && url.hostname !== "localhost")) {
    throw new Error("APP_ORIGIN debe ser un origen válido; producción requiere HTTPS.");
  }
  return {
    secret: parsed.data.AUTH_SECRET,
    origin: parsed.data.APP_ORIGIN,
    ttlHours: parsed.data.ADMIN_SESSION_TTL_HOURS,
    idleMinutes: parsed.data.ADMIN_SESSION_IDLE_MINUTES,
  };
}
export function sessionCookie() {
  const production = process.env.NODE_ENV === "production";
  return {
    name: production ? "__Host-ieo-admin" : "ieo-admin",
    options: { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/" },
  };
}
