export type SurveyItem = Readonly<{
  key: string;
  type: "LIKERT" | "TEXT";
  text: string;
  order: number;
  required: boolean;
  allowNA: boolean;
}>;
export type SurveyDefinition = Readonly<{
  code: string;
  version: number;
  title: string;
  sections: readonly Readonly<{ id: string; title: string; items: readonly SurveyItem[] }>[];
}>;
export const technicalSurvey: SurveyDefinition = {
  code: "TECH-SURVEY-01",
  version: 1,
  title: "PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL",
  sections: [
    { id: "BLOCK_A", title: "Bloque A", items: [
      { key: "TECH_Q1", type: "LIKERT", text: "Prueba técnica Q1: el formulario permite elegir una opción.", order: 1, required: true, allowNA: false },
      { key: "TECH_Q2", type: "LIKERT", text: "Prueba técnica Q2: esta respuesta es opcional.", order: 2, required: false, allowNA: false },
      { key: "TECH_Q3", type: "LIKERT", text: "Prueba técnica Q3: comprueba la opción No aplica.", order: 3, required: false, allowNA: true },
    ] },
    { id: "BLOCK_B", title: "Bloque B", items: [
      { key: "TECH_Q4", type: "LIKERT", text: "Prueba técnica Q4: confirma la navegación entre bloques.", order: 4, required: true, allowNA: false },
      { key: "TECH_O1", type: "TEXT", text: "Prueba técnica O1: escribe un comentario ficticio opcional.", order: 5, required: false, allowNA: false },
    ] },
  ],
};
export const technicalItems = technicalSurvey.sections.flatMap(section => section.items);
export const technicalItemByKey = new Map(technicalItems.map(item => [item.key, item]));
export type SurveyAnswer = Readonly<{ itemKey: string; answerState: "MISSING" | "VALUE" | "NA"; numericValue?: number | null; textValue?: string | null }>;
export function validateTechnicalAnswer(input: SurveyAnswer) {
  const item = technicalItemByKey.get(input.itemKey);
  if (!item) throw new Error("Ítem técnico desconocido.");
  if (input.answerState === "MISSING") {
    if (input.numericValue != null || input.textValue != null) throw new Error("Respuesta ausente incompatible.");
    return { item, answerState: "MISSING" as const, numericValue: null, textValue: null };
  }
  if (input.answerState === "NA") {
    if (item.type !== "LIKERT" || !item.allowNA || input.numericValue != null || input.textValue != null) throw new Error("N/A no permitido.");
    return { item, answerState: "NA" as const, numericValue: null, textValue: null };
  }
  if (item.type === "LIKERT") {
    if (!Number.isInteger(input.numericValue) || input.numericValue! < 1 || input.numericValue! > 5 || input.textValue != null) throw new Error("Valor técnico inválido.");
    return { item, answerState: "VALUE" as const, numericValue: input.numericValue!, textValue: null };
  }
  if (typeof input.textValue !== "string" || input.textValue.length > 4000 || input.numericValue != null) throw new Error("Texto técnico inválido.");
  return { item, answerState: input.textValue.trim() === "" ? "MISSING" as const : "VALUE" as const, numericValue: null, textValue: input.textValue.trim() === "" ? null : input.textValue };
}
export function missingRequiredKeys(answers: readonly SurveyAnswer[]): string[] {
  const byKey = new Map(answers.map(answer => [answer.itemKey, answer]));
  return technicalItems.filter(item => item.required && (!byKey.has(item.key) || byKey.get(item.key)?.answerState === "MISSING")).map(item => item.key);
}
