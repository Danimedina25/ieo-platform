import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { db } from "@/infrastructure/persistence/db";
import type { VersionedCatalog } from "@/infrastructure/catalog/load";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
const colCatalog = JSON.parse(readFileSync("src/domain/survey/catalogs/ieo-col-01-v1.0.json", "utf8")) as VersionedCatalog;
const tag = `col${Date.now().toString(36)}`;
let page: Page, context: BrowserContext, link = "", invitationId = "";
function lastMail(kind: "link" | "otp") { const rows = readFileSync(process.env.E2E_MAILBOX_PATH!, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as { kind: string; value: string; to: string }); return rows.filter(row => row.kind === kind && row.to.includes(tag)).at(-1)!.value; }
const questions = () => page.locator("fieldset").filter({ has: page.locator("input[type=radio]") });
async function answer(count: number, option: string, from = 0) { for (let index = from; index < from + count; index++) await questions().nth(index).getByLabel(option, { exact: true }).check(); }
async function enterWithOtp() {
  await page.goto(link);
  await page.getByRole("button", { name: "Continuar y recibir código" }).click();
  await expect(page).toHaveURL(/\/r\/acceso$/);
  await page.getByLabel("Código de 6 dígitos").fill(lastMail("otp"));
  await page.getByRole("button", { name: "Verificar" }).click();
}
async function openElement(roman: string) {
  await page.getByRole("button", { name: new RegExp(`^Elemento ${roman}:`) }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`^Elemento ${roman} · `) })).toBeVisible();
}
const noHorizontalScroll = async (width: number) => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

test.describe.serial("Phase 3B COL questionnaire", () => {
  test.beforeAll(async ({ browser }) => { context = await browser.newContext({ viewport: { width: 390, height: 844 } }); page = await context.newPage(); });
  test.afterAll(async () => { await context?.close(); await db().$disconnect(); });

  test("E2E-P3B-01 consultant creates a COL test invitation", async () => {
    await page.goto("/login");
    await page.getByLabel("Correo", { exact: true }).fill("consultor@ieo.local");
    await page.getByLabel("Contraseña", { exact: true }).fill(seedEnvironment().SEED_USER_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/diagnosticos$/);
    await page.goto(`/diagnosticos/${demoIds.assessmentOpenA}?tab=participantes`);
    await page.getByLabel("Correo de prueba").fill(`participant-${tag}@example.test`);
    await page.getByLabel("Perspectiva").selectOption("COL");
    await page.getByRole("button", { name: "Crear invitación" }).click();
    await expect(page.getByRole("row").filter({ hasText: tag })).toContainText("SENT");
    invitationId = (await db().invitation.findFirstOrThrow({ where: { assessmentId: demoIds.assessmentOpenA }, orderBy: { createdAt: "desc" } })).id;
    link = lastMail("link");
    await context.clearCookies();
  });
  test("E2E-P3B-02 official COL introduction with test notice", async () => {
    await enterWithOtp();
    await expect(page).toHaveURL(/\/r\/introduccion$/);
    await expect(page.getByRole("heading", { name: "IEO Colaboradores" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("USE ÚNICAMENTE DATOS FICTICIOS");
    await expect(page.getByText(colCatalog.intro.objective)).toBeVisible();
    await expect(page.getByText("No aplica / No cuento con información suficiente")).toBeVisible();
    await page.getByRole("button", { name: "Comenzar cuestionario" }).click();
    await expect(page).toHaveURL(/\/r\/cuestionario$/);
  });
  test("E2E-P3B-03 one Element per page with progress for the eight Elements", async () => {
    await expect(page.getByRole("heading", { name: "Elemento I · Valor Diferenciador" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Avance por Elemento" }).getByRole("button", { name: /^Elemento [IVX]+:/ })).toHaveCount(8);
    await expect(questions()).toHaveCount(9);
    await expect(page.getByLabel(colCatalog.questions.find(question => question.code === "COL_E01_O01")!.text)).toBeVisible();
    await noHorizontalScroll(390);
  });
  test("E2E-P3B-04 five of nine answers shows the Element below the minimum", async () => {
    await answer(5, "4 — De acuerdo");
    await expect(page.getByText(/5 de 9 respondidas · 0 N\/A · necesitas al menos 6/)).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByRole("heading", { name: "Elemento II · Ejecución y Resultados" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Elemento I: Falta" })).toBeVisible();
  });
  test("E2E-P3B-05 review blocks submission and names the Elements below 60 %", async () => {
    await page.getByRole("button", { name: "Revisión y envío" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Para enviar" })).toContainText("Revisa: Elemento I, Elemento II");
    await expect(page.getByRole("button", { name: "Enviar definitivamente" })).toBeDisabled();
    await page.getByRole("button", { name: "Ir a Elemento I", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Elemento I · Valor Diferenciador" })).toBeVisible();
  });
  test("E2E-P3B-06 Element IV shows «líder inmediato» (GAP-003)", async () => {
    await openElement("IV");
    await expect(page.getByText("Durante los últimos seis meses, mi líder inmediato ha comunicado con claridad")).toBeVisible();
    await expect(page.getByText("mi jefe inmediato")).toHaveCount(0);
  });
  test("E2E-P3B-07 answers persist after reload and after resuming with a new OTP", async () => {
    await openElement("I");
    await answer(1, "4 — De acuerdo", 5);
    await expect(page.getByRole("status")).toHaveText("Guardado");
    await page.reload();
    await expect(questions().nth(5).getByLabel("4 — De acuerdo", { exact: true })).toBeChecked();
    await context.clearCookies();
    await db().accessChallenge.updateMany({ where: { invitationId }, data: { createdAt: new Date(Date.now() - 61_000) } });
    await enterWithOtp();
    await expect(page).toHaveURL(/\/r\/cuestionario$/);
    await expect(page.getByRole("button", { name: "Elemento I: Cumple" })).toBeVisible();
  });
  test("E2E-P3B-08 all-N/A Element and empty open questions still allow submission", async () => {
    for (const [index, roman] of ["II", "III", "IV", "V", "VI", "VII"].entries()) {
      await openElement(roman);
      await answer(6, index % 2 ? "2 — En desacuerdo" : "5 — Totalmente de acuerdo");
    }
    await openElement("VIII");
    await answer(9, "N/A — No aplica / No cuento con información suficiente");
    await expect(page.getByText(/Todas las afirmaciones marcadas N\/A/)).toBeVisible();
    await page.getByRole("button", { name: "Ir a revisión" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Para enviar" })).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await noHorizontalScroll(1280);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Enviar definitivamente" }).click();
    await expect(page).toHaveURL(/\/r\/gracias$/);
    await expect(page.getByRole("heading", { name: "Gracias por tu participación" })).toBeVisible();
    await expect(page.getByText(colCatalog.thanks)).toBeVisible();
  });
  test("E2E-P3B-09 the submission is stored raw and cannot be edited", async () => {
    const binding = await db().participantAccessBinding.findUniqueOrThrow({ where: { invitationId }, include: { responseSession: true } });
    expect(binding.responseSession.status).toBe("SUBMITTED");
    const rows = await db().surveyResponse.findMany({ where: { responseSessionId: binding.responseSessionId } });
    expect(rows.filter(row => row.answerState === "NA")).toHaveLength(9);
    expect(rows.filter(row => row.answerState === "VALUE").map(row => row.numericValue).every(value => value !== null && value >= 1 && value <= 5)).toBe(true);
    await page.goto("/r/cuestionario");
    await expect(page).toHaveURL(/\/r\/gracias$/);
  });
});
