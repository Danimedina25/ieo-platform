import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { VersionedCatalog } from "@/infrastructure/catalog/load";

// Playwright loads native ESM, so catalogs are read as files instead of JSON imports.
export function catalogFor(perspectiveCode: string) {
  const file = { DIR: "ieo-dir-01", ESP: "ieo-esp-01", LID: "ieo-lid-01", COL: "ieo-col-01", CLI: "ieo-cli-01" }[perspectiveCode];
  return JSON.parse(readFileSync(`src/domain/survey/catalogs/${file}-v1.0.json`, "utf8")) as VersionedCatalog;
}
export function itemText(perspectiveCode: string, code: string) { return catalogFor(perspectiveCode).questions.find(question => question.code === code)!.text; }
export const likertQuestions = (page: Page) => page.locator("fieldset").filter({ has: page.locator("input[type=radio]") });
export async function answerItems(page: Page, count: number, option: string, from = 0) {
  for (let index = from; index < from + count; index++) await likertQuestions(page).nth(index).getByLabel(option, { exact: true }).check();
}
export async function openSection(page: Page, name: RegExp | string, heading: RegExp | string) {
  await page.getByRole("navigation", { name: "Avance por Elemento" }).getByRole("button", { name }).click();
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
}
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
/** Answers the 60 % minimum of every Element with the given option, Element by Element. */
export async function answerMinimum(page: Page, perspectiveCode: string, option = "4 — De acuerdo") {
  const catalog = catalogFor(perspectiveCode);
  for (const [index, roman] of ROMAN.entries()) {
    await openSection(page, new RegExp(`^Elemento ${roman}:`), new RegExp(`^Elemento ${roman} · `));
    const size = catalog.questions.filter(question => question.kind === "QUANT" && question.elementCode === `E0${index + 1}`).length;
    await answerItems(page, Math.ceil(size * 3 / 5), option);
  }
}
