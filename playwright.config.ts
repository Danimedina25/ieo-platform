import "dotenv/config";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { selectTestDatabase } from "./tests/test-environment";
import { seedEnvironment } from "./prisma/seed-data";
selectTestDatabase();
seedEnvironment();
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${port}`;
const mailbox = process.env.E2E_MAILBOX_PATH ?? join(tmpdir(), `ieo-phase3a-mailbox-${process.pid}.jsonl`);
if (!process.env.E2E_MAILBOX_PATH) writeFileSync(mailbox, "", { mode: 0o600 });
process.env.E2E_MAILBOX_PATH = mailbox;
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1, retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "off", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `npm run start -- --hostname localhost --port ${port}`, url: `${baseURL}/login`, reuseExistingServer: false, timeout: 60000,
    env: { DATABASE_URL: process.env.DATABASE_URL!, AUTH_SECRET: process.env.AUTH_SECRET!, APP_ORIGIN: baseURL, NODE_ENV: "production", EMAIL_PROVIDER: "file", E2E_MODE: "true", E2E_MAILBOX_PATH: mailbox, PARTICIPANT_ENCRYPTION_KEY: process.env.PARTICIPANT_ENCRYPTION_KEY!, PARTICIPANT_LOOKUP_SECRET: process.env.PARTICIPANT_LOOKUP_SECRET!, OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET! } },
});
