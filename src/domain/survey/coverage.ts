import { elementCodes, type ElementCode } from "./elements";
import { surveyItems, type SurveyAnswer, type SurveyDefinition } from "./definition";

// Submission threshold (GAP-004, resolved 2026-10-14): valid ≥ 60 % of the Element's applicable items,
// applicable = items − N/A. Compared as integers (valid × 5 ≥ applicable × 3) so 60 % exactly never fails by rounding.
// An Element answered entirely N/A has no applicable items: it does not block submission and stays ND (GAP-006).
const THRESHOLD = { numerator: 3, denominator: 5 } as const;

export type ElementCoverage = Readonly<{
  elementCode: ElementCode;
  total: number;
  valid: number;
  na: number;
  missing: number;
  applicable: number;
  status: "MEETS" | "BELOW" | "ALL_NA";
  /** Exact ratio valid / applicable, null when applicable = 0. For display only. */
  ratio: number | null;
}>;

export function elementCoverage(definition: SurveyDefinition, answers: readonly Pick<SurveyAnswer, "itemKey" | "answerState">[]): ElementCoverage[] {
  const states = new Map(answers.map(answer => [answer.itemKey, answer.answerState]));
  const quantitative = surveyItems(definition).filter(item => item.type === "LIKERT" && item.elementCode);
  return elementCodes.filter(code => quantitative.some(item => item.elementCode === code)).map(elementCode => {
    const items = quantitative.filter(item => item.elementCode === elementCode);
    const valid = items.filter(item => states.get(item.key) === "VALUE").length;
    const na = items.filter(item => states.get(item.key) === "NA").length;
    const applicable = items.length - na;
    const status = applicable === 0 ? "ALL_NA" : valid * THRESHOLD.denominator >= applicable * THRESHOLD.numerator ? "MEETS" : "BELOW";
    return { elementCode, total: items.length, valid, na, missing: items.length - valid - na, applicable, status, ratio: applicable === 0 ? null : valid / applicable };
  });
}

/** Minimum number of valid answers an Element needs given its current N/A count. */
export function validNeeded(coverage: Pick<ElementCoverage, "applicable">) { return Math.ceil(coverage.applicable * THRESHOLD.numerator / THRESHOLD.denominator); }

export type SubmissionCheck = Readonly<{ allowed: boolean; missingRequired: string[]; elementsBelow: ElementCode[] }>;
export function submissionCheck(definition: SurveyDefinition, answers: readonly Pick<SurveyAnswer, "itemKey" | "answerState">[]): SubmissionCheck {
  if (definition.submissionRule === "REQUIRED_ITEMS") {
    const states = new Map(answers.map(answer => [answer.itemKey, answer.answerState]));
    const missingRequired = surveyItems(definition).filter(item => item.required && (states.get(item.key) ?? "MISSING") === "MISSING").map(item => item.key);
    return { allowed: missingRequired.length === 0, missingRequired, elementsBelow: [] };
  }
  const elementsBelow = elementCoverage(definition, answers).filter(row => row.status === "BELOW").map(row => row.elementCode);
  return { allowed: elementsBelow.length === 0, missingRequired: [], elementsBelow };
}
