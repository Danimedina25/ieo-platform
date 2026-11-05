// Incident catalog. Types follow the quality-control list of the Protocolo §15; the impact levels are a technical
// proposal pending Marco's confirmation (the sources name impact_level in Diccionario §33 but do not define levels).
export const INCIDENT_TYPES = {
  DUPLICATE_SUBMISSION: "Envío duplicado o repetido",
  TEST_RESPONSE: "Respuesta generada durante pruebas",
  OUT_OF_POPULATION: "Registro fuera de la población definida",
  TECHNICAL_ERROR: "Error técnico o de configuración",
  PRESSURE_OR_MANIPULATION: "Presión o manipulación reportada",
  WINDOW_OR_SCOPE_CHANGE: "Modificación de ventana o alcance",
  EMAIL_NOT_RECEIVED: "Invitación o código no recibido",
  OTHER: "Otra",
} as const;
export type IncidentType = keyof typeof INCIDENT_TYPES;

export const IMPACT_LEVELS = {
  LOW: { label: "Bajo", description: "No afecta la interpretación." },
  MEDIUM: { label: "Medio", description: "Debe mencionarse en las reservas del dictamen." },
  HIGH: { label: "Alto", description: "Puede justificar un dictamen B o C." },
} as const;
export type ImpactLevel = keyof typeof IMPACT_LEVELS;

/** Editable suggestions for «acción tomada», by incident type. */
export const SUGGESTED_ACTIONS: Record<IncidentType, readonly string[]> = {
  DUPLICATE_SUBMISSION: ["Se excluyó el cuestionario duplicado con motivo documentado.", "Se verificó que no hubo duplicado; no se excluyó."],
  TEST_RESPONSE: ["Se excluyó la respuesta de prueba del diagnóstico."],
  OUT_OF_POPULATION: ["Se excluyó el cuestionario por estar fuera de la población definida.", "Se confirmó que sí pertenece a la población; se conservó."],
  TECHNICAL_ERROR: ["Se corrigió la configuración y se reenviaron las invitaciones afectadas.", "Se documentó el error; no afectó las respuestas registradas."],
  PRESSURE_OR_MANIPULATION: ["Se informó al sponsor y se reforzó el mensaje de voluntariedad.", "Se evaluó el impacto en el dictamen de la perspectiva."],
  WINDOW_OR_SCOPE_CHANGE: ["Se registró la nueva fecha de cierre con su motivo.", "Se actualizó el alcance con autorización del consultor."],
  EMAIL_NOT_RECEIVED: ["Se reenvió la invitación con un enlace nuevo.", "Se verificó la dirección de correo con el coordinador."],
  OTHER: [],
};
