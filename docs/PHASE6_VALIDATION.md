# Phase 6 — validación técnica

Fecha: 2026-10-18. Alcance: resultados y triangulación según [PHASE6_DECISIONS.md](PHASE6_DECISIONS.md). Datos sólo de prueba (`isTest=true`; GAP-012 abierto). Patrones registrados por el consultor, sin sugerencia automática (GAP-002).

## Resultado

| Comprobación | Evidencia |
|---|---|
| Prisma generate / migrate deploy | Migración `20261018180000_phase6_results_review` aplicada en MySQL 8.4.10 sobre `ieo_dev` e `ieo_test`; `migrate diff` sin diferencias |
| Lint / typecheck / build | PASS con Node 24.21.0 |
| Unit | 129 PASS (5 nuevas de formato, divulgación y validaciones) |
| Integration MySQL | 86 PASS (7 nuevas de resultados) |
| Playwright Chromium | 58 PASS (6 nuevas: recorrido de resultados en escritorio y 390×844) |
| Aceptación S12 | 23/23 casos críticos y 13/13 fronteras PASS |
| Originales | 12 de 12 SHA-256 coinciden con `ARCHITECTURE.md` |

Una corrida completa intermedia mostró un fallo en E2E-P3B-07 que tardó 15 minutos (el guardado automático no se disparó durante una suspensión del equipo); el spec aislado y la suite completa repetida pasaron sin cambios de código.

## Verificado

- Sólo el consultor de la organización lee resultados y respuestas abiertas; el coordinador y un consultor de otra organización no.
- La respuesta de resultados no contiene identificadores de sesión, correos ni PI individuales. Valores verificados a mano: RP COL 50 (el cuestionario excluido no entra), RP DIR 75, RI 62.5, BT 25 parcial «Brecha relevante», Global 62 «En erosión» naranja; ESP como NP.
- Presentación: RP y RI con un decimal y BT y Global enteros, con .5 exacto hacia abajo (62.45 → 62.4; 79.5 → 79).
- Las respuestas abiertas provienen sólo de sesiones de la copia congelada: no aparecen borradores ni excluidos, ni pueden revisarse. Redactar una cita conserva el original intacto y guarda la versión redactada cifrada.
- Los patrones exigen justificación y conservan su historial; el coordinador no puede registrarlos.
- Marcar Dirección como no reportable muestra las advertencias de pocas personas y de deducción por RI/BT, y no cambia RI, BT ni Global. La divulgación de una perspectiva no aplicada se rechaza.
- Un run nuevo empieza sin patrones ni decisiones de divulgación; los runs anteriores siguen consultables como históricos.

## Límites

- Sin reporte diagnóstico automático (falta la Plantilla Oficial, GAP-002), sin exportaciones (Phase 7) y sin cortes por segmento (la captura no registra el segmento del participante).
- Las advertencias de divulgación orientan al consultor; la aplicación obligatoria de las decisiones a reportes y exportaciones corresponde a Phase 7.
- Reglas de GAP-007 (BT), 008, 009 y 010 provisionales hasta la confirmación de Marco.
