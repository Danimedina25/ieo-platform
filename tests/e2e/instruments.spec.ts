import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { db } from "@/infrastructure/persistence/db";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
import { answerMinimum, catalogFor, likertQuestions, openSection } from "./survey-helpers";
const tag = `p4${Date.now().toString(36)}`;
let page: Page, context: BrowserContext;
function lastMail(kind: "link" | "otp", recipient: string) { const rows = readFileSync(process.env.E2E_MAILBOX_PATH!, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as { kind: string; value: string; to: string }); return rows.filter(row => row.kind === kind && row.to.includes(recipient)).at(-1)!.value; }
async function invite(perspectiveCode: string) {
  const email = `${perspectiveCode.toLowerCase()}-${tag}@example.test`;
  await context.clearCookies();
  await page.goto("/login");
  await page.getByLabel("Correo", { exact: true }).fill("consultor@ieo.local");
  await page.getByLabel("Contraseña", { exact: true }).fill(seedEnvironment().SEED_USER_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/diagnosticos$/);
  await page.goto(`/diagnosticos/${demoIds.assessmentA}?tab=participantes`);
  await page.getByLabel("Correo de prueba").fill(email);
  await page.getByLabel("Perspectiva").selectOption(perspectiveCode);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  await expect(page.getByRole("row").filter({ hasText: email })).toContainText("SENT");
  await context.clearCookies();
  await page.goto(lastMail("link", email));
  await page.getByRole("button", { name: "Continuar y recibir código" }).click();
  await expect(page).toHaveURL(/\/r\/acceso$/);
  await page.getByLabel("Código de 6 dígitos").fill(lastMail("otp", email));
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page).toHaveURL(/\/r\/introduccion$/);
}
async function submitAndThank(perspectiveCode: string) {
  await page.getByRole("navigation", { name: "Avance por Elemento" }).getByRole("button", { name: "Revisión y envío" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Para enviar" })).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar definitivamente" }).click();
  await expect(page).toHaveURL(/\/r\/gracias$/);
  await expect(page.getByText(catalogFor(perspectiveCode).thanks)).toBeVisible();
}

test.describe.serial("Phase 4 five instruments", () => {
  test.beforeAll(async ({ browser }) => { context = await browser.newContext({ viewport: { width: 390, height: 844 } }); page = await context.newPage(); });
  test.afterAll(async () => { await context?.close(); await db().$disconnect(); });

  test("E2E-P4-01 DIR: own introduction, no N/A option, submit with the minimum", async () => {
    await invite("DIR");
    await expect(page.getByRole("heading", { name: "IEO Dirección" })).toBeVisible();
    await expect(page.getByText(catalogFor("DIR").intro.instructions)).toBeVisible();
    await expect(page.getByText("N/A", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Comenzar cuestionario" }).click();
    await expect(page.getByRole("heading", { name: "Elemento I · Valor Diferenciador" })).toBeVisible();
    await expect(likertQuestions(page)).toHaveCount(9);
    await expect(page.locator("input[type=radio][aria-label^='N/A']")).toHaveCount(0);
    await expect(page.locator("textarea")).toHaveCount(0);
    await answerMinimum(page, "DIR");
    await expect(page.getByText(/· 0 N\/A ·/)).toHaveCount(0);
    await submitAndThank("DIR");
  });
  test("E2E-P4-02 LID: submit with the minimum; open questions left empty", async () => {
    await invite("LID");
    await expect(page.getByRole("heading", { name: "IEO Liderazgo" })).toBeVisible();
    await page.getByRole("button", { name: "Comenzar cuestionario" }).click();
    await expect(page.locator("textarea")).toHaveCount(1);
    await answerMinimum(page, "LID", "5 — Totalmente de acuerdo");
    await submitAndThank("LID");
  });
  test("E2E-P4-03 CLI: Element III needs 3 of 4; general open questions appear on their own screen", async () => {
    await invite("CLI");
    await expect(page.getByRole("heading", { name: "IEO Voz del Cliente" })).toBeVisible();
    await page.getByRole("button", { name: "Comenzar cuestionario" }).click();
    await expect(page.locator("textarea")).toHaveCount(0);
    await answerMinimum(page, "CLI");
    await openSection(page, /^Elemento III:/, /^Elemento III · /);
    await likertQuestions(page).nth(2).getByRole("button", { name: "Borrar" }).click();
    await expect(page.getByText(/2 de 4 respondidas · 0 N\/A · necesitas al menos 3/)).toBeVisible();
    await openSection(page, "Preguntas abiertas", "Preguntas abiertas");
    await expect(page.locator("textarea")).toHaveCount(4);
    await page.locator("textarea").first().fill("Comentario ficticio de cliente.");
    await page.getByRole("navigation", { name: "Avance por Elemento" }).getByRole("button", { name: "Revisión y envío" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Para enviar" })).toContainText("Revisa: Elemento III.");
    await openSection(page, /^Elemento III:/, /^Elemento III · /);
    await likertQuestions(page).nth(2).getByLabel("4 — De acuerdo", { exact: true }).check();
    await submitAndThank("CLI");
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});
