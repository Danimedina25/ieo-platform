import { join } from "node:path";
import { xlsxSheetRows } from "@/infrastructure/catalog/office-sources";
import { Rational } from "@/domain/ieo-engine/rational";
import { healthLevel, trafficLight } from "@/domain/ieo-engine/classify";
import { elementCoverage, globalIndex, individualScore, integratedResult, perspectiveResult, scoreResponse, triangulationGap, type PerspectiveCode, type ValidRp } from "@/domain/ieo-engine/stages";
import { elementCodes } from "@/domain/survey/elements";

// Runs the official acceptance matrix S12 (Matriz_Casos_Prueba_Resultados_Esperados_IEO_v1.0.xlsx) against the engine.
// Inputs and expectations are read from the workbook itself; nothing is retyped. Numeric comparisons use the
// workbook tolerance |actual − expected| < 0.000001, and statuses, classes and nullity are compared explicitly.
export const S12_FILE = "Matriz_Casos_Prueba_Resultados_Esperados_IEO_v1.0.xlsx";
const TOLERANCE = Rational.of(1, 1_000_000);

export type CaseResult = Readonly<{ caseId: string; layer: string; name: string; input: string; expected: string; obtained: string; pass: boolean }>;

function sheet(docsDir: string, name: string) {
  const rows = xlsxSheetRows(join(docsDir, S12_FILE), name);
  const header = rows.get(3);
  if (!header) throw new Error(`S12 ${name}: sin cabecera en la fila 3.`);
  const columns = Object.fromEntries(Object.entries(header).map(([column, title]) => [title, column]));
  return [...rows.entries()].filter(([index, cells]) => index > 3 && /^T\d+N?$/.test(cells.A ?? "")).map(([, cells]) => (title: string) => {
    const column = columns[title];
    if (!column) throw new Error(`S12 ${name}: falta la columna ${title}.`);
    return (cells[column] ?? "").trim();
  });
}
const number = (text: string) => Rational.fromDecimal(text);
const close = (actual: Rational | null, expected: Rational | null) => actual === null || expected === null ? actual === expected : actual.sub(expected).compare(TOLERANCE) < 0 && expected.sub(actual).compare(TOLERANCE) < 0;
const show = (value: Rational | null) => (value === null ? "NULL" : value.toDecimal(12));

export function runS12(docsDir: string): CaseResult[] {
  const catalog = new Map(sheet(docsDir, "01_CASOS").map(get => [get("case_id"), { layer: get("layer"), name: get("case_name") }]));
  const results: CaseResult[] = [];
  const push = (caseId: string, input: string, expected: string, obtained: string, pass: boolean) => results.push({ caseId, ...catalog.get(caseId)!, input, expected, obtained, pass });

  for (const get of sheet(docsDir, "02_REACTIVOS")) { // T01–T05
    const raw = get("raw_response") === "NA" ? "NA" : Number(get("raw_response"));
    const scored = scoreResponse(raw, get("orientation") as "DIRECT" | "REVERSE", get("na_allowed") === "1");
    const expected = { recoded: get("expected_recoded") || null, score: get("expected_score_100") || null, isNA: get("expected_is_na") === "1", status: get("expected_status") };
    const pass = String(scored.recoded ?? "") === (expected.recoded ?? "") && close(scored.score100, expected.score ? number(expected.score) : null) && scored.isNA === expected.isNA && scored.status === expected.status;
    push(get("case_id"), `raw=${raw}, ${get("orientation")}`, `recoded=${expected.recoded ?? "NULL"}, score=${expected.score ?? "NULL"}, is_na=${expected.isNA}, ${expected.status}`, `recoded=${scored.recoded ?? "NULL"}, score=${show(scored.score100)}, is_na=${scored.isNA}, ${scored.status}`, pass);
  }
  for (const get of sheet(docsDir, "03_COBERTURA")) { // T06, T06N, T07
    const statuses = [...Array(Number(get("valid_items"))).fill("VALID"), ...Array(Number(get("na_items"))).fill("EXCLUDED"), ...Array(Number(get("missing_items"))).fill("MISSING")];
    if (statuses.length !== Number(get("total_items_element"))) throw new Error(`S12 ${get("case_id")}: conteos inconsistentes.`);
    const coverage = elementCoverage(statuses);
    const pi = individualScore(coverage, Array(coverage.validItems).fill(Rational.of(50)));
    const coverageStatus = { SUFFICIENT: "SUFFICIENT", INSUFFICIENT: "INSUFFICIENT", NOT_CALCULABLE: "NOT_CALCULABLE" }[coverage.coverageStatus];
    const pass = String(coverage.applicableItems) === get("applicable_items") && close(coverage.coverage, number(get("expected_coverage"))) && coverageStatus === get("expected_status") && pi.status === get("expected_PI_status");
    push(get("case_id"), `total=${coverage.totalItems}, válidos=${coverage.validItems}, NA=${coverage.naItems}, omitidos=${coverage.missingItems}`, `aplicables=${get("applicable_items")}, cobertura=${get("expected_coverage")}, ${get("expected_status")}, PI ${get("expected_PI_status")}`, `aplicables=${coverage.applicableItems}, cobertura=${show(coverage.coverage)}, ${coverageStatus}, PI ${pi.status}`, pass);
  }
  for (const get of sheet(docsDir, "04_PI")) { // T08, T09
    const scores = ["score1", "score2", "score3", "score4", "score5"].map(get).filter(Boolean).map(number);
    const coverage = elementCoverage(Array(scores.length).fill("VALID"));
    const pi = individualScore(coverage, scores);
    push(get("case_id"), `scores=${scores.map(show).join(",")}`, `PI=${get("expected_PI")}, ${get("expected_status")}`, `PI=${show(pi.pi)}, ${pi.status}`, close(pi.pi, number(get("expected_PI"))) && pi.status === get("expected_status") && String(scores.length) === get("valid_count"));
  }
  for (const get of sheet(docsDir, "05_RP")) { // T10, T11
    const pis = ["PI_1", "PI_2", "PI_3", "PI_4"].map(get).filter(Boolean).map(number);
    const rp = perspectiveResult("APPLICABLE", false, pis);
    push(get("case_id"), `PI=${pis.map(show).join(",")}`, `RP=${get("expected_RP")}, ${get("expected_status")}`, `RP=${show(rp.rp)}, ${rp.status}`, close(rp.rp, number(get("expected_RP"))) && rp.status === get("expected_status") && String(rp.validPiCount) === get("valid_pi_count"));
  }
  for (const get of sheet(docsDir, "06_BT")) { // T12–T17
    const rps: ValidRp[] = [{ perspectiveCode: get("max_perspective") as PerspectiveCode, rp: number(get("rp_max")) }, { perspectiveCode: get("min_perspective") as PerspectiveCode, rp: number(get("rp_min")) }];
    const gap = triangulationGap(rps);
    const pass = close(gap.gap, number(get("expected_BT"))) && gap.gapClass === get("expected_class") && gap.maxPerspectives.join() === get("max_perspective") && gap.minPerspectives.join() === get("min_perspective");
    push(get("case_id"), `max ${get("max_perspective")}=${get("rp_max")}, min ${get("min_perspective")}=${get("rp_min")}`, `BT=${get("expected_BT")}, ${get("expected_class")}`, `BT=${show(gap.gap)}, ${gap.gapClass}, max=${gap.maxPerspectives.join()}, min=${gap.minPerspectives.join()}`, pass);
  }
  for (const get of sheet(docsDir, "07_RI")) { // T18, T19 (n columns are deliberately ignored: no sample-size weighting)
    const rps: ValidRp[] = (["DIR", "COL", "ESP", "LID", "CLI"] as const).flatMap(code => (get(`${code}_RP`) ? [{ perspectiveCode: code, rp: number(get(`${code}_RP`)) }] : []));
    const ri = integratedResult(rps);
    push(get("case_id"), rps.map(row => `${row.perspectiveCode}=${show(row.rp)}`).join(", "), `RI=${get("expected_RI")}, ${get("expected_status")}`, `RI=${show(ri.ri)}, ${ri.status}`, close(ri.ri, number(get("expected_RI"))) && ri.status === get("expected_status") && String(ri.validPerspectiveCount) === get("valid_perspectives"));
  }
  for (const get of sheet(docsDir, "08_GLOBAL")) { // T20, T21
    const ris = ["RI_E1", "RI_E2", "RI_E3", "RI_E4", "RI_E5", "RI_E6", "RI_E7", "RI_E8"].map(get).map(number);
    const result = globalIndex(elementCodes.map((elementCode, index) => ({ elementCode, result: { ri: ris[index], status: "INTEGRATED", validPerspectiveCount: 2, perspectives: [] } })));
    const pass = close(result.value, number(get("expected_global"))) && result.status === "COMPLETE" && result.classification?.health.label === get("expected_health") && result.classification?.light === get("expected_light");
    push(get("case_id"), `RI=${ris.map(show).join(", ")}`, `Global=${get("expected_global")}, ${get("expected_health")}, ${get("expected_light")}`, `Global=${show(result.value)} (entero ${result.classification?.displayScore}), ${result.classification?.health.label}, ${result.classification?.light}`, pass);
  }
  // 08_GLOBAL A9:C21 — health/traffic-light boundaries (not counted among the 23 cases).
  const rows = xlsxSheetRows(join(docsDir, S12_FILE), "08_GLOBAL");
  for (let row = 9; row <= 21; row++) {
    const cells = rows.get(row)!;
    const score = Number(cells.A);
    const health = healthLevel(score).label, light = trafficLight(score);
    results.push({ caseId: `B${score}`, layer: "Frontera de salud", name: `08_GLOBAL fila ${row}`, input: `score=${score}`, expected: `${cells.B}, ${cells.C}`, obtained: `${health}, ${light}`, pass: health === cells.B && light === cells.C });
  }
  { // T22 end-to-end of one Element: PI → RP → BT → RI
    const all = xlsxSheetRows(join(docsDir, S12_FILE), "09_END_TO_END");
    const rps: (ValidRp & { expected: string })[] = [];
    let rpPass = true;
    for (let row = 5; row <= 9; row++) {
      const cells = all.get(row)!;
      const pis = ["B", "C", "D", "E"].map(column => cells[column]).filter(Boolean).map(number);
      const rp = perspectiveResult("APPLICABLE", false, pis);
      rpPass &&= close(rp.rp, number(cells.G)) && rp.status === cells.K;
      rps.push({ perspectiveCode: cells.A as PerspectiveCode, rp: rp.rp!, expected: cells.G });
    }
    const gap = triangulationGap(rps), ri = integratedResult(rps);
    const bt = all.get(13)!, riRow = all.get(14)!;
    const pass = rpPass && close(gap.gap, number(bt.C)) && gap.gapClass === bt.D && close(ri.ri, number(riRow.C)) && ri.status === riRow.D && gap.maxPerspectives.join() === "CLI" && gap.minPerspectives.join() === "COL";
    push("T22", rps.map(row => `${row.perspectiveCode} RP=${show(row.rp)}`).join(", "), `RP=${rps.map(row => row.expected).join("/")}; BT=${bt.C} ${bt.D}; RI=${riRow.C} ${riRow.D}`, `BT=${show(gap.gap)} ${gap.gapClass} (${gap.status}, max ${gap.maxPerspectives.join()}, min ${gap.minPerspectives.join()}); RI=${show(ri.ri)} ${ri.status}`, pass);
  }
  return results;
}
