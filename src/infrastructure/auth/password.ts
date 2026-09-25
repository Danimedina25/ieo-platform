import { randomBytes } from "node:crypto";
import argon2 from "argon2";

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) throw new Error("La contraseña debe tener entre 12 y 128 caracteres.");
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  if (!password || password.length > 128) return false;
  try { return await argon2.verify(hash, password); }
  catch { return false; }
}
let dummyHash: Promise<string> | undefined;
export function getDummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(32).toString("base64url"));
  return dummyHash;
}
