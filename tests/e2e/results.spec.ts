import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db } from "@/infrastructure/persistence/db";
import { decryptOpenText } from "@/infrastructure/participant/crypto";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
import { insertParticipant } from "../fixtures/participants";
// Uses consultant B (organization B): a separate login-limiter bucket from consultant A's specs.
const tag = `p6${Date.now().toString(36)}`;
let page: Page, context: BrowserContext, assessmentId = "", quoted = "";

test.describe.serial("Phase 6 results and triangulation", () => {
  test.beforeAll(async ({ browser }) => {
    const pkg = await db().methodologyPackage.findUniqueOrThrow({ where: { code_version: { code: "IEO", version: "1.0" } } });
    assessmentId = (await db().assessment.create({ data: { organizationId: demoIds.organizationB, name: `Resultados E2E ${tag}`, period: "2026", methodologyPackageId: pkg.id, status: "OPEN", openedAt: new Date() } })).id;
    await db().assessmentPerspective.createMany({ data: (["DIR", "ESP", "LID", "COL", "CLI"] as const).map(code => ({ assessmentId, perspectiveCode: code, applicability: code === "DIR" || code === "COL" ? "APPLICABLE" as const : "NOT_APPLICABLE" as const })) });
    const first = await insertParticipant(assessmentId, `col1-${tag}@example.test`, "COL", 4, "SUBMITTED", `Comentario ficticio con nombre propio ${tag}`);
    await insertParticipant(assessmentId, `col2-${tag}@example.test`, "COL", 2, "SUBMITTED", null);
    await insertParticipant(assessmentId, `dir1-${tag}@example.test`, "DIR", 5, "SUBMITTED", null);
    await insertParticipant(assessmentId, `dir2-${tag}@example.test`, "DIR", 3, "SUBMITTED", null);
    quoted = first.openResponseId!;
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
  });
  test.afterAll(async () => { await context?.close(); await db().$disconnect(); });

  test("E2E-P6-01 the consultant closes, documents, freezes and processes", async () => {
    await page.goto("/login");
    await page.getByLabel("Correo", { exact: true }).fill("consultor2@ieo.local");
    await page.getByLabel("Contraseña", { exact: true }).fill(seedEnvironment().SEED_USER_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/diagnosticos$/);
    await page.goto(`/diagnosticos/${assessmentId}?tab=resultados`);
    await expect(page.getByText("Todavía no hay un procesamiento exitoso.")).toBeVisible();
    await page.goto(`/diagnosticos/${assessmentId}?tab=cierre`);
    await page.getByRole("button", { name: "Cerrar aplicación" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Cerrado · Revisión 1" })).toBeVisible();
    for (const [label, done] of [["Global", "Dictamen global guardado."], ["Dirección", "Dictamen de Dirección guardado."], ["Colaboradores", "Dictamen de Colaboradores guardado."]]) {
      await page.getByRole("button", { name: `Guardar dictamen ${label}` }).click();
      await expect(page.getByRole("status")).toHaveText(done);
    }
    for (let index = 0; index < 16; index++) await page.locator(`input[name=check-${index}]`).first().check();
    await page.getByRole("button", { name: "Guardar checklist" }).click();
    await expect(page.getByRole("status")).toHaveText("Checklist guardado.");
    await page.getByRole("button", { name: "Congelar y autorizar procesamiento" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Congelado · Revisión 1" })).toBeVisible();
    await page.getByRole("button", { name: "Procesar" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Procesado · Revisión 1" })).toBeVisible();
  });
  test("E2E-P6-02 the Global appears together with the matrix and perspective indexes", async () => {
    await page.getByRole("link", { name: "Resultados" }).click();
    await expect(page.getByRole("heading", { name: "Índice Global IEO" })).toBeVisible();
    await expect(page.getByLabel("Índice Global 62")).toBeVisible();
    await expect(page.getByText("En erosión · Nivel 3")).toBeVisible();
    await expect(page.getByText("Semáforo: Naranja")).toBeVisible();
    const matrix = page.getByRole("table", { name: "Matriz de triangulación" });
    await expect(matrix).toBeVisible();
    const first = matrix.getByRole("row", { name: /Valor Diferenciador/ });
    await expect(first).toContainText("75.0");
    await expect(first).toContainText("50.0");
    await expect(first).toContainText("62.5");
    await expect(first).toContainText("Brecha relevante · parcial");
    await expect(first).toContainText("NP — perspectiva no aplicada");
    await expect(matrix.getByRole("row", { name: /Índice por perspectiva/ })).toContainText("75");
    await expect(page.getByText("PRUEBA — datos ficticios. No constituye un diagnóstico IEO® oficial.")).toBeVisible();
  });
  test("E2E-P6-03 the consultant registers a triangulation pattern", async () => {
    await page.getByLabel("Patrón Valor Diferenciador", { exact: true }).selectOption("PERCEPTION_GAP");
    await page.getByLabel("Justificación Valor Diferenciador", { exact: true }).fill("Dirección 75 frente a Colaboradores 50.");
    await page.getByRole("button", { name: "Registrar patrón Valor Diferenciador" }).click();
    await expect(page.getByText("Brecha de percepción — Dirección 75 frente a Colaboradores 50.")).toBeVisible();
  });
  test("E2E-P6-04 marking Dirección not reportable shows the warnings and keeps the Global", async () => {
    await expect(page.getByText(/Menos de 3 personas válidas/).first()).toBeVisible();
    await page.locator("input[name=disclosure-DIR]").nth(1).check();
    await page.getByLabel("Motivo Dirección", { exact: true }).fill("Dos directivos: riesgo de identificación.");
    await page.getByRole("button", { name: "Guardar divulgación Dirección" }).click();
    await expect(page.getByText(/Dirección: No reportable — Dos directivos/)).toBeVisible();
    await expect(page.getByText(/Oculta, pero deducible a partir del RI o la BT/)).toBeVisible();
    await expect(page.getByLabel("Índice Global 62")).toBeVisible();
  });
  test("E2E-P6-05 an open answer is redacted without touching the original", async () => {
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await expect(page.getByText(`Comentario ficticio con nombre propio ${tag}`)).toBeVisible();
    await page.getByLabel(/^Estado de la respuesta COL_E01_O01/).selectOption("REDACTED");
    await page.getByLabel(/^Texto redactado COL_E01_O01/).fill("Comentario ficticio con [nombre]");
    await page.getByRole("button", { name: "Guardar" }).last().click();
    await expect(page.getByText("Versión redactada: Comentario ficticio con [nombre]")).toBeVisible();
    const original = await db().surveyResponse.findUniqueOrThrow({ where: { id: quoted } });
    expect(decryptOpenText(original.textCiphertext!)).toBe(`Comentario ficticio con nombre propio ${tag}`);
  });
  test("E2E-P6-06 on a phone the page does not scroll sideways; the matrix scrolls inside its card", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("table", { name: "Matriz de triangulación" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
