# Sistema Digital IEO®

Proyecto para ejecutar digitalmente el diagnóstico del Índice de Erosión Organizacional®, basado en Los 8 Elementos del Éxito®. Integrará Dirección, Especialistas, Liderazgo, Colaboradores y Voz del Cliente dentro de un mismo diagnóstico, preservando correctitud metodológica, confidencialidad, trazabilidad y reproducción histórica.

> Los documentos de arquitectura describen tanto el núcleo MVP como capacidades futuras. Cada fase implementa únicamente las entidades y controles necesarios para su alcance.

## Requirements

Node.js 24 LTS (validado: 24.21.0), npm y MySQL 8.x/InnoDB/utf8mb4. Docker Compose es una opción para MySQL local, no para Next.js. Chromium se instala con Playwright. SMTP se requiere para invitaciones reales; el provider consola es sólo desarrollo y el provider archivo sólo E2E local.

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

El seed también carga los cinco catálogos oficiales v1.0 y el paquete metodológico IEO 1.0. En otros ambientes (sin seed demo) se cargan con `npm run db:catalog`: es idempotente, nunca modifica una versión ya cargada y fija el paquete en los diagnósticos DRAFT que no lo tengan. `npm run catalog:build` regenera los JSON desde `docs/`.

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
| PARTICIPANT_ENCRYPTION_KEY | 32 bytes base64url para email y texto abierto; conservar para poder descifrar históricos |
| PARTICIPANT_LOOKUP_SECRET | 32 bytes base64url distintos para HMAC de búsqueda de email |
| OTP_HMAC_SECRET | 32 bytes base64url distintos para HMAC de OTP |
| EMAIL_PROVIDER | `smtp` en producción; `console` sólo desarrollo; `file` sólo E2E local con base `_test` |
| TECHNICAL_INVITE_ALLOWED_EMAILS | Lista de direcciones exactas del equipo para Phase 3A; `.test` e `ieo.local` se admiten como sintéticas |
| SMTP_HOST / SMTP_PORT / SMTP_SECURE / SMTP_USER / SMTP_PASSWORD / SMTP_FROM | Transporte y remitente SMTP cuando EMAIL_PROVIDER=`smtp` |
| E2E_MODE / E2E_MAILBOX_PATH | Exclusivos de Playwright; archivo temporal con permiso 0600 |

Codifica caracteres reservados de passwords en las URLs MySQL (percent-encoding). No confundir AUTH_SECRET con passwords seed. Cambiar AUTH_SECRET reinicia claves del limitador, no revoca sesiones; para revocarlas se actualiza revokedAt en DB por operación administrativa controlada. No hay panel de usuarios ni recuperación de password en esta fase.

## MySQL

Compose contiene únicamente `mysql:8.4.10`, puerto local 3307 y volumen persistente `mysql_data`. Inicializa ieo_dev, ieo_test e ieo_shadow; el script adicional corre **solo al crear un volumen vacío**. Cambiar `.env` después no cambia credenciales de un volumen existente. No borrar volúmenes con datos para resolver configuración.

Alternativa: MySQL 8 local ya instalado, con tres bases dedicadas y permisos equivalentes. Nunca ejecutar pruebas sobre una DB cliente. En esta máquina se verificó MySQL 8.4.10 oficial aislado en /tmp, ya que Docker no está instalado; Compose no se ejecutó aquí. La instancia de validación y el `.env` temporal no sustituyen tu configuración de desarrollo.

Prisma usa FKs reales, UUID CHAR(36), índices, restricciones UNIQUE y transacciones. Veinte tablas de aplicación: ocho de Phase 1/2, seis de Phase 3A, cuatro de catálogo de Phase 3B (InstrumentVersion, InstrumentSection, QuestionVersion, InstrumentScaleOption) y dos de paquete de Phase 4 (MethodologyPackage, PackageInstrument). `_prisma_migrations` pertenece a Prisma. Phase 3A añade CHECK de `isTest=true` y forma de respuesta; Phase 3B, CHECK de forma de pregunta y FKs compuestas que impiden responder preguntas de otro instrumento.

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

Admin usa SEED_ADMIN_PASSWORD; los otros tres usan SEED_USER_PASSWORD. Crea Organización Demo A/B, un diagnóstico DRAFT por organización y cinco perspectivas inicialmente sin configurar por diagnóstico, periodo 2026. Todos los datos son sintéticos.

## Development

```sh
npm run dev
```

Rutas: `/` redirige según sesión; `/login`; `/diagnosticos`; `/diagnosticos/[id]?tab=general|perspectivas|participantes`; `/r/[token]`, `/r/acceso`, `/r/introduccion`, `/r/cuestionario`, `/r/gracias`. Login/logout son POST; las APIs del workspace usan POST/PATCH/DELETE. Consultores crean organización/diagnóstico y editan General, perspectivas y segmentos. Coordinadores consultan. TECH_ADMIN sin membresía ve metadata técnica. Detalle de organización ajena devuelve 404. Los diagnósticos permanecen DRAFT. Sólo el consultor miembro ve la pestaña Participantes, crea/reemite/cancela invitaciones y ve correos operativos. La persona participante no tiene cuenta User: verifica OTP y responde sólo el fixture sintético TECH-SURVEY-01.

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
npm run test:acceptance
```

Integración y E2E requieren MySQL real. `test:db:prepare` migra, verifica el nombre y **borra sólo los datos de la base dedicada TEST_DATABASE_URL** antes de aplicar seed; exige sufijo `_test` y separación de DATABASE_URL. Reaplicarlo antes de E2E restaura fixtures después de integración. No apuntar TEST_DATABASE_URL a datos que se deban conservar. Ejecutar suites DB secuencialmente. Playwright inicia build de producción en localhost:3100 con DB de pruebas; no reutiliza servidor de desarrollo. La cookie Secure se prueba en localhost como contexto permitido por Chromium. Traces están desactivadas para evitar capturar credenciales de login.

## Build

```sh
npm run build
npm run start
```

Para `start` en un dominio real usa HTTPS y APP_ORIGIN correcto; no sustituir Secure por cookies inseguras. En localhost Chromium admite cookies Secure. Production build no equivale a aprobación de despliegue.

## Current implementation status

**Phases 1, 2, 3A, 3B, 4 y 5A implementadas.** Se puede configurar un borrador, gestionar segmentos y recorrer invitación → OTP → respuestas → reanudación → envío con los cinco cuestionarios oficiales v1.0 (329 reactivos + 28 abiertas), cada perspectiva con el suyo y envío con ≥ 60 % por Elemento. **Sólo datos ficticios** mientras GAP-012 siga abierto. El motor matemático (`src/domain/ieo-engine`) pasa los 23 casos oficiales de S12 ([registro](docs/PHASE5A_ACCEPTANCE.md)), pero todavía no se ejecuta sobre diagnósticos: no hay cierre, congelamiento ni pantallas de resultados (Phase 5B y 6). Evidencia y límites: [PHASE4_VALIDATION.md](docs/PHASE4_VALIDATION.md), [PHASE3B_VALIDATION.md](docs/PHASE3B_VALIDATION.md), [PHASE3A_VALIDATION.md](docs/PHASE3A_VALIDATION.md), [PHASE2_VALIDATION.md](docs/PHASE2_VALIDATION.md) y [PHASE1_VALIDATION.md](docs/PHASE1_VALIDATION.md). GAP-003/004/005/006/014 tienen resolución registrada; el resto sigue abierto ([METHODOLOGY_GAPS.md](docs/METHODOLOGY_GAPS.md)).

## Documentación

- [Decisiones y alcance de Phase 1](docs/PHASE1_DECISIONS.md)
- [Decisiones de Phase 2](docs/PHASE2_DECISIONS.md) y [validación](docs/PHASE2_VALIDATION.md)
- [Decisiones de Phase 3A](docs/PHASE3A_DECISIONS.md) y [validación](docs/PHASE3A_VALIDATION.md)
- [Decisiones de Phase 3B](docs/PHASE3B_DECISIONS.md) y [validación](docs/PHASE3B_VALIDATION.md)
- [Decisiones de Phase 4](docs/PHASE4_DECISIONS.md) y [validación](docs/PHASE4_VALIDATION.md)
- [Decisiones de Phase 5](docs/PHASE5_DECISIONS.md) y [aceptación S12 de 5A](docs/PHASE5A_ACCEPTANCE.md)
- [Infraestructura pendiente del cliente](docs/INFRASTRUCTURE_REQUIREMENTS.md)
- [Arquitectura, fuentes y cobertura objetivo](docs/ARCHITECTURE.md)
- [Modelo completo objetivo](docs/DATA_MODEL.md)
- [Seguridad y confidencialidad](docs/SECURITY.md)
- [Pantallas](docs/SCREEN_MAP.md), [rutas](docs/ROUTES.md), [fases](docs/IMPLEMENTATION_PLAN.md)
- [Dudas metodológicas](docs/METHODOLOGY_GAPS.md)

Los 12 originales permanecen directamente en docs; no existe docs/requirements. Sus hashes están en ARCHITECTURE.md. No se modifican reglas IEO® en Phase 1, Phase 2 ni Phase 3A.
