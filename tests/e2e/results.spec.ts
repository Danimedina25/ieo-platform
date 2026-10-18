import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { db } from "@/infrastructure/persistence/db";
import { decryptOpenText } from "@/infrastructure/participant/crypto";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
import { insertParticipant } from "../fixtures/participants";
import { parseCsv } from "../fixtures/csv";
import { zipTextEntries } from "@/infrastructure/catalog/office-sources";
import { readFileSync } from "node:fs";
// Uses consultant B (organization B): a separate login-limiter bucket from consultant A's specs.
const tag = `p6${Date.now().toString(36)}`;
let page: Page, context: BrowserContext, assessmentId = "", quoted = "";

test.describe.serial("Phase 6 results and triangulation", () => {
  test.beforeAll(async ({ browser }) => {
    const pkg = await db().methodologyPackage.findUniqueOrThrow({ where: { code_version: { code: "IEO", version: "1.0" } } });
    assessmentId = (await db().assessment.create({ data: { organizationId: demoIds.organizationB, name: `Resultados E2E ${tag}`, period: "2026", methodologyPackageId: pkg.id, status: "OPEN", openedAt: new Date() } })).id;
    await db().assessmentPerspective.createMany({ data: (["DIR", "ESP", "LID", "COL", "CLI"] as const).map(code => ({ assessmentId, perspectiveCode: code, applicability: code === "DIR" || code === "COL" ? "APPLICABLE" as const : "NOT_APPLICABLE" as const })) });
    const first = await insertParticipant(assessmentId, `col1-${tag}@example.test`, "COL", 4, "SUBMITTED", `Comentario ficticio con nombre propio ${tag}`);
    await insertParticipant(assessmentId, `col2-${tag}@example.test`, "COL", 2, "SUBMITTED", `<img src=x onerror="alert(1)"><script>alert(2)</script> ${tag}`);
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
    const item = page.getByRole("listitem").filter({ hasText: `Comentario ficticio con nombre propio ${tag}` });
    await item.getByLabel(/^Estado de la respuesta COL_E01_O01/).selectOption("REDACTED");
    await item.getByLabel(/^Texto redactado COL_E01_O01/).fill("Comentario ficticio con [nombre]");
    await item.getByRole("button", { name: "Guardar" }).click();
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

  test("E2E-P7-01 the consultant downloads EXP04 and the EXP03 report, with Dirección suppressed", async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator("input[name=disclosure-COL]").first().check();
    await page.getByLabel("Motivo Colaboradores", { exact: true }).fill("Sin riesgo en la prueba.");
    await page.getByRole("button", { name: "Guardar divulgación Colaboradores" }).click();
    await expect(page.getByText(/Colaboradores: Reportable/)).toBeVisible();
    await page.getByRole("link", { name: "Exportaciones" }).click();
    await expect(page.getByRole("heading", { name: "Exportaciones", exact: true })).toBeVisible();
    const metadata = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar EXP04" }).click();
    const metadataFile = zipTextEntries(readFileSync(await (await metadata).path()));
    expect(parseCsv(metadataFile.get("instrumentos.csv")!)).toHaveLength(329);
    const report = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar EXP03" }).first().click();
    const reportFile = zipTextEntries(readFileSync(await (await report).path()));
    const rows = parseCsv(reportFile.get("resultados.csv")!);
    expect(rows.find(row => row.result_type === "IEO_GLOBAL")?.status).toBe("SUPRIMIDO_POR_DIVULGACION");
    expect(rows.find(row => row.result_type === "RP" && row.perspective_code === "COL" && row.element_code === "E01")?.value_exact).toBe("50/1");
    await expect(page.getByText(/EXP03 REPORT · 62 filas/)).toBeVisible();
  });
  test("E2E-P7-02 raw data needs a grant that the custodian approves", async ({ browser }) => {
    await expect(page.getByRole("button", { name: "Descargar EXP01" })).toBeDisabled();
    await page.getByLabel("Alcance").selectOption("RAW_RESPONSES");
    await page.getByLabel("Propósito").fill("Auditoría de reprocesamiento en la prueba E2E.");
    await page.getByRole("button", { name: "Solicitar permiso" }).click();
    await expect(page.getByText(/Datos crudos \(EXP01\) · Pendiente/)).toBeVisible();
    const custodianContext = await browser.newContext();
    const custodian = await custodianContext.newPage();
    await custodian.goto("/login");
    await custodian.getByLabel("Correo", { exact: true }).fill("custodio@ieo.local");
    await custodian.getByLabel("Contraseña", { exact: true }).fill(seedEnvironment().SEED_USER_PASSWORD);
    await custodian.getByRole("button", { name: "Iniciar sesión" }).click();
    await custodian.getByRole("link", { name: "Custodia" }).click();
    const request = custodian.getByRole("article").filter({ hasText: "Auditoría de reprocesamiento en la prueba E2E." });
    await expect(request).toContainText("Pendiente");
    await request.getByRole("button", { name: "Aprobar" }).click();
    await expect(custodian.getByRole("status")).toHaveText("Permiso aprobado.");
    await custodianContext.close();
    await page.reload();
    await expect(page.getByText(/Datos crudos \(EXP01\) · Vigente/)).toBeVisible();
    const raw = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar EXP01" }).click();
    const rawRows = parseCsv(zipTextEntries(readFileSync(await (await raw).path())).get("respuestas_crudas.csv")!);
    expect(rawRows).toHaveLength(2 * 73 + 2 * 75);
    expect(new Set(rawRows.map(row => row.participant)).size).toBe(4);
  });

  test("E2E-P7-03 hostile open text is shown as text and never executed", async () => {
    let dialogs = 0;
    page.on("dialog", async dialog => { dialogs++; await dialog.dismiss(); });
    await page.getByRole("link", { name: "Resultados" }).click();
    await page.getByRole("button", { name: "Ver respuestas" }).click();
    await expect(page.getByText(`<img src=x onerror="alert(1)"><script>alert(2)</script> ${tag}`)).toBeVisible();
    await page.waitForTimeout(300);
    expect(dialogs).toBe(0);
  });
  test("E2E-P7-04 new mutations reject foreign origins and data responses are not cached", async () => {
    const foreign = { headers: { Origin: "https://evil.example", "Content-Type": "application/json" } };
    expect((await page.request.post(`/api/assessments/${assessmentId}/exports`, { ...foreign, data: { code: "EXP04", variant: "STANDARD" } })).status()).toBe(403);
    expect((await page.request.post(`/api/assessments/${assessmentId}/grants`, { ...foreign, data: { scope: "RAW_RESPONSES", purpose: "Intento desde otro origen", days: 1 } })).status()).toBe(403);
    expect((await page.request.post(`/api/assessments/${assessmentId}/results/disclosure`, { ...foreign, data: {} })).status()).toBe(403);
    const results = await page.request.get(`/api/assessments/${assessmentId}/results`);
    expect(results.headers()["cache-control"]).toContain("no-store");
    const page200 = await page.request.get(`/diagnosticos/${assessmentId}?tab=resultados`);
    expect(page200.headers()["content-security-policy"]).toContain("default-src 'self'");
  });
});
