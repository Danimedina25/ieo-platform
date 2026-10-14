# Phase 3B — validación técnica

Fecha: 2026-10-14. Alcance: captura del cuestionario **IEO-COL-01 v1.0** con datos ficticios, según [PHASE3B_DECISIONS.md](PHASE3B_DECISIONS.md). El catálogo está marcado como **no certificado** (GAP-001) y sólo se sirve a sesiones `isTest=true`. No hay cómputo IEO®, cierre ni resultados.

## Resultado

| Comprobación | Evidencia |
|---|---|
| Prisma generate / migrate deploy / seed | Migración `20261014120000_phase3b_col_instrument` aplicada en MySQL 8.4.10 (Docker Compose) sobre `ieo_dev` e `ieo_test` creadas desde cero; `migrate diff` sin diferencias; seed y `db:catalog` idempotentes |
| Lint / typecheck / build | PASS con Node 24.21.0, TypeScript estricto y Webpack |
| Unit | 48 PASS: 29 previas, 19 nuevas de catálogo y cobertura |
| Integration MySQL | 59 PASS: 49 previas, 10 nuevas de COL |
| Playwright Chromium | 44 PASS: 35 previas, 9 nuevas de COL (390×844 y 1280×900) |
| Originales | 12 de 12 SHA-256 coinciden con `ARCHITECTURE.md`; ningún DOCX/XLSX modificado |

## Catálogo

- 73 reactivos cuantitativos y 8 abiertas; distribución 9, 9, 9, 10, 9, 9, 9, 9; orden oficial 1–73 y orden de pantalla 1–81 con la abierta al final de cada Elemento.
- Inversos exactos: COL_E01_R009, E02_R018, E03_R027, E04_R037, E05_R046, E06_R055, E07_R064 y E08_R073. Su orientación vive en `QuestionVersion` y nunca llega al navegador.
- 72 de 73 textos del Excel coinciden con el Word; COL_E04_R028 usa «mi líder inmediato» y la diferencia con «jefe» queda en `correctionsJson` (GAP-003).
- El JSON versionado se reproduce exactamente desde las fuentes (prueba unitaria) y sus hashes de origen coinciden con el inventario de Phase 0.

## Regla de envío verificada

Unit cubre 60 % exacto (6/10, T06), N/A fuera del denominador (T06N), 50 % (T07), 10/17 = 58.8 %, mezcla N/A + vacías, Elemento todo N/A permitido, un solo Elemento bloqueando, abiertas ignoradas y el mínimo real de COL. Integración comprueba el 422 con los Elementos nombrados, el envío con Elemento VIII todo N/A y sin abiertas, auditoría `IEO-COL-01`/`1.0`, y que no se puede escribir después del envío.

## Seguridad e integridad

- Las respuestas COL guardan `instrumentVersionId` y `questionVersionId`. MySQL rechaza una respuesta ligada a un instrumento distinto del de su sesión, un par catálogo incompleto y un reactivo cuantitativo sin orientación.
- Claves técnicas, valores fuera de escala y N/A en abiertas devuelven 400. El texto abierto se cifra igual que en Phase 3A.
- Las invitaciones de otras perspectivas siguen recibiendo `TECH-SURVEY-01`.

## Límites

- Sigue prohibido usarlo con participantes reales: falta la política de aviso y retención (GAP-012) y la certificación del catálogo (GAP-001).
- No se implementó historial de revisiones por respuesta (diferido a Phase 5) ni `MethodologyPackage` (Phase 4).
- No se probó SMTP real ni el proxy productivo; siguen pendientes en `INFRASTRUCTURE_REQUIREMENTS.md`.
