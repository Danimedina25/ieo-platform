import { expect, test, type Page } from "@playwright/test";
import { demoIds, seedEnvironment } from "../../prisma/seed-data";
const env = seedEnvironment();
async function signIn(page: Page, email = "consultor@ieo.local", password = env.SEED_USER_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Correo", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/diagnosticos$/);
}
test("E2E-001 acceso no autenticado redirige", async ({ page }) => {
  await page.goto("/diagnosticos"); await expect(page).toHaveURL(/\/login$/);
  await page.goto("/"); await expect(page).toHaveURL(/\/login$/);
});
test("E2E-002 admin y cookie segura", async ({ page, context }) => {
  await signIn(page, env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
  await expect(page.getByRole("link", { name: "Diagnóstico Demo A 2026" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Diagnóstico Demo B 2026" })).toBeVisible();
  expect((await context.cookies()).find(x => x.name === "__Host-ieo-admin")).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
});
test("E2E-003 consultor ve solo A y detalle", async ({ page }) => {
  await signIn(page);
  await expect(page.getByText("Organización Demo B", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Diagnóstico Demo A 2026" }).click();
  await expect(page.getByRole("heading", { name: "Diagnóstico Demo A 2026" })).toBeVisible();
});
test("E2E-004 URL B devuelve 404", async ({ page }) => {
  await signIn(page);
  expect((await page.goto(`/diagnosticos/${demoIds.assessmentB}`))?.status()).toBe(404);
  await expect(page.getByText("Diagnóstico Demo B 2026")).toHaveCount(0);
});
test("E2E-005 logout revoca bearer anterior", async ({ page, context }) => {
  await signIn(page); const old = await context.cookies();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await context.addCookies(old); await page.goto("/diagnosticos"); await expect(page).toHaveURL(/\/login$/);
});
test("coordinador no accede a B", async ({ page }) => {
  await signIn(page, "coordinador@ieo.local");
  await expect(page.getByRole("cell", { name: "Organización Demo A" }).first()).toBeVisible();
  expect((await page.goto(`/diagnosticos/${demoIds.assessmentB}`))?.status()).toBe(404);
});
test("login error genérico", async ({ page }) => {
  await page.goto("/login"); await page.getByLabel("Correo", { exact: true }).fill("unknown@ieo.local");
  await page.getByLabel("Contraseña", { exact: true }).fill(env.SEED_USER_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page.locator("#login-error")).toHaveText("Correo o contraseña incorrectos.");
});
test("CSRF rechazado y GET no revoca", async ({ page }) => {
  await signIn(page);
  expect((await page.request.post("/api/auth/logout", { headers: { origin: "https://attacker.example" } })).status()).toBe(403);
  expect((await page.request.get("/api/auth/logout")).status()).toBe(405);
  await page.goto("/diagnosticos"); await expect(page).toHaveURL(/\/diagnosticos$/);
});
test("login móvil con teclado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/login");
  await page.getByLabel("Correo", { exact: true }).focus(); await page.keyboard.type("consultor2@ieo.local"); await page.keyboard.press("Tab");
  await expect(page.getByLabel("Contraseña", { exact: true })).toBeFocused();
  await page.keyboard.type(env.SEED_USER_PASSWORD); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/diagnosticos$/);
  await expect(page.getByRole("cell", { name: "Organización Demo B" })).toBeVisible();
});
