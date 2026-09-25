# Phase 1 — Decisiones de implementación

Autorizada por la instrucción de Phase 1 del usuario. Este documento se crea antes del código y delimita el alcance inmediato; la arquitectura de Phase 0 se conserva como diseño objetivo.

## Alcance actual

Aplicación Next.js App Router/TypeScript estricto, Tailwind, Prisma/MySQL 8, login administrativo, logout, listado real de diagnósticos y detalle mínimo. Sólo seis entidades: User, AdminSession, Organization, OrganizationMembership, Assessment y AuditLog. La tabla técnica `_prisma_migrations` pertenece a Prisma, no es una entidad de negocio adicional.

La pertenencia activa a una organización activa autoriza a consultor/coordinador a leer su metadata mínima. No hay AssessmentAssignment. TECH_ADMIN puede consultar exclusivamente el listado/detalle de metadata técnica mediante una rama explícita del caso de uso; los helpers de acceso organizacional no conceden un bypass por ser técnico.

## Autenticación elegida

Autenticación local pequeña y explícita: email normalizado, password Argon2id y sesión opaca. No Auth.js: para este flujo añadiría adaptación de proveedores/sesiones que no necesitamos. No Account, VerificationToken, registro público ni recuperación de contraseña. OIDC/OAuth/SSO/MFA: Deferred, no implementados en Phase 1.

Tokens criptográficos de 32 bytes; sólo SHA-256 del token en MySQL. Cookie HttpOnly, SameSite=Lax, Path=/; producción Secure y nombre __Host-ieo-admin; desarrollo HTTP nombre ieo-admin. Expiración absoluta 8 horas e inactividad 30 minutos configurables por environment. Logout revoca en servidor. Consultar usuario activo y sesión vigente en cada operación protegida. No usar localStorage.

Argon2id con salt generado por biblioteca; límites de entrada y verificación de coste equivalente para emails desconocidos. Login/logout sólo POST y validación estricta de Origin contra APP_ORIGIN, además de cookie SameSite. AUTH_SECRET se usa para seudonimizar claves del limitador de intentos; nunca para almacenar contraseñas con hashing rápido.

Protección de login con limitador pequeño y acotado en memoria por cuenta normalizada y presupuesto global por proceso. Es control técnico utilizado ahora, no RateLimitBucket ni infraestructura distribuida. El despliegue inicial debe usar un solo proceso; reinicios reinician contadores. Para varios procesos o exposición productiva sostenida, acordar limitación en el proxy o persistente antes de escalar. No confiar en IPs enviadas por el navegador.

## Persistencia y simplificaciones

MySQL 8.x, InnoDB, utf8mb4, FKs reales y UUID legibles. Prisma migrations reproducibles; no db push. Assessment sólo necesita DRAFT y campos de listado, sin transiciones. AuditLog registra login/logout, fallo genérico y rechazo de usuario deshabilitado; nunca bearer, password, hash de password ni correo intentado en metadata. No consola de usuarios: los datos sintéticos se crean por seed explícito con passwords obligatorias del entorno.

No repository por tabla, CQRS, eventos, container DI ni workers. Dominio contiene reglas puras; aplicación implementa casos de uso y autorización; infraestructura concentra Prisma, hashing y sesiones; UI consume DTO mínimos. Se permite acceso Prisma desde casos de uso mediante módulo de persistencia único, sin una capa ceremonial de interfaces por tabla.

## Diferido

Todas las entidades de catálogo/metodología, perspectivas/Elementos, alcance/segmentos, participantes/invitaciones/OTP/correo, respuestas/revisiones, calidad/cierre, SensitiveAccessGrant, DisclosureReview, snapshots/ProcessingRun, resultados/triangulación y ExportRecord quedan Deferred / Not implemented in Phase 1. No SDK de correo, cron, Redis, cola, tabs futuros ni motor matemático placeholder.

La asignación por diagnóstico puede incorporarse en Phase 2 si es necesaria. OIDC podrá reemplazar/complementar la autenticación manteniendo autorización independiente. Parámetros de sesión, estrategia de despliegue y limitación pueden evolucionar sin reglas metodológicas nuevas.

## Desarrollo y verificación

Compose ofrece únicamente MySQL 8 para desarrollo; Node ejecuta Next.js fuera del contenedor. Tests de integración usan una base MySQL separada y datos sintéticos; nunca SQLite. Playwright prueba login, aislamiento y revocación contra aplicación real. No reutilizar una base existente sin configurar una base dedicada. El servidor cliente continúa pendiente del inventario en INFRASTRUCTURE_REQUIREMENTS.md.

Las versiones resueltas se fijan en package-lock.json y se reportan al finalizar. Node disponible inicialmente: 20.19.6; no se infiere que sea la versión del cliente. Docker no está instalado en este entorno; el MySQL encontrado no es 8.x. La validación deberá usar MySQL 8 real y reportar cualquier bloqueo sin declarar PASS ficticio.

Estas simplificaciones técnicas NO modifican ninguna regla metodológica IEO®. GAP-001–GAP-013 permanecen abiertos y no bloquean login, organizaciones ni metadata de diagnósticos. Phase 2 no está autorizada por esta implementación.

## Resolución técnica durante implementación

- Node 24.21.0, Next.js 16.3.6, React 19.3.0, Prisma 7.10.0; TypeScript 5.9.3 por compatibilidad con el lint seleccionado. Versiones exactas en package.json/lockfile. No se adoptó Prisma 8 prerelease.
- Prisma 7 usa `@prisma/adapter-mariadb` para MySQL, sin cambiar el proveedor ni usar MariaDB como servidor. Overrides fijan mariadb 3.5.4, mysql2 3.24.4 y deepmerge-ts 8.0.2 para resolver alertas transitivas. Verificar nuevamente al actualizar Prisma; no aplicar `audit fix --force` sin revisión.
- Se usa Webpack oficial (`next dev/build --webpack`): Turbopack no pudo abrir un puerto interno en el entorno de validación. No se relajaron TypeScript ni ESLint.
- No hay Docker instalado en el entorno de trabajo. Se valida con MySQL 8.4.10 oficial, aislado en /tmp y puerto localhost 3307. Compose se entrega para reproducción, sin afirmar haberlo ejecutado aquí.
- Seed explícito exige contraseñas de entorno y ALLOW_DEVELOPMENT_SEED=true; repetirlo restablece usuarios demo y revoca sus sesiones. No es un provisionador de producción. Las credenciales temporales de validación se configuraron externamente en `.env` ignorado y no se imprimieron.
- Límite de login: 10 intentos por correo/15 minutos y 60 globales/minuto, incluye intentos exitosos. No confía en X-Forwarded-For. Body JSON máximo 4096 bytes. Fallos no registran correo intentado. La auditoría guarda UUID del usuario en eventos autenticados.
- Cookie producción Secure se prueba con Chromium sobre localhost (excepción de contexto seguro del navegador). En dominios de producción APP_ORIGIN exige HTTPS. CSP mínima anti-framing/base/form/object; no se afirma protección CSP de scripts mediante nonces en esta fase. React escapa el texto y no se usa HTML dinámico.
