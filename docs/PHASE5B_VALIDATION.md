# Phase 5B — validación técnica

Fecha: 2026-10-18. Alcance: ciclo de vida del diagnóstico, cierre documentado, congelamiento y procesamiento con el motor de 5A, según [PHASE5B_DECISIONS.md](PHASE5B_DECISIONS.md). Datos sólo de prueba (`isTest=true`; GAP-012 abierto). Reglas de dictamen y exclusión provisionales (GAP-009/010, 2026-10-17).

## Resultado

| Comprobación | Evidencia |
|---|---|
| Prisma generate / migrate deploy / seed | Migración `20261018120000_phase5b_closure_processing` aplicada en MySQL 8.4.10 sobre `ieo_dev` e `ieo_test`; `migrate diff` sin diferencias; seed idempotente |
| Lint / typecheck / build | PASS con Node 24.21.0 |
| Unit | 124 PASS (7 nuevas de cierre) |
| Integration MySQL | 79 PASS (12 nuevas del ciclo completo) |
| Playwright Chromium | 52 PASS (5 nuevas del recorrido del consultor) |
| Aceptación S12 | 23/23 casos críticos y 13/13 fronteras PASS (sin cambios en el motor) |
| Originales | 12 de 12 SHA-256 coinciden con `ARCHITECTURE.md` |

## Verificado en integración (MySQL real)

- Abrir exige las cinco perspectivas clasificadas y al menos una aplicable. El coordinador y un consultor de otra organización no pueden operar el ciclo ni leer el cierre.
- Una invitación creada en DRAFT no se envía; al abrir se envía. Sólo se responde en OPEN, y nunca después de `plannedClosesAt`.
- Al cerrar se calcula la participación (invitados, enviados, borradores, excluidos). Sólo se excluyen cuestionarios enviados; la exclusión se revoca y se vuelve a registrar.
- Congelar exige checklist completo, dictamen global y uno por perspectiva aplicable. La copia congelada tiene el hash declarado, contiene sólo enviados no excluidos y no incluye correos, invitaciones ni texto abierto. El acta tiene su hash y clasifica perspectivas válidas, con reservas, ND y NP.
- Procesar produce el mismo hash que el motor ejecutado directamente sobre la copia. Resultados verificados a mano: RP COL = 50 (el excluido no entra), RP DIR = 75, RI = 62.5 INTEGRATED, BT = 25 PARTIAL RELEVANT_GAP, Global = 62.5 → 62 «En erosión» naranja. Reprocesar crea otro run con el mismo hash de salida y conserva el anterior.
- Reabrir exige motivo, crea la revisión 2 y conserva la copia, el acta y los runs de la revisión 1.
- Dictamen C: la perspectiva queda ND con motivo QUALITY_C y sale de RI y BT; con una sola perspectiva válida el Global queda ND; un dictamen C global marca el run como no publicable.

## Límites

- Sin pantallas de resultados ni revisión de divulgación (Phase 6), sin exportaciones (Phase 7), sin cierre automático por calendario y sin estado ARCHIVED.
- Las reglas de GAP-008/009/010 siguen provisionales hasta la confirmación de Marco.
- No se usa con participantes reales (GAP-001, GAP-012).
