// Plain-language explanations behind the "?" buttons. One source for every screen, so the same concept is
// always explained the same way. Texts follow the official package (Protocolo, Modelo Matemático 1.1) and
// the provisional rules in METHODOLOGY_GAPS.md; review them with the methodology custodian when those change.
export type HelpEntry = Readonly<{ title: string; text: string; example?: string }>;

export const HELP = {
  // General
  sponsor: { title: "Sponsor", text: "La persona de la organización que autoriza el diagnóstico y lo respalda. Facilita el acceso a las personas, pero no ve respuestas individuales.", example: "La Directora General que pidió el diagnóstico." },
  scopeUnits: { title: "Unidades o sedes incluidas", text: "Qué partes de la organización entran en el diagnóstico. Sirve para dejar claro el alcance desde el inicio.", example: "Planta Monterrey y oficinas corporativas; no incluye la sucursal Mérida." },
  plannedDates: { title: "Apertura y cierre previstos", text: "Las fechas en que planeas recibir respuestas. Al llegar la fecha de cierre prevista el sistema deja de aceptar respuestas, aunque todavía no cierres la aplicación.", example: "Del 3 al 14 de marzo: después del 14 nadie puede enviar." },

  // Perspectives
  perspective: { title: "Perspectiva", text: "Cada uno de los cinco grupos que opinan sobre la organización: Dirección, Especialistas, Liderazgo, Colaboradores y Voz del Cliente. Cada grupo contesta su propio cuestionario sobre los mismos ocho Elementos.", example: "Como en un chequeo médico: preguntarle al paciente, al familiar y al especialista." },
  applicability: { title: "Aplicable, no aplicable o no disponible", text: "Aplicable: el grupo sí participa. No aplicable (NP): no forma parte del alcance desde el inicio. No disponible (ND): debía participar pero no se pudo. NP y ND nunca se rellenan con ceros: el resultado lo muestra tal cual.", example: "Una empresa sin clientes externos marca Voz del Cliente como no aplicable." },
  population: { title: "Población estimada", text: "Cuántas personas forman ese grupo en la organización. Sirve como referencia para valorar la participación.", example: "120 colaboradores en total." },
  collectionMode: { title: "Censo o muestra", text: "Censo: se invita a todas las personas del grupo. Muestra: sólo a una parte elegida.", example: "Censo con los 8 directivos; muestra de 40 de los 120 colaboradores." },
  cliUnit: { title: "Unidad de cliente", text: "Qué tipo de cliente contesta Voz del Cliente. B2B: los clientes son otras empresas. B2C: los clientes son consumidores finales." },
  segment: { title: "Segmento", text: "Una forma de dividir a los participantes, como área o sede. Guardar un segmento no significa que se pueda reportar: primero se revisa que no permita identificar a nadie.", example: "Dimensión «Sede», segmento «Planta Monterrey»." },
  segmentReportability: { title: "Reportabilidad del segmento", text: "Si los resultados de ese segmento se pueden presentar. Si el grupo es tan pequeño que alguien podría ser identificado, se marca como no reportable." },

  // Participants
  invitation: { title: "Invitación", text: "Cada persona recibe un enlace personal por correo. Al abrirlo, el sistema le manda un código de 6 dígitos para entrar; no necesita usuario ni contraseña. En Borrador las invitaciones esperan y se envían todas al abrir la aplicación." },
  invitationStatus: { title: "Estado de la invitación", text: "Pendiente de envío: se envía al abrir. Enviada: el correo salió. Ingresó con su código: ya entró al cuestionario. Respondió: envió su cuestionario. Cancelada o vencida: el enlace ya no funciona." },

  // Closure
  participation: { title: "Participación", text: "Invitados: invitaciones vigentes. Enviados: cuestionarios terminados. Borradores: guardados sin enviar; se conservan pero no entran al cálculo. Excluidos: enviados que el consultor quitó del cálculo con un motivo." },
  exclusion: { title: "Exclusión", text: "Quitar del cálculo un cuestionario enviado completo, siempre con un motivo: duplicado, prueba, fuera de la población, etc. Nunca se excluye a alguien por responder de forma desfavorable. Se puede revocar mientras no congeles los datos." },
  incident: { title: "Incidencia", text: "Algo que pasó durante la aplicación y conviene dejar documentado en el acta: correos que no llegaron, presiones a los participantes, fallas técnicas. Registra qué pasó, su impacto y qué se hizo." },
  verdict: { title: "Dictamen de calidad", text: "Tu juicio sobre si la evidencia es confiable. A: válida. B: válida con reservas (escribe cuáles). C: insuficiente; esa perspectiva sale del cálculo. Si el dictamen global es C, los resultados no se pueden publicar.", example: "B en Dirección: «sólo respondieron 2 de 8 directivos»." },
  checklist: { title: "Checklist oficial", text: "Los 16 criterios del Protocolo que confirmas antes de cerrar: alcance, versión de los instrumentos, voluntariedad, confidencialidad, entre otros. Sin el checklist guardado no se pueden congelar los datos." },
  freeze: { title: "Congelar", text: "Saca una copia de las respuestas válidas que ya no puede cambiar, sin datos de identidad, y genera el Acta Oficial de Cierre. El cálculo siempre se hace sobre esta copia, para que el resultado se pueda reproducir." },
  reopen: { title: "Reabrir y revisión", text: "Si hay que corregir algo después de cerrar, se reabre con un motivo. Eso crea una revisión nueva (revisión 2, 3…) que vuelve a recibir respuestas. La revisión anterior se conserva completa para auditoría." },
  acta: { title: "Acta Oficial de Cierre", text: "El documento que resume la aplicación: fechas, participación, incidencias, exclusiones, dictamen y responsable. Se genera al congelar y queda sellada con una huella digital." },
  fingerprint: { title: "Huella digital", text: "Un código calculado a partir del contenido. Si alguien cambiara un solo dato, la huella sería distinta; así se comprueba que nada se alteró." },
  processing: { title: "Procesamiento", text: "El cálculo de los resultados con el Modelo Matemático oficial sobre la copia congelada. Con los mismos datos da siempre el mismo resultado. Puedes reprocesar: los procesamientos anteriores se conservan." },

  // Results
  global: { title: "Índice Global IEO", text: "El promedio de los resultados integrados de los ocho Elementos, de 0 a 100. Resume la salud general, pero nunca se presenta solo: un Global aceptable puede esconder un Elemento en rojo o una brecha crítica.", example: "Global 64: «En erosión», semáforo naranja." },
  healthLevel: { title: "Nivel de salud y semáforo", text: "La clasificación del resultado redondeado: 95–100 Ejemplar, 90–94 Muy saludable, 80–89 Saludable, 70–79 Estable con riesgos, 60–69 En erosión, 50–59 Erosión importante, 0–49 Crítico. Un .5 exacto se redondea hacia abajo: 79.5 queda en 79." },
  matrix: { title: "Matriz de triangulación", text: "Cada celda es el resultado de una perspectiva en un Elemento (RP): el promedio de las puntuaciones de sus personas, de 0 a 100. Debajo se ve cuántas personas tienen resultado válido.", example: "Colaboradores 34.4 en Innovación: ese grupo ve poca innovación." },
  ri: { title: "Resultado integrado (RI)", text: "El promedio de las perspectivas en un Elemento. Cada perspectiva pesa igual, sin importar cuántas personas tenga. Con una sola perspectiva válida el resultado queda «limitado».", example: "Dirección 90 y Colaboradores 62.5 → RI 76.3." },
  bt: { title: "Brecha de triangulación (BT)", text: "La distancia entre la perspectiva que califica más alto y la que califica más bajo un Elemento. Mide desacuerdo, no salud. 0–12 alta convergencia, 13–24 diferencia moderada, 25–37 brecha relevante, 38 o más brecha crítica.", example: "Dirección 96.9 y Colaboradores 34.4 → brecha 62, crítica." },
  perspectiveIndex: { title: "Índice por perspectiva", text: "El promedio de los ocho Elementos para un grupo. Sólo se calcula si el grupo tiene resultado en los ocho; si le falta alguno queda ND." },
  ndnp: { title: "ND y NP", text: "NP: esa perspectiva no se aplicó. ND: se aplicó pero no hay evidencia suficiente, por ejemplo porque todos marcaron N/A o el dictamen fue C. Nunca se rellenan con ceros." },
  pattern: { title: "Patrón de triangulación", text: "Tu lectura de cada Elemento como consultor: fortaleza consistente, erosión consistente, brecha de percepción, resultado mixto o evidencia limitada. El sistema no lo decide solo; tú lo registras con su justificación." },
  disclosure: { title: "Revisión de divulgación", text: "Decidir qué perspectivas se pueden reportar sin identificar a nadie. Si sólo respondieron dos directivos, su resultado podría revelar lo que dijo cada uno. Marcar «no reportable» no cambia el cálculo, sólo lo que se presenta." },
  qualitative: { title: "Evidencia cualitativa", text: "Las respuestas abiertas, sin datos de quién las escribió y en orden aleatorio. Márcalas como aptas para citar, redactadas (escribes una versión que no identifique a nadie) o no citables. El texto original nunca se modifica." },

  // Exports
  exportsReport: { title: "Exportaciones para tu reporte", text: "Datos agregados que respetan la revisión de divulgación y la revisión de citas. Se descargan libremente y cada descarga queda registrada." },
  exportsIndividual: { title: "Datos individuales", text: "Exportaciones con información por participante, identificado sólo con un seudónimo. Por confidencialidad requieren un permiso temporal aprobado por el custodio metodológico." },
  grant: { title: "Permiso excepcional", text: "Una autorización temporal para descargar datos individuales. La pides con un propósito; el custodio metodológico la aprueba o la rechaza. Nadie aprueba su propia solicitud y dura como máximo 30 días.", example: "«Auditoría metodológica del procesamiento», 7 días." },
  pseudonym: { title: "Seudónimo", text: "Un código que reemplaza la identidad de cada participante en las exportaciones (P0001, P0002…). Permite distinguir personas sin saber quiénes son." },
} as const satisfies Record<string, HelpEntry>;
export type HelpKey = keyof typeof HELP;
