# Phase 3A — validación técnica

Fecha: 2026-09-25. Alcance exclusivo: vertical sintética de participante `TECH-SURVEY-01` v1. **PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL.** No se cargó ni se procesó COL oficial; GAP-003 y GAP-004 continúan abiertos.

## Resultado y cobertura

| Comprobación | Evidencia |
|---|---|
| Prisma generate / migrate deploy / seed | Cliente generado; migración `20260925200000_phase3a_participant_technical_survey` aplicada en MySQL 8.4.10 dev y test; seed sintético idempotente |
| Lint / typecheck / build | PASS con Webpack y TypeScript estricto |
| Unit | 29 PASS: 16 previas, 13 nuevas de criptografía, fixture, validación y duración de sesiones |
| Integration MySQL | 49 PASS: 21 previas, 28 nuevas. Ejecutadas tras `test:db:prepare` en `ieo_test` |
| Playwright Chromium | 35 PASS: 19 previas, 16 nuevas. Servidor production build en localhost:3100 y provider archivo E2E |
| Originales | 12 de 12 SHA-256 coinciden con `ARCHITECTURE.md`; ningún DOCX/XLSX modificado |

Las suites de integración anteriores suponen una base exclusiva limpia; ejecutar `npm run test:db:prepare` antes de integración y otra vez antes de Playwright. E2E crea diagnósticos e invitaciones sintéticas en `ieo_test`; no apunta a `ieo_dev`.

## Casos Phase 3A verificados

Unit cubre bearer aleatorio de 32 bytes, SHA-256, AES-256-GCM y AAD separado para email/texto, HMAC normalizado, OTP de seis dígitos y contexto, los cinco ítems sintéticos, obligatorias, N/A, rechazo de ítems ajenos, patch duplicado, expiración absoluta e inactividad.

Integración cubre la restricción de correo sintético/equipo y permisos del consultor/coordinador, identidad cifrada, token no recuperable de DB, GET sin escritura, challenge sin respuesta, enfriamiento, intentos de OTP y bloqueo al quinto, verificación de un solo uso, binding único, introducción, ausencia de ítems oficiales, N/A selectivo, texto cifrado, revisión optimista, envío permanente e idempotente, reemisión, cancelación, reutilización de la misma respuesta, restricciones MySQL `isTest=true`, FK compuesta que impide mezclar diagnósticos y revocación de sesión activa.

Playwright recorre los 16 escenarios E2E-P3A-01–16 del pedido: consultor crea, enlace por GET sin respuesta, OTP erróneo/correcto, introducción, guardado y recarga, reanudación con segundo OTP, conflicto entre pestañas, obligatorias, N/A, envío, retorno a gracias, cancelación, reemisión y viewport 390×844. El provider JSONL vive bajo el directorio temporal del sistema, permiso 0600, sólo con `E2E_MODE=true`, base `_test` y origen localhost. El test lee el archivo; no hay endpoint HTTP de códigos.

## Seguridad y separación inspeccionadas

- `Invitation` contiene email cifrado, HMAC de búsqueda y sólo SHA-256 del magic bearer. `AccessChallenge` guarda HMAC de OTP, hash de preauth y contador. `ParticipantAuthSession` guarda hash de bearer. Ninguno de los tres guarda secretos raw en MySQL.
- `ResponseSession` y `SurveyResponse` no tienen nombre, email, teléfono, `invitationId`, `userId` ni IP. `ParticipantAccessBinding` es el único puente directo; sus extremos son únicos. No se crea `User` para participante.
- Texto abierto cifrado; valor Likert original y estados `VALUE`, `NA`, `MISSING` separados. MySQL CHECK rechaza `isTest=false` en invitaciones y sesiones, e impide formas inválidas de respuesta.
- Cookies HttpOnly, SameSite=Lax y `__Host-`/Secure en producción. Mutaciones exigen Origin exacto. Rutas de participante son `no-store`; el enlace usa `no-referrer` y no incorpora analytics ni recursos externos. No se emplea localStorage.
- Reemisión y cancelación revocan challenges y sesiones. El envío deja respuesta SUBMITTED; patch posterior falla. Auditoría registra operación y versión técnica, sin email, token, OTP ni contenido.

## Límites observados

La lista exacta de correos de equipo debe configurarse si se usa SMTP para la prueba; el servidor permite por defecto sólo `.test` y `ieo.local` como dominios sintéticos. El control de envío OTP (60 s y 3 por 15 min por invitación) es persistente en MySQL. No hay aún limitador global compartido por IP: debe ubicarse en proxy/gateway antes de exposición pública. No se validó entrega SMTP real ni proxy productivo; están pendientes de datos del cliente en `INFRASTRUCTURE_REQUIREMENTS.md`. La entrega de correo y la transacción MySQL no son atómicas: si falla SMTP, la invitación queda `CREATED` o el challenge se invalida y se puede reemitir/reintentar tras el enfriamiento. La clave AES debe respaldarse de modo seguro o el contenido cifrado histórico será irrecuperable. No se permite usar esta vertical con participantes reales ni como cálculo IEO®.
