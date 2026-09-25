import { afterEach, expect, it, vi } from "vitest";
import { boundedJson, validMutationOrigin } from "@/lib/http-security";
import { sessionCookie } from "@/lib/config";
afterEach(() => vi.unstubAllEnvs());
it("POST exige Origin exacto, no acepta origen ausente ni parecido", () => {
  vi.stubEnv("AUTH_SECRET", "unit-test-configuration-secret-32-chars"); vi.stubEnv("APP_ORIGIN", "https://ieo.example");
  expect(validMutationOrigin(new Request("https://ieo.example/api", { headers: { origin: "https://ieo.example" } }))).toBe(true);
  expect(validMutationOrigin(new Request("https://ieo.example/api"))).toBe(false);
  expect(validMutationOrigin(new Request("https://ieo.example/api", { headers: { origin: "https://ieo.example.attacker.test" } }))).toBe(false);
});
it("limita cuerpo JSON incluso sin content-length", async () => {
  await expect(boundedJson(new Request("https://ieo.example", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field: "x".repeat(5000) }) }))).rejects.toThrow();
  await expect(boundedJson(new Request("https://ieo.example", { method: "POST", body: "bad" }))).rejects.toThrow();
});
it("cookie producción es host-only y segura; desarrollo HTTP explícito", () => {
  vi.stubEnv("NODE_ENV", "production");
  expect(sessionCookie()).toEqual({ name: "__Host-ieo-admin", options: { httpOnly: true, secure: true, sameSite: "lax", path: "/" } });
  vi.stubEnv("NODE_ENV", "development"); expect(sessionCookie().options.secure).toBe(false);
});
