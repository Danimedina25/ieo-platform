import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)) };
export default defineConfig({ test: { projects: [
  { resolve: { alias }, test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] } },
  { resolve: { alias }, test: { name: "integration", environment: "node", include: ["tests/integration/**/*.test.ts"], setupFiles: ["tests/integration/setup.ts"], fileParallelism: false, testTimeout: 15000, hookTimeout: 30000 } },
] } });
