import { createHash } from "node:crypto";

/** Stable JSON: object keys sorted, toJSON honored. Used for content and output hashes. */
export function canonicalJson(value: unknown): string {
  if (value !== null && typeof value === "object" && typeof (value as { toJSON?: unknown }).toJSON === "function") return canonicalJson((value as { toJSON: () => unknown }).toJSON());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().filter(key => (value as Record<string, unknown>)[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function sha256Canonical(value: unknown) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }
