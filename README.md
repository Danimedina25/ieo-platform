# Sistema Digital IEO®

Proyecto para ejecutar digitalmente el diagnóstico del Índice de Erosión Organizacional®, basado en Los 8 Elementos del Éxito®. Integrará Dirección, Especialistas, Liderazgo, Colaboradores y Voz del Cliente dentro de un mismo diagnóstico, preservando correctitud metodológica, confidencialidad, trazabilidad y reproducción histórica.

> Los documentos de arquitectura describen tanto el núcleo MVP como capacidades futuras. Cada fase implementa únicamente las entidades y controles necesarios para su alcance.

## Requirements

Node.js 24 LTS (validado: 24.21.0), npm y MySQL 8.x/InnoDB/utf8mb4. Docker Compose es una opción para MySQL local, no para Next.js. Chromium se instala con Playwright. No se requiere SMTP.

Stack: Next.js 16.3.6 App Router, React 19.3.0, TypeScript 5.9.3 estricto, Tailwind 4.3.3, Prisma 7.10.0, Zod 4.6.5, React Hook Form 7.88.0, Argon2 0.45.1, Vitest 5.0.1 y Playwright 1.63.0. Componentes HTML accesibles propios; sin Auth.js. Versiones fijadas en package-lock.json. Webpack se usa explícitamente por incompatibilidad de Turbopack con puertos internos del entorno de validación.

## Local setup

Desde una copia del proyecto:

```sh
nvm use
npm ci
cp .env.example .env
```

Configura `.env` antes de continuar. Si ya existe, no lo sobrescribas. Luego:

```sh
docker compose up -d --wait mysql
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

Abre http://localhost:3000/login. El seed exige habilitación explícita y passwords propias. Esta secuencia no crea diagnósticos reales ni ejecuta la metodología.

## Environment

`.env` está ignorado; nunca subirlo ni copiarlo a tickets/logs. `.env.example` contiene nombres y ejemplos sin secretos.

| Variable | Uso |
|---|---|
| DATABASE_URL | MySQL desarrollo, base ieo_dev |
| TEST_DATABASE_URL | Base separada ieo_test, nunca igual a desarrollo |
| SHADOW_DATABASE_URL | Base vacía dedicada ieo_shadow para migrate dev |
| MYSQL_ROOT_PASSWORD / MYSQL_PASSWORD | Credenciales elegidas para Compose; MYSQL_PASSWORD coincide con la URL de ieo |
| AUTH_SECRET | Secreto aleatorio propio de al menos 32 caracteres; HMAC de claves del limitador |
| APP_ORIGIN | Origen exacto, sin ruta ni barra final; local http://localhost:3000; producción HTTPS |
| ADMIN_SESSION_TTL_HOURS | 8 por defecto |
| ADMIN_SESSION_IDLE_MINUTES | 30 por defecto |
| SEED_ADMIN_EMAIL | admin@ieo.local por defecto en ejemplo |
| SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD | Elegir contraseñas de 12–128 caracteres; no hay valor automático |
| ALLOW_DEVELOPMENT_SEED | Cambiar a true solo para aplicar seed sintético |
| E2E_PORT | 3100 por defecto; proceso E2E independiente |

Codifica caracteres reservados de passwords en las URLs MySQL (percent-encoding). No confundir AUTH_SECRET con passwords seed. Cambiar AUTH_SECRET reinicia claves del limitador, no revoca sesiones; para revocarlas se actualiza revokedAt en DB por operación administrativa controlada. No hay panel de usuarios ni recuperación de password en esta fase.

## MySQL

Compose contiene únicamente `mysql:8.4.10`, puerto local 3307 y volumen persistente `mysql_data`. Inicializa ieo_dev, ieo_test e ieo_shadow; el script adicional corre **solo al crear un volumen vacío**. Cambiar `.env` después no cambia credenciales de un volumen existente. No borrar volúmenes con datos para resolver configuración.

Alternativa: MySQL 8 local ya instalado, con tres bases dedicadas y permisos equivalentes. Nunca ejecutar pruebas sobre una DB cliente. En esta máquina se verificó MySQL 8.4.10 oficial aislado en /tmp, ya que Docker no está instalado; Compose no se ejecutó aquí. La instancia de validación y el `.env` temporal no sustituyen tu configuración de desarrollo.

Prisma usa FKs reales, UUID CHAR(36), índices, restricciones UNIQUE y transacciones. Seis tablas de aplicación: User, AdminSession, Organization, OrganizationMembership, Assessment, AuditLog; más `_prisma_migrations` administrada por Prisma.

## Prisma migrations

```sh
npm run db:generate
npm run db:migrate:deploy
```

La migración inicial versionada crea el esquema; no se usa db push. Para cambios futuros autorizados durante desarrollo:

```sh
npm run db:migrate -- --name nombre_del_cambio
```

`migrate dev` necesita shadow separada y privilegios DDL; producción usa `migrate deploy` con cuenta de despliegue. La cuenta runtime productiva debe limitarse a los permisos necesarios. No modificar migraciones aplicadas.

## Seed

```sh
npm run db:seed
```

Falla si faltan credenciales válidas, no está ALLOW_DEVELOPMENT_SEED=true o NODE_ENV=production. No genera passwords ni las imprime. Es idempotente en las entidades demo; repetirlo restablece password/estado y revoca sesiones demo previas. No usarlo para administrar usuarios de producción.

| Usuario sintético | Permiso |
|---|---|
| admin@ieo.local (configurable) | TECH_ADMIN: metadata técnica A/B, sin membresía automática |
| consultor@ieo.local | IEO_CONSULTANT, organización A |
| coordinador@ieo.local | ORG_COORDINATOR, organización A |
| consultor2@ieo.local | IEO_CONSULTANT, organización B |

Admin usa SEED_ADMIN_PASSWORD; los otros tres usan SEED_USER_PASSWORD. Crea Organización Demo A/B y un diagnóstico DRAFT por organización, periodo 2026. Todos los datos son sintéticos.

## Development

```sh
npm run dev
```

Rutas: `/` redirige según sesión; `/login`; `/diagnosticos`; `/diagnosticos/[id]`. Mutaciones exclusivamente POST: `/api/auth/login`, `/api/auth/logout`. Detalle de organización ajena devuelve 404. No hay creación de diagnóstico, tabs ni operaciones metodológicas.

Estructura: `src/app` rutas/layouts, `components` formulario utilizado, `domain` reglas puras, `application` autenticación/autorización/consultas, `infrastructure` Prisma/Argon2/tokens/limitador, `lib` configuración y HTTP. Los casos de uso se ejecutan en servidor; la UI recibe metadata mínima.

## Tests

```sh
npm run lint
npm run typecheck
npm test
npm run test:db:prepare
npm run test:integration
npm run test:db:prepare
npm run build
npx playwright install chromium
npm run test:e2e
```

Integración y E2E requieren MySQL real. `test:db:prepare` migra y aplica seed a TEST_DATABASE_URL; exige sufijo `_test` y separación de DATABASE_URL. Reaplicarlo antes de E2E restaura fixtures después de integración. Ejecutar suites DB secuencialmente. Playwright inicia build de producción en localhost:3100 con DB de pruebas; no reutiliza servidor de desarrollo. La cookie Secure se prueba en localhost como contexto permitido por Chromium. Traces están desactivadas para evitar capturar credenciales de login.

## Build

```sh
npm run build
npm run start
```

Para `start` en un dominio real usa HTTPS y APP_ORIGIN correcto; no sustituir Secure por cookies inseguras. En localhost Chromium admite cookies Secure. Production build no equivale a aprobación de despliegue.

## Current implementation status

**Phase 1 completed.** Login, permisos, MySQL y logout verificados; lint, typecheck, 10 unitarias, 9 integración, 9 E2E y build PASS. Consulta [evidencia y limitaciones](docs/PHASE1_VALIDATION.md).

Únicamente base, seis entidades, login, sesiones, permisos, listado/detalle mínimo y auditoría básica. Phase 2 no iniciada. GAP-001–GAP-013 siguen abiertos.

## Documentación

- [Decisiones y alcance de Phase 1](docs/PHASE1_DECISIONS.md)
- [Infraestructura pendiente del cliente](docs/INFRASTRUCTURE_REQUIREMENTS.md)
- [Arquitectura, fuentes y cobertura objetivo](docs/ARCHITECTURE.md)
- [Modelo completo objetivo](docs/DATA_MODEL.md)
- [Seguridad y confidencialidad](docs/SECURITY.md)
- [Pantallas](docs/SCREEN_MAP.md), [rutas](docs/ROUTES.md), [fases](docs/IMPLEMENTATION_PLAN.md)
- [Dudas metodológicas](docs/METHODOLOGY_GAPS.md)

Los 12 originales permanecen directamente en docs; no existe docs/requirements. Sus hashes están en ARCHITECTURE.md. No se modifican reglas IEO® en Phase 1.
