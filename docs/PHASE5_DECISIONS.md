# Phase 5 — decisiones previas al código

Estado: **aprobada el 2026-10-17** (5A). Las reglas de GAP-007/008/009/010 se adoptaron provisionalmente ese día, pendientes de confirmación de Marco ([METHODOLOGY_GAPS.md](METHODOLOGY_GAPS.md)). Phase 4 está terminada ([PHASE4_VALIDATION.md](PHASE4_VALIDATION.md)). Phase 5 del [plan](IMPLEMENTATION_PLAN.md) une dos trabajos con dependencias distintas, por lo que se propone dividirla:

| Parte | Contenido | ¿Bloqueada? |
|---|---|---|
| **5A — Motor matemático** | Funciones puras del Modelo Matemático 1.1 y aceptación con los 23 casos oficiales de S12 | No. Las fórmulas están definidas; lo no definido se marca como pendiente, nunca se inventa |
| **5B — Cierre y procesamiento** | Estados OPEN→CLOSED→FROZEN→PROCESSED, checklist, acta, dictamen, exclusiones, snapshot, ejecución del motor y tablas de resultados | Sí, en parte: GAP-009 (dictamen) y GAP-010 (exclusiones y reapertura). Se diseñará cuando Marco responda |

Este documento detalla 5A. 5B tendrá su propio documento de decisiones.

## 5A — Alcance

Módulo `src/domain/ieo-engine`, independiente de Next.js, Prisma y MySQL. Recibe datos ya validados y devuelve resultados con su linaje. No lee la base de datos, no guarda resultados y no tiene pantallas: eso es 5B y Phase 6.

## Entrada y salida

**Entrada:** las preguntas cuantitativas de cada instrumento (código, Elemento, orientación, N/A permitido), las sesiones enviadas con su perspectiva y respuestas crudas (1–5, NA u omitida), y el estado de alcance de cada perspectiva (aplicable, no aplicable o no disponible). Nunca recibe correos, tokens ni texto abierto.

**Salida, por etapa:**

| Etapa | Regla | Casos S12 |
|---|---|---|
| Validar | Sólo 1–5 o NA donde se permite; preguntas del instrumento correcto; omitidas explícitas | — |
| Recodificar | Directo = x; inverso = 6 − x; el valor original no se modifica | T01–T04 |
| Excluir N/A | Fuera de numerador y denominador; derivados en NULL | T05, T09 |
| Cobertura | válidos / (total − N/A) ≥ 60 % → suficiente; si no, PI = ND; todo N/A → ND sin cobertura | T06, T06N, T07 |
| Convertir | 25 × (x − 1) | T01–T04 |
| PI | Promedio de puntajes válidos de una persona en un Elemento | T08, T09 |
| RP | Promedio de PI válidas por perspectiva y Elemento; ND fuera; perspectiva no aplicada = NP | T10, T11 |
| BT | RP máximo − RP mínimo; 2 perspectivas = parcial, 3 o más = integrada, 1 = no calculable | T12–T17 |
| RI | Promedio simple de RP; 2 o más = INTEGRATED, 1 = LIMITED con su valor, 0 = ND | T18, T19 |
| IEO por perspectiva | Promedio de sus 8 RP, sólo si los 8 son válidos | — |
| IEO Global | Promedio de los 8 RI, sólo si los 8 son INTEGRATED | T20, T21 |
| Integral | Un Elemento de PI a RI y BT | T22 |

## Precisión

Aritmética racional exacta (numerador y denominador enteros) en todas las etapas: nunca se redondea un valor intermedio (T21). La salida incluye la fracción exacta y una proyección decimal. El mismo input y la misma versión del motor producen el mismo resultado y el mismo hash SHA-256.

## Reglas provisionales incorporadas al motor

| Caso | Comportamiento | GAP |
|---|---|---|
| Clasificación de Global, nivel de salud, semáforo y BT | Se redondea al entero sólo al final; .5 exacto baja (79.5 → 79, 79.6 → 80); la clase se asigna con el entero | GAP-007 |
| Global | COMPLETE con 8 RI INTEGRATED; LIMITED con valor si los 8 tienen RI y alguno es LIMITED (con al menos uno integrado); ND si falta algún RI o ninguno está integrado | GAP-008 |
| IEO por perspectiva | Sólo con sus 8 RP válidos; si no, ND | GAP-008 |
| Dictamen C de una perspectiva (o de una perspectiva en un Elemento) | Su RP queda ND con motivo QUALITY_C y no entra a BT, RI ni Global | GAP-009 |
| Dictamen C global y publicación | Fuera del motor: lo decide 5B | GAP-009 |

Cada salida registra la versión de estas políticas para que un cambio de Marco produzca una versión nueva, sin reescribir resultados anteriores.

## Aceptación

- Los 23 casos (T01–T22 y T06N) se leen **directamente del Excel oficial S12**, no se copian a mano, y se ejecutan contra el motor. Se compara valor (tolerancia < 0.000001, como S12), estado, clasificación y nulidad.
- Un script genera el registro de aceptación con los resultados reales de la ejecución (entrada, esperado, obtenido, versión del motor, fecha), equivalente a la hoja `10_ACEPTACION`. Un PASS sólo existe si el motor lo produjo.
- T05 se compara también por nulidad y T19 por estado LIMITED, donde el comparador del Excel no lo hace (GAP-013).
- Casos adicionales: fronteras de salud de `08_GLOBAL`, todo N/A, cero sesiones, una a cinco perspectivas, NP frente a ND, empates de máximo y mínimo, inversos de COL con N/A, y determinismo del hash.

## Fuera de alcance de 5A

Cierre, acta, dictamen, exclusiones, snapshot, ejecución sobre datos guardados, tablas de resultados, pantallas, patrones de triangulación y exportaciones.

## Cierre de implementación de 5A

- Módulo `src/domain/ieo-engine`: `rational.ts` (fracciones exactas con BigInt y redondeo final con .5 hacia abajo), `classify.ts` (salud, semáforo, clase BT), `stages.ts` (etapas puras), `run.ts` (orquestador con linaje, versión de políticas y hashes) y `from-catalog.ts` (vista del motor de un instrumento; las abiertas nunca entran).
- `src/infrastructure/acceptance/s12.ts` lee la matriz S12 y ejecuta sus casos; `npm run test:acceptance` escribe [PHASE5A_ACCEPTANCE.md](PHASE5A_ACCEPTANCE.md). Resultado: 23 de 23 casos críticos y 13 de 13 fronteras PASS.
- Pruebas: 117 unitarias (incluye S12 y 13 escenarios completos sobre los cinco instrumentos reales: inversos de COL, N/A, omisiones, todo N/A, NP frente a ND, dictamen C, Global LIMITED y ND, diagnóstico de una sola perspectiva, empates, determinismo y entradas inválidas); integración y E2E de fases previas sin cambios (67 y 47 PASS).
- El hash de entrada se calcula sobre un orden normalizado: los mismos datos en otro orden producen el mismo resultado y el mismo hash.
- Para un diagnóstico de una sola perspectiva el Global queda ND con motivo `NO_INTEGRATED_ELEMENT` y se reporta el IEO de esa perspectiva.
- Pendiente para 5B: cierre, acta, dictamen, exclusiones, snapshot, ejecución sobre datos guardados y tablas de resultados.
