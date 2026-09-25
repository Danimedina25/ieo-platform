import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
const env = seedEnvironment();
const tag = Date.now().toString(36);
let assessmentUrl = "";
let consultantCookies: Awaited<ReturnType<BrowserContext["cookies"]>> | null = null;
async function signIn(page: Page, email = "consultor@ieo.local") {
  if (email === "consultor@ieo.local" && consultantCookies) {
    await page.context().addCookies(consultantCookies); await page.goto("/diagnosticos");
    await expect(page).toHaveURL(/\/diagnosticos$/); return;
  }
  await page.goto("/login");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(env.SEED_USER_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/diagnosticos$/);
  if (email === "consultor@ieo.local") consultantCookies = await page.context().cookies();
}
async function createFromDialog(page: Page, name: string, newOrganization?: string) {
  await page.getByRole("button", { name: "Nuevo diagnóstico" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo diagnóstico" })).toBeVisible();
  if (newOrganization) {
    await page.getByLabel("Organización", { exact: true }).selectOption("new");
    await page.getByLabel("Nombre de organización").fill(newOrganization);
  } else await page.getByLabel("Organización", { exact: true }).selectOption(demoIds.organizationA);
  await page.getByLabel("Nombre del diagnóstico", { exact: true }).fill(name);
  await page.getByLabel("Periodo", { exact: true }).fill("2026");
  await page.getByRole("button", { name: "Crear diagnóstico" }).click();
  await expect(page).toHaveURL(/\/diagnosticos\/[0-9a-f-]+\?tab=general$/);
}
test.describe.serial("Phase 2 workspace", () => {
  test("E2E-P2-01 consultor crea en organización existente", async ({ page }) => {
    await signIn(page);
    await createFromDialog(page, `E2E existente ${tag}`);
    assessmentUrl = page.url();
    await expect(page.getByRole("heading", { name: `E2E existente ${tag}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Perspectivas" })).toBeVisible();
  });
  test("E2E-P2-02 crea nueva organización y diagnóstico", async ({ page }) => {
    await signIn(page);
    await createFromDialog(page, `E2E nueva ${tag}`, `Organización E2E ${tag}`);
    await expect(page.getByText(`Organización E2E ${tag}`)).toBeVisible();
  });
  test("E2E-P2-03 General persiste tras recarga", async ({ page }) => {
    await signIn(page); await page.goto(assessmentUrl);
    await page.getByLabel("Objetivo", { exact: true }).fill(`Objetivo E2E ${tag}`);
    await page.getByLabel("Sponsor", { exact: true }).fill("Sponsor sintético");
    await page.getByLabel("Zona horaria IANA").fill("America/Cancun");
    await page.getByLabel("Apertura prevista (UTC)").fill("2026-10-01T12:00");
    await page.getByLabel("Cierre previsto (UTC)").fill("2026-10-02T12:00");
    await page.getByLabel("Coordinador", { exact: true }).selectOption({ label: "Coordinador demo A" });
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toHaveText("Guardado");
    await page.reload();
    await expect(page.getByLabel("Objetivo", { exact: true })).toHaveValue(`Objetivo E2E ${tag}`);
    await expect(page.getByLabel("Zona horaria IANA")).toHaveValue("America/Cancun");
  });
  test("E2E-P2-04 DIR aplicable, población y censo", async ({ page }) => {
    await signIn(page); await page.goto(assessmentUrl.replace("tab=general", "tab=perspectivas"));
    await page.getByRole("button", { name: "Configurar Dirección" }).click();
    await page.getByLabel("Estado", { exact: true }).selectOption("APPLICABLE");
    await page.getByLabel("Población estimada").fill("14");
    await page.getByLabel("Plan", { exact: true }).selectOption("CENSUS");
    await page.getByRole("dialog", { name: "Configurar Dirección" }).getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("1 de 5 configuradas")).toBeVisible();
    await page.reload(); await expect(page.getByText("Población: 14 · Plan: Censo")).toBeVisible();
  });
  test("E2E-P2-05 CLI permite B2B; DIR no muestra unidad cliente", async ({ page }) => {
    await signIn(page); await page.goto(assessmentUrl.replace("tab=general", "tab=perspectivas"));
    await page.getByRole("button", { name: "Editar Dirección" }).click();
    await expect(page.getByLabel("Unidad de cliente")).toHaveCount(0);
    await page.getByRole("dialog", { name: "Configurar Dirección" }).getByRole("button", { name: "Cancelar" }).click();
    await page.getByRole("button", { name: "Configurar Voz del Cliente" }).click();
    await page.getByLabel("Estado", { exact: true }).selectOption("APPLICABLE");
    await page.getByLabel("Unidad de cliente").selectOption("B2B");
    await page.getByRole("dialog", { name: "Configurar Voz del Cliente" }).getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toHaveText("Perspectiva guardada");
    await page.reload(); await expect(page.getByText(/Unidad: B2B/)).toBeVisible();
  });
  test("E2E-P2-06 agrega segmento", async ({ page }) => {
    await signIn(page); await page.goto(assessmentUrl.replace("tab=general", "tab=perspectivas"));
    await page.getByRole("button", { name: "Agregar segmento" }).click();
    await page.getByLabel("Dimensión").fill("Área");
    await page.getByLabel("Nombre / etiqueta").fill(`Ventas ${tag}`);
    await page.getByRole("dialog", { name: "Agregar segmento" }).getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toHaveText("Segmento agregado");
    await expect(page.getByRole("row").filter({ hasText: `Ventas ${tag}` })).toContainText("Pendiente");
  });
  test("E2E-P2-07 marca segmento no reportable", async ({ page }) => {
    await signIn(page); await page.goto(assessmentUrl.replace("tab=general", "tab=perspectivas"));
    await page.getByRole("row").filter({ hasText: `Ventas ${tag}` }).getByRole("button", { name: "Editar" }).click();
    await page.getByLabel("Reportabilidad").selectOption("NOT_REPORTABLE");
    await page.getByLabel("Motivo / observaciones").fill("Segmento singular");
    await page.getByRole("dialog", { name: "Editar segmento" }).getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toHaveText("Segmento guardado");
    await page.reload(); await expect(page.getByRole("row").filter({ hasText: `Ventas ${tag}` })).toContainText("No reportable");
  });
  test("E2E-P2-08 coordinador sólo lee y backend rechaza mutación", async ({ page }) => {
    await signIn(page, "coordinador@ieo.local"); await page.goto(assessmentUrl);
    await expect(page.getByText("Vista de consulta.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Guardar cambios" })).toHaveCount(0);
    await page.getByRole("link", { name: "Perspectivas" }).click();
    await expect(page.getByRole("button", { name: "Agregar segmento" })).toHaveCount(0);
    const id = new URL(assessmentUrl).pathname.split("/").pop();
    const response = await page.request.post(`/api/assessments/${id}/segments`, { headers: { origin: new URL(page.url()).origin }, data: { dimension: "Área", label: "Prohibido", reportabilityStatus: "PENDING", reason: null } });
    expect(response.status()).toBe(404);
    await expect(page.getByRole("button", { name: "Nuevo diagnóstico" })).toHaveCount(0);
  });
  test("E2E-P2-09 consultor A no accede a B", async ({ page }) => {
    await signIn(page);
    expect((await page.goto(`/diagnosticos/${demoIds.assessmentB}?tab=perspectivas`))?.status()).toBe(404);
  });
  test("E2E-P2-10 tablet muestra workspace sin desbordamiento", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); await signIn(page); await page.goto(assessmentUrl);
    await expect(page.getByRole("heading", { name: "Información general" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Perspectivas" }).click();
    await expect(page.getByText("Cinco perspectivas")).toBeVisible();
  });
});
