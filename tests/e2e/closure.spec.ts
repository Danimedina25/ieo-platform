import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { db } from "@/infrastructure/persistence/db";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
import { answerMinimum } from "./survey-helpers";
const tag = `p5b${Date.now().toString(36)}`;
let page: Page, context: BrowserContext, assessmentId = "", adminCookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
function lastMail(kind: "link" | "otp", recipient: string) { const rows = readFileSync(process.env.E2E_MAILBOX_PATH!, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line) as { kind: string; value: string; to: string }); return rows.filter(row => row.kind === kind && row.to.includes(recipient)).at(-1)?.value; }
const closureTab = () => page.goto(`/diagnosticos/${assessmentId}?tab=cierre`);

test.describe.serial("Phase 5B closure and processing", () => {
  test.beforeAll(async ({ browser }) => {
    const pkg = await db().methodologyPackage.findUniqueOrThrow({ where: { code_version: { code: "IEO", version: "1.0" } } });
    const created = await db().assessment.create({ data: { organizationId: demoIds.organizationA, name: `Cierre E2E ${tag}`, period: "2026", methodologyPackageId: pkg.id } });
    assessmentId = created.id;
    await db().assessmentPerspective.createMany({ data: (["DIR", "ESP", "LID", "COL", "CLI"] as const).map(code => ({ assessmentId, perspectiveCode: code, applicability: code === "COL" ? "APPLICABLE" as const : "NOT_APPLICABLE" as const })) });
    context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
  });
  test.afterAll(async () => { await context?.close(); await db().$disconnect(); });

  test("E2E-P5B-01 the consultant opens the application from the Cierre tab", async () => {
    await page.goto("/login");
    await page.getByLabel("Correo", { exact: true }).fill("consultor@ieo.local");
    await page.getByLabel("Contraseña", { exact: true }).fill(seedEnvironment().SEED_USER_PASSWORD);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/diagnosticos$/);
    adminCookies = await context.cookies();
    await closureTab();
    await expect(page.getByRole("heading", { name: "Estado: Borrador · Revisión 1" })).toBeVisible();
    await page.getByRole("button", { name: "Abrir aplicación" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Abierto · Revisión 1" })).toBeVisible();
  });
  test("E2E-P5B-02 a participant answers the COL questionnaire while it is open", async () => {
    const email = `col-${tag}@example.test`;
    await page.goto(`/diagnosticos/${assessmentId}?tab=participantes`);
    await page.getByLabel("Correo de prueba").fill(email);
    await page.getByLabel("Perspectiva").selectOption("COL");
    await page.getByRole("button", { name: "Crear invitación" }).click();
    await expect(page.getByRole("row").filter({ hasText: email })).toContainText("SENT");
    await context.clearCookies();
    await page.goto(lastMail("link", email)!);
    await page.getByRole("button", { name: "Continuar y recibir código" }).click();
    await expect(page).toHaveURL(/\/r\/acceso$/);
    await page.getByLabel("Código de 6 dígitos").fill(lastMail("otp", email)!);
    await page.getByRole("button", { name: "Verificar" }).click();
    await page.getByRole("button", { name: "Comenzar cuestionario" }).click();
    await answerMinimum(page, "COL");
    await page.getByRole("navigation", { name: "Avance por Elemento" }).getByRole("button", { name: "Revisión y envío" }).click();
    await page.getByRole("button", { name: "Enviar definitivamente" }).click();
    await expect(page).toHaveURL(/\/r\/gracias$/);
  });
  test("E2E-P5B-03 closing, verdicts and checklist", async () => {
    await context.clearCookies();
    await context.addCookies(adminCookies);
    await closureTab();
    await page.getByRole("button", { name: "Cerrar aplicación" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Cerrado · Revisión 1" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Colaboradores" })).toContainText("1");
    await page.getByRole("button", { name: "Guardar dictamen Global" }).click();
    await expect(page.getByRole("status")).toHaveText("Dictamen global guardado.");
    await page.getByLabel("Dictamen Colaboradores", { exact: true }).selectOption("B");
    await page.getByLabel("Reservas Colaboradores", { exact: true }).fill("Participación reducida en la prueba.");
    await page.getByRole("button", { name: "Guardar dictamen Colaboradores" }).click();
    await expect(page.getByRole("status")).toHaveText("Dictamen de Colaboradores guardado.");
    for (let index = 0; index < 16; index++) await page.locator(`input[name=check-${index}]`).first().check();
    await page.getByRole("button", { name: "Guardar checklist" }).click();
    await expect(page.getByRole("status")).toHaveText("Checklist guardado.");
  });
  test("E2E-P5B-04 freezing shows the acta; processing records a publishable run", async () => {
    await page.getByRole("button", { name: "Congelar y autorizar procesamiento" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Congelado · Revisión 1" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Acta Oficial de Cierre" })).toBeVisible();
    await expect(page.getByText(/Hash del acta: [a-f0-9]{64}/)).toBeVisible();
    await page.getByRole("button", { name: "Procesar" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Procesado · Revisión 1" })).toBeVisible();
    await expect(page.getByText(/Exitoso · vigente · publicable/)).toBeVisible();
    const run = await db().processingRun.findFirstOrThrow({ where: { assessmentId }, include: { global: true } });
    expect(run).toMatchObject({ status: "SUCCEEDED", publishable: true });
    expect(run.global?.status).toBe("ND"); // a single applicable perspective has no Global
  });
  test("E2E-P5B-05 reopening with a reason starts revision 2", async () => {
    await page.getByLabel("Motivo de reapertura").fill("Se detectó una incidencia de prueba.");
    await page.getByRole("button", { name: "Reabrir" }).click();
    await expect(page.getByRole("heading", { name: "Estado: Abierto · Revisión 2" })).toBeVisible();
    await expect(page.getByText(/Revisión 1 · Exitoso/)).toBeVisible();
  });
});
