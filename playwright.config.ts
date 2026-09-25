import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { selectTestDatabase } from "./tests/test-environment";
import { seedEnvironment } from "./prisma/seed-data";
selectTestDatabase();
seedEnvironment();
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "off", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `npm run start -- --hostname localhost --port ${port}`, url: `${baseURL}/login`, reuseExistingServer: false, timeout: 60000,
    env: { DATABASE_URL: process.env.DATABASE_URL!, AUTH_SECRET: process.env.AUTH_SECRET!, APP_ORIGIN: baseURL, NODE_ENV: "production" } },
});
