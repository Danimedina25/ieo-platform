# Phase 2 — Validación ejecutada

Fecha: 2026-09-25. Entorno de validación: Node 24.21.0, Next.js 16.3.6 con Webpack, Prisma 7.10.0, MySQL Community 8.4.10 real en localhost:3307, Chromium de Playwright. Datos sintéticos, base `ieo_test` separada de `ieo_dev`. Phase 3 no iniciada.

| Gate solicitado | Resultado ejecutado |
|---|---|
| `npm install --offline` | PASS; 0 vulnerabilidades conocidas reportadas, lockfile sin actualización de versiones |
| `npm run db:generate` | PASS; cliente Prisma generado |
| `npm run db:migrate -- --name phase2_diagnosis_workspace --create-only` | PASS; SQL revisado y completado con backfill/CHECK/InnoDB antes de aplicar |
| `npm run db:migrate:deploy` | PASS desde esquema Phase 1 en `ieo_dev`; repetición sin pendientes |
| `npm run db:seed` | PASS; 4 usuarios, 2 organizaciones, 2 diagnósticos y 10 perspectivas demo |
| `npm run lint` | PASS; sin warnings |
| `npm run typecheck` | PASS; TypeScript strict |
| `npm test` | PASS; 16 pruebas unitarias (Phase 1 + Phase 2) |
| `npm run test:db:prepare` | PASS; migra, valida destino y reinicia sólo datos de `ieo_test` |
| `npm run test:integration` | PASS; 21 pruebas MySQL 8 (Phase 1 + Phase 2) |
| `npm run build` | PASS; build de producción Webpack |
| `npm run test:e2e` | PASS; 19 pruebas Chromium (9 Phase 1 + 10 Phase 2) |
| Hashes de fuentes oficiales | PASS; 12 DOCX/XLSX idénticos a inventario Phase 0 |

## Cobertura verificada

- Creación en organización existente produce un Assessment y exactamente cinco AssessmentPerspective. Nueva organización, membresía, diagnóstico, cinco filas y auditoría se ejecutan transaccionalmente; rollback sintético no deja organización a medias.
- Consultor de A no crea ni edita en B. Coordinador puede leer General/Perspectivas, pero no crear ni modificar; el backend rechaza POST directo. TECH_ADMIN sin membresía ve sólo metadata. Con membresía explícita IEO_CONSULTANT sí puede configurar la organización correspondiente.
- General valida responsables activos del rol y organización correctos; fechas UTC sobreviven persistencia y el cierre debe ser posterior a la apertura.
- DIR/ESP/LID/COL/CLI se configuran individualmente. NULL conserva “Sin configurar”; NOT_APPLICABLE y NOT_AVAILABLE son distintos; población negativa y B2B/B2C fuera de CLI se rechazan. Las cinco filas de diagnósticos Phase 1 se recuperan con NULL, sin estado artificial.
- Segmento se crea en diagnóstico correcto, la reportabilidad inicia PENDING, se puede cambiar a NOT_REPORTABLE y desactivar sin borrar. Editar uno ajeno se rechaza. AuditLog conserva eventos de las siete mutaciones nuevas sin secretos ni contenido libre.
- Navegador prueba creación en organización propia/nueva, General persistente tras recarga, DIR y CLI, segmento pendiente/no reportable, coordinador de solo lectura, URL B con 404 y tablet de 768 px. Pruebas Phase 1 de login/cookie/logout/CSRF permanecen verdes.

## Problemas detectados y resueltos

- La migración de Prisma no rellenaba las perspectivas de diagnósticos previos; se agregó backfill explícito antes de aplicar.
- El test Phase 1 de conteo de tablas se actualizó de seis a ocho por las dos tablas autorizadas; las comprobaciones InnoDB/utf8mb4 permanecen.
- El listado demo contiene más de un diagnóstico tras correr E2E. Los selectores se ajustaron a celdas, evitando coincidencias ambiguas.
- El limitador de login por usuario funcionó y agotó su cuota al repetir muchos logins de prueba. Los pasos E2E de consultor comparten una sesión válida y se reinicia exclusivamente `ieo_test` antes de la suite; el umbral productivo no cambió.
- Las recargas de prueba esperan confirmación explícita de guardado, de acuerdo con la UI real. El formulario General asocia error de orden de fechas al campo de cierre.

## Límites y pendientes

Docker Compose sigue sin poder ejecutarse en este entorno por ausencia de Docker; se ejecutaron todas las pruebas DB contra MySQL 8 real. No se verificó infraestructura productiva del cliente. El estado REPORTABLE en Segment es una declaración, nunca autorización automática de publicar. No se han implementado participantes, instrumentos, catálogos, capturas ni el motor. GAP-001–GAP-013 permanecen abiertos.

`test:db:prepare` elimina todos los datos **sólo** en la base `_test` verificada; no ejecutarlo contra datos que deban conservarse. Las pruebas E2E crean registros sintéticos en esa base hasta el siguiente reinicio de fixtures.
