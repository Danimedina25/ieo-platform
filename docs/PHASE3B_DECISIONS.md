# Phase 3B — decisiones previas al código

Estado: **propuesta, pendiente de aprobación**. Phase 3A está terminada y GAP-003/004/005/006/014 tienen resolución registrada en [METHODOLOGY_GAPS.md](METHODOLOGY_GAPS.md). Phase 3B sustituye la encuesta sintética por el instrumento **IEO-COL-01 v1.0** en la perspectiva COL, y sigue siendo una prueba con datos ficticios mientras GAP-012 (aviso y retención) siga abierto.

## Alcance

- Catálogo de COL en base de datos: 73 reactivos cuantitativos y 8 abiertas, en su orden oficial, con sus 8 secciones de Elemento.
- El participante con invitación a la perspectiva COL recibe IEO-COL-01. Las demás perspectivas siguen recibiendo `TECH-SURVEY-01` hasta Phase 4.
- Validación de envío: cobertura ≥ 60 % en **cada** Elemento (GAP-004), con N/A fuera del denominador y Elemento todo N/A permitido (GAP-006).
- Avance visible por Elemento y pantalla de revisión antes del envío.
- Sigue igual: `isTest=true`, diagnóstico en DRAFT, correos sintéticos/equipo y aviso de prueba visible.

Fuera de alcance: DIR/ESP/LID/CLI, estados OPEN/CLOSED/FROZEN, motor matemático, recodificación de inversos, resultados, exportaciones y participantes reales.

## Catálogo y carga de fuentes

Tablas nuevas: `InstrumentVersion`, `InstrumentSection`, `QuestionVersion` e `InstrumentScaleOption`, más el enum `ElementCode` (E01–E08). `MethodologyPackage`/`PackageInstrument` se difieren a Phase 4, cuando existan los cinco instrumentos.

Las fuentes se convierten una sola vez en un archivo versionado `ieo-col-01-v1.0.json` mediante un script reproducible:

| Dato | Fuente |
|---|---|
| Códigos, Elemento, orden, orientación, N/A permitido, abiertas | Excel S05, hojas `04_REACTIVOS` y `05_ABIERTAS` |
| Texto de reactivos | Excel S05, salvo COL_E04_R028 que toma el Word: «mi líder inmediato» (GAP-003) |
| Presentación, objetivo, confidencialidad, instrucciones, escala, introducción de cada Elemento, agradecimiento | Word `IEO_Colaboradores_Version_Oficial_1.0.docx` |

El JSON guarda el SHA-256 de ambas fuentes y un `contentHash` propio. El seed lo carga de forma idempotente; una versión publicada no se modifica. Como GAP-001 sigue abierto, la versión queda marcada como **no certificada** y sólo puede servirse a sesiones `isTest=true`.

## Respuestas

- `ResponseSession` agrega `instrumentVersionId` (nulo para `TECH-SURVEY-01`). `SurveyResponse` agrega `questionVersionId`, con FK compuesta que impide responder preguntas de otro instrumento.
- Se guarda el valor original 1–5, `NA` o `MISSING`. Los 8 inversos se guardan sin recodificar y su orientación no se envía al navegador.
- DIR no aplica aquí; COL permite N/A en todos sus reactivos.
- Se conserva el guardado actual (valor vigente por pregunta + revisión optimista). El historial de revisiones por respuesta propuesto en `DATA_MODEL.md` se difiere a Phase 5, donde el snapshot congelado es la frontera formal.

## Regla de cobertura

Función pura en `src/domain/survey/coverage.ts`, usada por servidor y navegador:

```
aplicables = reactivos del Elemento − N/A
válidos    = reactivos con valor 1–5
cumple     = aplicables = 0 (todo N/A → ND, permitido)  o  válidos × 5 ≥ aplicables × 3
```

La comparación entera evita errores de punto flotante en la frontera exacta del 60 %. El servidor la vuelve a evaluar al enviar; si falla responde 422 con la lista de Elementos por debajo del umbral, nunca con contenido de respuestas. Las abiertas no participan.

## Experiencia del participante

1. Introducción oficial de COL con el aviso **PRUEBA — USE DATOS FICTICIOS**. Su aceptación registra versión y hash del contenido; no constituye consentimiento oficial (GAP-012).
2. Un Elemento por pantalla, en orden oficial: introducción del Elemento, sus reactivos y su pregunta abierta. Guardado automático como en Phase 3A.
3. Barra de avance con los 8 Elementos y su estado: completo, cumple, por debajo del 60 % o todo N/A.
4. Pantalla de revisión: si algún Elemento no cumple, se indica cuál y se ofrece volver a él; el botón Enviar queda inactivo.
5. Tras enviar, sólo el agradecimiento oficial de COL.

## Pruebas y definición de terminado

- Unit: catálogo con 73 + 8 en orden, códigos únicos, distribución 9,9,9,10,9,9,9,9, ocho inversos exactos, R028 con «líder», ningún texto distinto a las fuentes; cobertura en 60 % exacto, 59.x %, mezcla N/A + vacías, todo N/A, un solo Elemento fallando.
- Integración MySQL: FK impide mezclar instrumentos, envío rechazado/aceptado según cobertura, inversos guardados crudos, orientación ausente del DTO, sesiones `isTest=false` rechazadas.
- Playwright: recorrido COL completo en móvil 390×844 y escritorio, envío bloqueado y desbloqueado, reanudación, Elemento todo N/A enviado.
- Las suites de Phase 1–3A siguen pasando; los 12 originales conservan su SHA-256.
