import { officialCatalogs } from "@/infrastructure/catalog/load";
import { validNeeded } from "@/domain/survey/coverage";

/** The fewest valid answers that let a questionnaire be submitted: the 60 % minimum of every Element, value 4. */
export function minimalAnswers(perspectiveCode: string) {
  const catalog = officialCatalogs.find(item => item.perspectiveCode === perspectiveCode)!;
  return catalog.sections.filter(section => section.elementCode).flatMap(section => {
    const items = catalog.questions.filter(question => question.kind === "QUANT" && question.elementCode === section.elementCode);
    return items.slice(0, validNeeded({ applicable: items.length })).map(question => ({ itemKey: question.code, answerState: "VALUE" as const, numericValue: 4 }));
  });
}
