import "server-only";
import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import nodemailer from "nodemailer";
import { z } from "zod";
import { authConfig } from "@/lib/config";
export interface EmailProvider {
  sendMagicLink(email: string, link: string): Promise<void>;
  sendOtp(email: string, otp: string): Promise<void>;
}
export function emailProvider(): EmailProvider {
  const kind = process.env.EMAIL_PROVIDER;
  if (kind === "console") {
    if (process.env.NODE_ENV === "production") throw new Error("EMAIL_PROVIDER=console prohibido en producción.");
    return { sendMagicLink: async (_email, link) => { console.info("TECH_MAIL_LINK", link); }, sendOtp: async (_email, otp) => { console.info("TECH_MAIL_OTP", otp); } };
  }
  if (kind === "file") {
    const path = process.env.E2E_MAILBOX_PATH;
    const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
    const origin = authConfig().origin;
    if (process.env.E2E_MODE !== "true" || !path || !isAbsolute(path) || !path.startsWith(`${tmpdir()}/`) || !url?.pathname.endsWith("_test") || new URL(origin).hostname !== "localhost") throw new Error("Provider file sólo permitido en E2E local con base _test.");
    const write = async (payload: { kind: "link" | "otp"; to: string; value: string }) => {
      const file = await open(path, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(`${JSON.stringify({ ...payload, at: Date.now() })}\n`); }
      finally { await file.close(); }
    };
    return { sendMagicLink: (to, value) => write({ kind: "link", to, value }), sendOtp: (to, value) => write({ kind: "otp", to, value }) };
  }
  if (kind === "smtp") {
    const parsed = z.object({ SMTP_HOST: z.string().min(1), SMTP_PORT: z.coerce.number().int().min(1).max(65535), SMTP_SECURE: z.enum(["true", "false"]), SMTP_USER: z.string().min(1), SMTP_PASSWORD: z.string().min(1), SMTP_FROM: z.email() }).safeParse(process.env);
    if (!parsed.success) throw new Error("SMTP incompleto.");
    const options = parsed.data;
    const transport = nodemailer.createTransport({ host: options.SMTP_HOST, port: options.SMTP_PORT, secure: options.SMTP_SECURE === "true", auth: { user: options.SMTP_USER, pass: options.SMTP_PASSWORD } });
    const send = async (to: string, subject: string, text: string) => { await transport.sendMail({ from: options.SMTP_FROM, to, subject, text }); };
    return {
      sendMagicLink: (to, link) => send(to, "Acceso a prueba técnica IEO", `Este enlace es para una prueba técnica, no para un instrumento oficial IEO®.\n\n${link}\n`),
      sendOtp: (to, otp) => send(to, "Código de acceso a prueba técnica IEO", `Código de verificación para la prueba técnica: ${otp}\nSi no lo solicitaste, ignora este mensaje.`),
    };
  }
  throw new Error("EMAIL_PROVIDER debe ser smtp, console (desarrollo) o file (E2E local).");
}
