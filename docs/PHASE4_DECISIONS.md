# Phase 4 — decisiones previas al código

Estado: **aprobada el 2026-10-14 e implementada**; evidencia en [PHASE4_VALIDATION.md](PHASE4_VALIDATION.md). Phase 3B está terminada ([PHASE3B_VALIDATION.md](PHASE3B_VALIDATION.md)). Phase 4 extiende el mismo catálogo, renderer y regla de envío a los cuatro instrumentos restantes. Sigue siendo captura con datos ficticios (`isTest=true`) mientras GAP-001 y GAP-012 sigan abiertos.

## Alcance

| Perspectiva | Instrumento | Cuantitativos por E01–E08 | Total | Abiertas | N/A | Inversos |
|---|---|---|---:|---|---|---:|
| DIR | IEO-DIR-01 v1.0 | 9,11,10,10,10,8,8,9 | 75 | 0 | No | 0 |
| ESP | IEO-ESP-01 v1.0 | 8,10,8,8,9,8,8,9 | 68 | 8, una por Elemento | Sí | 0 |
| LID | IEO-LID-01 v1.0 | 8,11,8,9,9,8,8,9 | 70 | 8, una por Elemento | Sí | 0 |
| COL | IEO-COL-01 v1.0 | 9,9,9,10,9,9,9,9 | 73 | 8, una por Elemento | Sí | 8 |
| CLI | IEO-CLI-01 v1.0 | 5,6,4,5,5,6,7,5 | 43 | 4 generales al final, sin Elemento | Sí | 0 |

Total: 329 cuantitativos y 28 abiertas. Con esto cada perspectiva recibe su propio cuestionario oficial y la encuesta técnica `TECH-SURVEY-01` deja de servirse.

## Catálogo

- El generador de Phase 3B se generaliza con una configuración por instrumento (archivo Word, N/A permitido, ubicación de abiertas). Los textos y metadatos se concilian igual: códigos y Elementos del Excel, textos presentados del Word, y error ante cualquier diferencia no aprobada.
- Cada Word varía un poco: DIR sólo trae título y pregunta guía por Elemento, CLI agrega una instrucción por Elemento y una sección final «Preguntas abiertas» con su propia introducción. El generador ubica la tabla de reactivos por su encabezado, no por posiciones fijas.
- **El JSON de COL debe regenerarse idéntico** (mismo `contentHash`); si cambiara, sería una versión nueva y no se aceptaría sobre la ya cargada.
- Las 4 abiertas de CLI conservan sus códigos `CLI_GEN_O01–O04` con `elementCode = NULL`, en una sección sin Elemento.

## Paquete metodológico

Se agrega `MethodologyPackage` («IEO 1.0») con `PackageInstrument`: exactamente un instrumento por perspectiva. Cada diagnóstico fija su paquete al crearse, y la sesión de un participante toma el instrumento de su perspectiva dentro de ese paquete. Así, una futura versión de un cuestionario no cambia los diagnósticos existentes. Los diagnósticos ya creados se asignan al paquete IEO 1.0 en la migración.

## Regla de envío por instrumento

La misma regla de GAP-004: ≥ 60 % de respuestas válidas en cada Elemento, sin contar N/A, y Elemento todo N/A permitido (GAP-006).

- **DIR** no tiene N/A, así que necesita 60 % de los reactivos de cada Elemento. El servidor rechaza N/A en DIR aunque se envíe a mano.
- **CLI** tiene Elementos de 4 a 7 reactivos; el mínimo se redondea hacia arriba: 3 de 4, 3 de 5, 4 de 6 y 5 de 7.
- Las abiertas, incluidas las generales de CLI, siguen siendo opcionales y no cuentan.

## Experiencia del participante

Igual que COL: introducción oficial de cada instrumento con su periodo de referencia (COL «últimos seis meses», DIR/ESP «condiciones actuales», CLI «experiencia directa»), un Elemento por pantalla, avance de los 8 Elementos y revisión antes de enviar. En CLI aparece una pantalla adicional «Preguntas abiertas» antes de la revisión. En DIR no se muestra la opción N/A.

## Fuera de alcance

Cierre del diagnóstico, motor matemático, recodificación de inversos, resultados, exportaciones, certificación del catálogo (GAP-001) y participantes reales (GAP-012).

## Pruebas y definición de terminado

- Unit: los cinco catálogos reproducibles desde las fuentes; 329 + 28; distribución exacta por Elemento según la tabla; sólo COL tiene inversos; DIR sin N/A ni abiertas; CLI con 4 abiertas sin Elemento al final; ninguna orientación en lo que recibe el navegador; mínimos de envío de CLI y DIR.
- Importación inválida: el generador falla si cambia un conteo, un código, un texto sin corrección aprobada o un metadato.
- Integración MySQL: paquete con exactamente cinco instrumentos, diagnóstico con paquete fijado, sesión ligada al instrumento de su perspectiva, N/A rechazado en DIR, envío por perspectiva.
- Playwright: recorrido completo de los cinco instrumentos (móvil y escritorio).
- Las suites de fases anteriores siguen pasando, adaptadas a que ya no existe la encuesta técnica; los 12 originales conservan su SHA-256.

## Cierre de implementación

- Un solo generador (`build-instrument.ts`) produce los cinco catálogos con `npm run catalog:build`; ubica la tabla de reactivos por su encabezado y acepta una o dos líneas de guía por Elemento. El JSON de COL se regeneró byte a byte idéntico, con el mismo `contentHash`.
- **Cambio respecto a la propuesta:** los diagnósticos existentes no se asignan al paquete en la migración SQL, porque los identificadores del paquete se crean al cargar los catálogos. Lo hace `loadOfficialCatalogs` (seed, `test:db:prepare` y `npm run db:catalog`) para los diagnósticos DRAFT sin paquete. Los nuevos diagnósticos lo fijan al crearse.
- `PackageInstrument` referencia `(instrumentVersionId, perspectiveCode)`, así MySQL impide asignar a una perspectiva el instrumento de otra.
- Un diagnóstico sin paquete no puede iniciar cuestionarios (503). Una sesión antigua de la encuesta técnica, sin instrumento, responde 410.
- Se eliminaron la encuesta técnica, el campo `required` y la regla de preguntas obligatorias: ninguna pregunta es obligatoria (GAP-004).
- Las pruebas de Phase 3A recorren ahora el instrumento ESP real.
