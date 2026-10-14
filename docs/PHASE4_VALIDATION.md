# Phase 4 — validación técnica

Fecha: 2026-10-14. Alcance: los cinco cuestionarios oficiales v1.0 y el paquete metodológico IEO 1.0, según [PHASE4_DECISIONS.md](PHASE4_DECISIONS.md). Captura sólo con datos ficticios (`isTest=true`): el catálogo no está certificado (GAP-001) y falta la política de aviso y retención (GAP-012). No hay cómputo IEO®, cierre ni resultados.

## Resultado

| Comprobación | Evidencia |
|---|---|
| Prisma generate / migrate deploy / seed | Migración `20261014180000_phase4_methodology_package` aplicada en MySQL 8.4.10 sobre `ieo_dev` e `ieo_test`; `migrate diff` sin diferencias; `db:catalog` idempotente |
| Lint / typecheck / build | PASS con Node 24.21.0, TypeScript estricto y Webpack |
| Unit | 63 PASS |
| Integration MySQL | 67 PASS, 8 nuevas de Phase 4 |
| Playwright Chromium | 47 PASS, 3 nuevas de Phase 4; las de Phase 3A recorren ahora ESP |
| Originales | 12 de 12 SHA-256 coinciden con `ARCHITECTURE.md` |

## Catálogos

| Instrumento | Por Elemento E01–E08 | Total | Abiertas | N/A | Inversos |
|---|---|---:|---|---|---:|
| IEO-DIR-01 | 9,11,10,10,10,8,8,9 | 75 | 0 | No | 0 |
| IEO-ESP-01 | 8,10,8,8,9,8,8,9 | 68 | 8 por Elemento | Sí | 0 |
| IEO-LID-01 | 8,11,8,9,9,8,8,9 | 70 | 8 por Elemento | Sí | 0 |
| IEO-COL-01 | 9,9,9,10,9,9,9,9 | 73 | 8 por Elemento | Sí | 8 |
| IEO-CLI-01 | 5,6,4,5,5,6,7,5 | 43 | 4 generales, sin Elemento | Sí | 0 |

Total: 329 cuantitativos y 28 abiertas. Las pruebas comparan cada catálogo con la tabla de inventario de Phase 0 (no con el generador) y con los SHA-256 de S05 y S07–S11. Cada JSON se reproduce exactamente desde las fuentes; el de COL no cambió respecto a Phase 3B. La única diferencia de texto entre Excel y Word sigue siendo COL_E04_R028 (GAP-003). Una importación con el archivo equivocado bajo el nombre de un instrumento falla.

## Reglas verificadas

- Cada perspectiva recibe el instrumento de su diagnóstico dentro del paquete y puede enviar con el mínimo por Elemento.
- DIR no muestra N/A y el servidor lo rechaza (400) aunque se envíe a mano.
- CLI: 2 de 4 en Elemento III bloquea el envío y 3 de 4 lo permite; sus 4 abiertas generales aparecen en una pantalla propia y son opcionales.
- MySQL rechaza un `PackageInstrument` cuyo instrumento pertenece a otra perspectiva.
- Un diagnóstico sin paquete no inicia cuestionarios (503); una sesión técnica antigua responde 410.
- Diagnósticos nuevos y existentes quedan fijados al paquete IEO 1.0.

## Límites

- Sigue prohibido usarlo con participantes reales (GAP-001, GAP-012).
- Sin historial de revisiones por respuesta (Phase 5), cierre, motor, resultados ni exportaciones.
- No se probó SMTP real ni el proxy productivo.
