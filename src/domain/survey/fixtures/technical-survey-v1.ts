import { submissionCheck } from "../coverage";
import { surveyItems, validateAnswer, type SurveyAnswer, type SurveyDefinition } from "../definition";
export type { SurveyAnswer, SurveyDefinition, SurveyItem } from "../definition";
const likertScale: SurveyDefinition["scale"] = [
  { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5" }, { value: "NA", label: "No aplica" },
];
const section = (id: string, title: string) => ({ id, label: null, title, elementCode: null, introduction: null, instructions: null });
const item = (key: string, type: "LIKERT" | "TEXT", text: string, order: number, required: boolean, allowNA: boolean) => ({ key, type, text, order, required, allowNA, elementCode: null });
export const technicalSurvey: SurveyDefinition = {
  code: "TECH-SURVEY-01",
  version: "1",
  title: "PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL",
  submissionRule: "REQUIRED_ITEMS",
  scale: likertScale,
  sections: [
    { ...section("BLOCK_A", "Bloque A"), items: [
      item("TECH_Q1", "LIKERT", "Prueba técnica Q1: el formulario permite elegir una opción.", 1, true, false),
      item("TECH_Q2", "LIKERT", "Prueba técnica Q2: esta respuesta es opcional.", 2, false, false),
      item("TECH_Q3", "LIKERT", "Prueba técnica Q3: comprueba la opción No aplica.", 3, false, true),
    ] },
    { ...section("BLOCK_B", "Bloque B"), items: [
      item("TECH_Q4", "LIKERT", "Prueba técnica Q4: confirma la navegación entre bloques.", 4, true, false),
      item("TECH_O1", "TEXT", "Prueba técnica O1: escribe un comentario ficticio opcional.", 5, false, false),
    ] },
  ],
};
export const technicalItems = surveyItems(technicalSurvey);
export function validateTechnicalAnswer(input: SurveyAnswer) { return validateAnswer(technicalSurvey, input); }
export function missingRequiredKeys(answers: readonly SurveyAnswer[]): string[] { return submissionCheck(technicalSurvey, answers).missingRequired; }
