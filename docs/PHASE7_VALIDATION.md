# Phase 7 — validación técnica

Fecha: 2026-10-18. Alcance: exportaciones EXP01–EXP04, permisos excepcionales (GAP-011, regla provisional), auditoría de lecturas y descargas, endurecimiento y respaldo/restauración, según [PHASE7_DECISIONS.md](PHASE7_DECISIONS.md). Datos sólo de prueba (GAP-012).

## Resultado

| Comprobación | Evidencia |
|---|---|
| Prisma generate / migrate deploy | Migración `20261019120000_phase7_exports_grants` aplicada en MySQL 8.4.10 sobre `ieo_dev` e `ieo_test`; `migrate diff` sin diferencias |
| Lint / typecheck / build | PASS con Node 24.21.0 |
| Unit | 135 PASS (6 nuevas de CSV, ZIP y supresión) |
| Integration MySQL | 95 PASS (9 nuevas de exportaciones, permisos e historial) |
| Playwright Chromium | 62 PASS (4 nuevas: descargas, permiso aprobado por el custodio, texto hostil, origen y caché) |
| Aceptación S12 | 23/23 casos críticos y 13/13 fronteras PASS |
| Originales | 12 de 12 SHA-256 sin cambios |

## Verificado

- **EXP04**: manifiesto con el SHA-256 de cada archivo, los 329 reactivos y las reglas del motor; queda en `ExportRecord` y en la auditoría. Coordinador, consultor de otra organización y custodio no pueden exportar.
- **EXP03 de reporte**: exige run publicable y revisión de divulgación de todas las perspectivas aplicadas. Con Dirección no reportable, sus RP, todos los RI y BT en que participa y el Global quedan `SUPRIMIDO_POR_DIVULGACION`; Colaboradores sigue visible. Sin PI, sin IDs de sesión ni correos.
- **EXP02 de reporte**: sólo respuestas aptas o redactadas, sin columna de participante. Cada lectura de abiertas en pantalla queda auditada con el número de respuestas.
- **Permisos**: el consultor solicita y no puede aprobar; el custodio aprueba; nadie aprueba su propia solicitud (también CHECK de MySQL); más de 30 días se rechaza. Sin permiso, EXP01, EXP03 técnico y EXP02 completo devuelven 403; un permiso vencido o revocado deja de funcionar de inmediato.
- **EXP01** con permiso: 296 filas (2 × 73 + 2 × 75), seudónimos `P0001`–`P0004` propios de la descarga, respuesta original sin recodificar y fecha por día.
- **Fórmulas**: una abierta `=HYPERLINK(...)` sale como `'=HYPERLINK(...)`.
- **Seguridad**: texto abierto con `<img onerror>` y `<script>` se muestra como texto y no abre ningún diálogo; las mutaciones nuevas rechazan un origen ajeno (403); `/api` responde `no-store`; las páginas llevan CSP `default-src 'self'`.
- **Historial**: `verify:history` reproduce todos los runs y detecta una copia congelada alterada.

## Simulacro de respaldo y restauración (2026-10-18)

1. `verify:history` sobre `ieo_test` tras la suite E2E: 2 copias congeladas y 2 procesamientos, «OK».
2. `scripts/backup.sh ieo_test`: archivo de 105,680 bytes cifrado (cabecera `Salted__` de OpenSSL) con su `.sha256`.
3. `scripts/restore.sh` en la base nueva `ieo_restore`: checksum verificado, restauración completa, `prisma migrate status` «Database schema is up to date» (8 migraciones).
4. `verify:history` sobre `ieo_restore`: 2 copias y 2 procesamientos reproducidos exactamente.
5. Restaurar con una frase incorrecta falla. La base temporal se eliminó después.

## Límites

- GAP-011 sigue siendo una regla provisional hasta que Marco la confirme o designe a otro custodio.
- No hay rotación automática de `PARTICIPANT_ENCRYPTION_KEY` (documentada como pendiente en [OPERATIONS.md](OPERATIONS.md)).
- RPO/RTO, retención y ubicación de respaldos se definen con el cliente; no hay participantes reales (GAP-012).
