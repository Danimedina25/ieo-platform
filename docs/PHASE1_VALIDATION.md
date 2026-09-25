# Phase 1 — Validación ejecutada

Fecha: 2026-09-25. Entorno: macOS ARM64, Node 24.21.0, MySQL Community 8.4.10 oficial aislado en localhost:3307. Datos exclusivamente sintéticos. No despliegue al cliente.

| Gate | Resultado real |
|---|---|
| npm install | PASS; lockfile creado, versiones fijadas |
| npm run db:generate | PASS; Prisma Client 7.10.0 |
| npm run db:migrate -- --name phase1_base --create-only | PASS; migración revisada antes de aplicar |
| npm run db:migrate:deploy | PASS sobre ieo_dev y ieo_test; segunda ejecución sin pendientes |
| npm run db:seed | PASS; 4 usuarios, 2 organizaciones, 2 diagnósticos |
| npm run lint | PASS; cero warnings permitidos |
| npm run typecheck | PASS; strict permanece true |
| npm test | PASS; 10 pruebas unitarias |
| npm run test:integration | PASS; 9 pruebas contra MySQL 8 real |
| npm run test:e2e | PASS; 9 pruebas Chromium contra build producción + MySQL |
| npm run build | PASS; Webpack, rutas dinámicas autenticadas |
| npm audit (tras overrides) | 0 vulnerabilidades conocidas reportadas al instalar |
| Hashes fuentes DOCX/XLSX | PASS; 12/12 idénticos al inventario Phase 0 |

Integración comprueba aislamiento A/B, coordinador, distinción TECH_ADMIN/membresía, membresía u organización inactiva, usuario deshabilitado, expiración absoluta/inactividad, revocación/replay, ausencia de secretos en auditoría, FK compuesta y seis tablas InnoDB/utf8mb4 en MySQL 8.

E2E comprueba acceso sin sesión, login admin, atributos cookie producción, consultor con solo A, detalle autorizado, URL B con 404, logout/replay, coordinador sin B, error genérico, CSRF, GET sin mutación y login móvil mediante teclado.

## Problemas encontrados y resolución

- Inicialización MySQL dentro del sandbox falló; instancia aislada se inicializó y arrancó con ejecución autorizada fuera del sandbox.
- Un intento de arranque no se ejecutó por límite de uso de revisión automática. El usuario pidió continuar; el reintento fue autorizado y funcionó.
- Turbopack falló al abrir puerto interno incluso en el reintento; se adoptó Webpack oficial para dev/build.
- Primer E2E detectó logout rechazado por Origin ausente/null con Referrer-Policy no-referrer. Se cambió a strict-origin-when-cross-origin; logout y CSRF pasaron después. No se relajó validación de Origin.
- Selector del error de login coincidía también con anunciador accesible Next.js; se precisó a #login-error, conservando mensaje esperado.
- Alertas transitivas corregidas mediante overrides; documentadas en PHASE1_DECISIONS.md.

## Límites de la evidencia

Docker no está instalado: no se ejecutó Compose; sí se ejecutaron migration/seed/integración/E2E contra servidor MySQL 8.4.10 real. No se verificó servidor del cliente ni DB TLS remota. La suite navegador ejecutada es Chromium, no certificación multibrowser. No existe repositorio Git inicializado en este directorio: `git status --short` devuelve “not a git repository”; no se crearon commits ni se alteró historial.

Phase 1 completed. Phase 2 no iniciada. GAP-001–GAP-013 permanecen abiertos. El seed de desarrollo no es un flujo productivo de administración de usuarios.
