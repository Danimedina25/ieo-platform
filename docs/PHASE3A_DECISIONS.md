# Phase 3A — decisiones previas al código

Phase 0, 1 y 2 fueron aprobadas. Este documento delimita la vertical técnica de participante. **Phase 3A no contiene instrumentos oficiales IEO®**. GAP-001–GAP-013 permanecen abiertos, especialmente GAP-003, GAP-004 y GAP-012.

## Alcance y tablas

Se agregan seis tablas: Invitation, ParticipantAccessBinding, AccessChallenge, ParticipantAuthSession, ResponseSession y SurveyResponse. Se mantienen ocho tablas de Phase 1/2. No se crea User para participantes, catálogo oficial, MailDelivery ni tabla de rate limits. El diagnóstico sigue DRAFT; el flujo sólo acepta invitaciones y sesiones `isTest=true` y el fixture `TECH-SURVEY-01` versión 1. Una invitación sólo puede apuntar a una de las cinco AssessmentPerspective del mismo Assessment mediante FK compuesta. El seed no crea invitaciones. Para evitar envíos accidentales a participantes reales, el servidor sólo acepta dominios sintéticos `.test`/`ieo.local` o direcciones exactas del equipo en `TECHNICAL_INVITE_ALLOWED_EMAILS`; el aviso UI pide datos ficticios.

Invitation conserva identidad operativa: email cifrado AES-256-GCM, HMAC de búsqueda con secreto independiente, hash SHA-256 del magic token aleatorio de 32 bytes, estado/generación/expiración y trazabilidad. AccessChallenge contiene únicamente digest de contexto pre-OTP, HMAC de OTP de seis dígitos, intentos y caducidad. ParticipantAuthSession conserva sólo digest de bearer de 32 bytes. ResponseSession contiene assessment/perspectiva/fixture/estado/revisión, sin email, User, invitationId, OTP ni IP. SurveyResponse guarda clave/estado/valor original o texto cifrado. ParticipantAccessBinding es el único vínculo directo entre Invitation y ResponseSession; UNIQUE en ambos extremos.

## Criptografía, cookies y sesiones

`PARTICIPANT_ENCRYPTION_KEY` será una clave aleatoria externa de 32 bytes codificada base64url, usada en AES-256-GCM con nonce aleatorio de 12 bytes y etiqueta de autenticación. Cada ciphertext incluye versión de formato. `PARTICIPANT_LOOKUP_SECRET` y `OTP_HMAC_SECRET` serán secretos externos independientes de al menos 32 bytes de entropía, codificados base64url. HMAC-SHA-256 normaliza email; no se usa hash simple de email. OTP se genera con `crypto.randomInt(0, 1_000_000)`, se rellena a seis dígitos, y su HMAC ata challengeId, invitationId, tokenGeneration y propósito. Las comparaciones de HMAC se hacen con tiempo constante.

Magic token, contexto pre-OTP y bearer de participante son aleatorios de 32 bytes, sólo sus SHA-256 viven en DB. Cookies independientes HttpOnly/SameSite=Lax/Path=/, Secure y prefijo `__Host-` en producción. Preactivación dura 15 minutos; OTP 10 minutos y cinco intentos; reenvío después de 60 segundos, máximo tres challenges en quince minutos por invitación. Sesión de participante: 12 horas absolutas y 30 minutos de inactividad, sin superar la expiración de invitación. Todos son límites técnicos configurables, no reglas IEO®.

GET `/r/[token]` sólo valida el hash y lee estado para mostrar Continuar; no crea challenge, binding, sesión ni participación. El click usa POST con Origin exacto; el token se lee del pathname en el evento, no se serializa en propiedades de React ni localStorage. Después se usa `/r/acceso` sin token en URL. Las rutas `/r/*` y APIs de participante tienen Cache-Control no-store; `/r/[token]` lleva Referrer-Policy no-referrer y no carga recursos externos ni analytics.

Reemisión rota token/generación, invalida challenges y revoca sesiones previas. Cancelación es lógica, revoca challenges/sesiones/binding y no borra respuestas. Verificación OTP es transaccional con bloqueo de fila del challenge; sólo entonces se crea o reutiliza un ResponseSession. El mismo binding impide duplicar respuesta en una reanudación. Submit exige revisión actual, required sintético e introducción técnica; marca SUBMITTED y COMPLETED atómicamente. La cookie puede seguir permitiendo confirmación y submit idempotente, pero nunca escritura posterior.

## Email

Una interfaz pequeña `sendMagicLink`/`sendOtp` tiene adaptadores SMTP (Nodemailer), consola sólo en desarrollo no productivo y archivo JSONL sólo con `E2E_MODE=true`, base `_test`, origen localhost y ruta temporal explícita. El archivo E2E contiene secretos únicamente durante la prueba, con permiso 0600 y fuera del repositorio; Playwright lo lee directamente. No habrá endpoint HTTP de pruebas para OTP. SMTP y secretos del cliente siguen pendientes. Errores no imprimen payload ni credenciales.

## Survey Engine técnico

`TECH-SURVEY-01` versión 1 define dos bloques y cinco ítems sintéticos con `key`, `type`, `text`, `order`, `required`, `allowNA`. El renderer consume DTO genérico, sin textos hardcodeados; el mismo DTO podrá provenir más adelante de InstrumentVersion/QuestionVersion. `MISSING` es ausencia o estado explícito; `NA` sólo donde el fixture lo permite. Likert 1–5 queda crudo. Texto abierto se cifra antes de DB y se descifra sólo en la sesión participante autorizada. PATCH por lote usa `expectedRevision` y devuelve 409 ante otra revisión. No hay score, recodificación, inversión, interpretación ni preguntas COL.

El aviso visible será: **PRUEBA TÉCNICA — NO ES UN INSTRUMENTO IEO® OFICIAL**. La introducción `TECH-1` no constituye consentimiento oficial y sólo admite datos ficticios. La seudonimización conserva un vínculo restringido, por lo que no se describe como anonimato irreversible.

## Permisos y límites

Sólo IEO_CONSULTANT con membresía activa en organización activa puede crear/reemitir/cancelar invitaciones técnicas de Assessment DRAFT y ver su email operativo/estado. El coordinador no ve la pestaña Participantes en esta vertical; TECH_ADMIN sin membresía no entra al tab funcional. No existe endpoint persona→respuesta. Las mutaciones aplican Origin exacto, cookies SameSite, validación Zod, límites de cuerpo y auditoría mínima sin PII, OTP, tokens ni respuestas. El proxy/APM productivo debe omitir `/r/*` de logs con path completo; no afirmamos controlarlo desde Next.js.

Quedan fuera COL oficial, instrumentos/tablas de catálogo, participantes reales, invitaciones no test, estadísticas avanzadas, cierres, Motor IEO®, resultados y Phase 3B. Ninguna decisión técnica resuelve GAP-003/004/012.

## Cierre de implementación

Se usa una tercera pestaña del workspace para el consultor; el coordinador no accede al tab ni a la API de invitaciones, opción permitida por el pedido para no exponer identidad operativa. El magic token sólo se extrae del pathname en el click de Continuar. `isTest=true` se exige en servicios y mediante CHECK en MySQL para Invitation/ResponseSession. Los cinco códigos de perspectiva son claves relacionales; sólo el fixture `TECH-SURVEY-01` se sirve a participantes, cualquiera que sea la perspectiva técnica elegida. El estado `EXPIRED` está reservado en el enum, pero el vencimiento se evalúa mediante fecha, sin cron de mantenimiento en esta fase.

La migración se generó con `prisma migrate diff --from-config-datasource --to-schema` porque `migrate dev --create-only` rechazó la adición de la clave compuesta en ejecución no interactiva. Se revisó el SQL y se añadieron `ENGINE=InnoDB`, `utf8mb4` y CHECK antes de `migrate deploy`. No se usó `db push`. El email se envía después de confirmar la transacción: `CREATED` conserva un estado recuperable si falla el transporte; reemitir rota el token. La entrega efectiva no puede garantizarse sin infraestructura SMTP y monitoreo del cliente.

La separación de identidad es seudonimización, no anonimato. El vínculo está en ParticipantAccessBinding y debe quedar fuera de consultas analíticas y exportaciones. Phase 3A no implementa exportaciones ni datos metodológicos. Ver evidencia en [PHASE3A_VALIDATION.md](PHASE3A_VALIDATION.md).
