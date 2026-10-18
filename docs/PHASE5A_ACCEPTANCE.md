# Phase 5A — registro de aceptación S12

Generado por `npm run test:acceptance` (runner automatizado). No editar a mano: volver a ejecutar el script.

| Campo | Valor |
|---|---|
| Fecha de ejecución (UTC) | 2026-10-18T01:13:46.973Z |
| Versión del motor | 1.0.0 |
| Commit | 15d62dc (con cambios locales) |
| Matriz | Matriz_Casos_Prueba_Resultados_Esperados_IEO_v1.0.xlsx |
| SHA-256 de la matriz | `ef5f19bbb3e53d7fa0e0b47823a0742cfe86bf32988e494868bcd33c28d1f9ce` |
| Casos críticos | 23 PASS / 23 (0 FAIL) |
| Fronteras de salud (08_GLOBAL A9:C21) | 13 PASS / 13 |

Comparación: valor con tolerancia < 0.000001 (la de S12), además de estado, clase y nulidad. T05 se compara también por nulidad y T19 por estado LIMITED, que el comparador del Excel no verifica (GAP-013).

Políticas aplicadas:

- **model:** Modelo Matemático Oficial IEO 1.1
- **coverage:** GAP-004/GAP-006 2026-10-14: ≥60 % válidos por Elemento, N/A fuera del denominador, todo N/A = ND
- **rounding:** GAP-007 2026-10-16/17: entero sólo al final, .5 exacto baja; clasificación con el entero (BT provisional)
- **partialResults:** GAP-008 provisional 2026-10-17
- **quality:** GAP-009 provisional 2026-10-17: dictamen C → RP ND (QUALITY_C)

## Casos críticos (T01–T22 y T06N)

| Caso | Capa | Nombre | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| T01 | Reactivo | Directo mínimo | recoded=1, score=0, is_na=false, VALID | recoded=1, score=0, is_na=false, VALID | **PASS** |
| T02 | Reactivo | Directo máximo | recoded=5, score=100, is_na=false, VALID | recoded=5, score=100, is_na=false, VALID | **PASS** |
| T03 | Reactivo | Inverso mínimo | recoded=5, score=100, is_na=false, VALID | recoded=5, score=100, is_na=false, VALID | **PASS** |
| T04 | Reactivo | Inverso máximo | recoded=1, score=0, is_na=false, VALID | recoded=1, score=0, is_na=false, VALID | **PASS** |
| T05 | Reactivo | N/A | recoded=NULL, score=NULL, is_na=true, EXCLUDED | recoded=NULL, score=NULL, is_na=true, EXCLUDED | **PASS** |
| T06 | Cobertura | Umbral exacto 60% | aplicables=10, cobertura=0.6, SUFFICIENT, PI VALID | aplicables=10, cobertura=0.6, SUFFICIENT, PI VALID | **PASS** |
| T06N | Cobertura | N/A fuera del denominador | aplicables=6, cobertura=1, SUFFICIENT, PI VALID | aplicables=6, cobertura=1, SUFFICIENT, PI VALID | **PASS** |
| T07 | Cobertura | Debajo de 60% | aplicables=10, cobertura=0.5, INSUFFICIENT, PI ND | aplicables=10, cobertura=0.5, INSUFFICIENT, PI ND | **PASS** |
| T08 | PI | Promedio completo | PI=50, VALID | PI=50, VALID | **PASS** |
| T09 | PI | PI con N/A | PI=50, VALID | PI=50, VALID | **PASS** |
| T10 | RP | Promedio de PI | RP=60, VALID | RP=60, VALID | **PASS** |
| T11 | RP | RP con ND | RP=60, VALID | RP=60, VALID | **PASS** |
| T12 | BT | BT=12 | BT=12, HIGH_CONVERGENCE | BT=12, HIGH_CONVERGENCE, max=ESP, min=COL | **PASS** |
| T13 | BT | BT=13 | BT=13, MODERATE_DIFFERENCE | BT=13, MODERATE_DIFFERENCE, max=ESP, min=COL | **PASS** |
| T14 | BT | BT=24 | BT=24, MODERATE_DIFFERENCE | BT=24, MODERATE_DIFFERENCE, max=DIR, min=COL | **PASS** |
| T15 | BT | BT=25 | BT=25, RELEVANT_GAP | BT=25, RELEVANT_GAP, max=DIR, min=COL | **PASS** |
| T16 | BT | BT=37 | BT=37, RELEVANT_GAP | BT=37, RELEVANT_GAP, max=DIR, min=COL | **PASS** |
| T17 | BT | BT=38 | BT=38, CRITICAL_GAP | BT=38, CRITICAL_GAP, max=DIR, min=COL | **PASS** |
| T18 | RI | Pesos iguales | RI=75, INTEGRATED | RI=75, INTEGRATED | **PASS** |
| T19 | RI | Una sola perspectiva | RI=80, LIMITED | RI=80, LIMITED | **PASS** |
| T20 | Global | IEO Global completo | Global=77.5, Estable con riesgos, YELLOW | Global=77.5 (entero 77), Estable con riesgos, YELLOW | **PASS** |
| T21 | Precisión | Sin redondeo intermedio | Global=80.512371615325, Saludable, LIGHT_GREEN | Global=80.512371615325 (entero 81), Saludable, LIGHT_GREEN | **PASS** |
| T22 | End-to-End | Triangulación de un Elemento | RP=85/75/70/65/95; BT=30 RELEVANT_GAP; RI=78 INTEGRATED | BT=30 RELEVANT_GAP (INTEGRATED, max CLI, min COL); RI=78 INTEGRATED | **PASS** |

## Fronteras de nivel de salud y semáforo

| Caso | Capa | Nombre | Esperado | Obtenido | Resultado |
|---|---|---|---|---|---|
| B49 | Frontera de salud | 08_GLOBAL fila 9 | Crítico, RED | Crítico, RED | **PASS** |
| B50 | Frontera de salud | 08_GLOBAL fila 10 | Erosión importante, RED | Erosión importante, RED | **PASS** |
| B59 | Frontera de salud | 08_GLOBAL fila 11 | Erosión importante, RED | Erosión importante, RED | **PASS** |
| B60 | Frontera de salud | 08_GLOBAL fila 12 | En erosión, ORANGE | En erosión, ORANGE | **PASS** |
| B69 | Frontera de salud | 08_GLOBAL fila 13 | En erosión, ORANGE | En erosión, ORANGE | **PASS** |
| B70 | Frontera de salud | 08_GLOBAL fila 14 | Estable con riesgos, YELLOW | Estable con riesgos, YELLOW | **PASS** |
| B79 | Frontera de salud | 08_GLOBAL fila 15 | Estable con riesgos, YELLOW | Estable con riesgos, YELLOW | **PASS** |
| B80 | Frontera de salud | 08_GLOBAL fila 16 | Saludable, LIGHT_GREEN | Saludable, LIGHT_GREEN | **PASS** |
| B89 | Frontera de salud | 08_GLOBAL fila 17 | Saludable, LIGHT_GREEN | Saludable, LIGHT_GREEN | **PASS** |
| B90 | Frontera de salud | 08_GLOBAL fila 18 | Muy saludable, DARK_GREEN | Muy saludable, DARK_GREEN | **PASS** |
| B94 | Frontera de salud | 08_GLOBAL fila 19 | Muy saludable, DARK_GREEN | Muy saludable, DARK_GREEN | **PASS** |
| B95 | Frontera de salud | 08_GLOBAL fila 20 | Ejemplar, DARK_GREEN | Ejemplar, DARK_GREEN | **PASS** |
| B100 | Frontera de salud | 08_GLOBAL fila 21 | Ejemplar, DARK_GREEN | Ejemplar, DARK_GREEN | **PASS** |
