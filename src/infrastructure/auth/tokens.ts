import { createHash, randomBytes } from "node:crypto";
export function generateSessionToken(): string { return randomBytes(32).toString("base64url"); }
export function isSessionToken(token: string): boolean { return /^[A-Za-z0-9_-]{43}$/.test(token); }
export function digestSessionToken(token: string): string { return createHash("sha256").update(token).digest("hex"); }
