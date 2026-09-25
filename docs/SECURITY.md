# Seguridad y confidencialidad

> **Alcance incremental:** este documento conserva la arquitectura objetivo de Phase 0. Phase 1 implementa únicamente login local, sesiones, membresías organizacionales, metadata de diagnósticos y auditoría básica con seis entidades. OIDC, SensitiveAccessGrant, DisclosureReview, procesamiento/worker, revisiones detalladas y correo: **Deferred / Not implemented in Phase 1**. El alcance vigente está en [PHASE1_DECISIONS.md](PHASE1_DECISIONS.md); las rutas y entidades futuras de este documento no implican implementación actual.

Estado: controles propuestos, pendientes de implementación y pruebas. Reglas metodológicas: S01 §10–12, S02 §§2–3,9,12–18, S06 §§39–44; identificadores de fuentes en [ARCHITECTURE.md](ARCHITECTURE.md). Las cifras de vigencia/límites siguientes son parámetros técnicos propuestos, no reglas oficiales IEO®.

## Fronteras de confianza

Proteger identidad, participación, respuestas cuantitativas, texto abierto, resultados individuales, versiones, exclusiones y credenciales. Amenazas principales: coordinador que intenta identificar respuestas; participante que cambia un ID o reenvía enlace; actor externo que adivina OTP; sesión robada; exportación que revela un segmento; error administrativo que altera históricos; compromiso de servidor o respaldo.

Navegador, email, parámetros URL, JSON, CSV e IDs suministrados son entradas no confiables. La frontera de autorización está en cada caso de uso del servidor. Proxy/middleware y ocultar botones sirven para navegación, no bastan para proteger datos. Server Components tampoco pueden serializar objetos completos al cliente: construir DTO explícito por audiencia. La [documentación de Next.js](https://nextjs.org/docs/app/getting-started/mutating-data) exige verificar autenticación y autorización en cada Server Function.

## Autenticación administrativa

Propuesta preferente: Auth.js con proveedor OIDC del cliente, Prisma/MySQL y cuentas preautorizadas. Solicitar al proveedor MFA para consultores/técnicos con acceso sensible. Un callback válido verifica emisor, audiencia, state/nonce y sujeto; no basta confiar en el email recibido. Sin registro público ni asignación de TECH_ADMIN por dominio de correo. La [integración Prisma de Auth.js](https://authjs.dev/getting-started/adapters/prisma) es la referencia de compatibilidad, no un schema para copiar sin revisar.

Antes de Phase 1 confirmar disponibilidad de OIDC y versión estable compatible. Si el cliente necesita usuario/contraseña local, elegir una solución mantenida que soporte ese flujo, hashing y revocación con Prisma/MySQL; no asumir que el proveedor Credentials y sesiones de base de datos de Auth.js funcionan en cualquier combinación. La elección y sus pruebas forman parte de Phase 1. Contraseñas locales, si se eligen, se almacenan con Argon2id, salt por contraseña y parámetros calibrados; nunca SHA-256 simple ni cifrado reversible. Referencia: [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Sesión administrativa propuesta: cookie opaca, Secure, HttpOnly, SameSite=Lax, sin Domain, TTL absoluto 8 h e inactividad 30 min; reautenticación reciente para concesiones, reapertura y exports sensibles. En base sólo digest de token. El adaptador elegido debe soportar transformar el token de sesión en digest en create/read/update/delete: verificarlo expresamente; no dar por hecho que el adaptador estándar lo hace. Tokens de proveedor sólo si indispensables y cifrados. Revocar al desactivar User/membresía o cambiar permisos. Logout es POST protegido; callbacks OIDC siguen su protocolo y allowlist de redirect.

## Roles y permisos

Las fuentes confirman TECH_ADMIN, IEO_CONSULTANT y ORG_COORDINATOR. Sponsor es responsabilidad de gobernanza y no exige un cuarto rol administrativo. PARTICIPANTE es principal temporal de acceso a una sesión propia, no User ni perfil. Propuesta mínima:

| Operación | TECH_ADMIN | IEO_CONSULTANT asignado | ORG_COORDINATOR asignado | Participante |
|---|---|---|---|---|
| Infraestructura, altas y membresías | Sí, auditado | No | No | No |
| Configurar alcance/perspectivas/ventana | Sólo si tiene asignación de consultor | Sí | Consultar logística permitida | No |
| Publicar catálogo aprobado | Ejecutar importación con aprobación metodológica | Revisar/aprobar contenido según custodia | No | No |
| Cargar invitados y gestionar entrega | Soporte acotado si asignado | Sí | Sí, sin consultar contenido | No |
| Ver participación | Soporte operativo autorizado | Agregada y logística necesaria | Agregada; entrega individual mínima | Su propio acceso |
| Abrir, cerrar, dictaminar, congelar, procesar | No por rol técnico | Sí, sujeto a precondiciones | No | No |
| Reabrir/corregir | No implícito | Sólo permiso excepcional y GAP-010 resuelto | No | No |
| Ver resultados publicados | No implícito | Sí, con política de divulgación | No por defecto; entrega autorizada agregada | No |
| Ver respuestas individuales / PI / originales abiertos | No implícito | Sólo SensitiveAccessGrant apropiado | No | Sólo borrador propio para responder |
| Exportar agregados y metadatos | No implícito | Sí, sujeto a reportabilidad | No por defecto | No |
| Exportar crudos / PI / originales abiertos | Sólo grant aprobado por custodia | Sólo grant aprobado por custodia | No | No |
| Auditar | Seguridad técnica redactada | Diagnóstico asignado, metadata redactada | Sin vista de auditoría | No |

Permisos sensibles separados: RAW_RESPONSE_READ/EXPORT, INDIVIDUAL_SCORE_READ/EXPORT, QUALITATIVE_ORIGINAL_READ/EXPORT, REOPEN_ASSESSMENT. Un grant contiene propósito, diagnóstico, vigencia, aprobador y revocación. Quién aprueba es GAP-011; no habilitar autoaprobación por consultor ni por técnico. Los roles no forman una escalera donde técnico hereda todos los permisos.

Aislamiento: recuperar organización y asignación del principal autenticado y confirmar pertenencia del recurso en todas las consultas, acciones y descargas. No confiar en `organizationId`, `role` o `responseSessionId` recibidos. IDs opacos reducen enumeración, pero no son permisos. MySQL no aporta una política de filas que pueda suponerse activada: filtros obligatorios, repositorios acotados, FKs compuestas y tests cruzados. Denegar por defecto conforme a [OWASP Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Invitación, OTP y reanudación

1. Crear Invitation para perspectiva validada, con token aleatorio criptográfico de 32 bytes y digest SHA-256 único. TTL propuesto: hasta 7 días sin exceder cierre; reemitir rota generación y revoca el token anterior. No revelar el enlace completo en el listado de participantes.
2. `GET /r/[token]` sirve la pantalla de inicio sin consumir enlace, enviar OTP, abrir ResponseSession ni marcar participación. No registrar token en proxy, APM, trazas, errores o analítica. La visita automatizada del scanner no prueba voluntad ni identidad.
3. El participante pulsa continuar y realiza POST. Se valida invitación/ventana, se fija contexto previo con cookie efímera y se genera challenge ligado al navegador e invitación. Navegar a `/r/acceso`, sin token en URL; limpiar URL del historial cuando sea posible. El enlace por sí solo no autoriza respuestas.
4. OTP de 6 dígitos aleatorio, TTL 10 min, máximo 5 intentos por challenge; almacenar HMAC con secreto externo y contexto challenge+invitation+purpose. No hash sin clave de un espacio de sólo un millón de códigos. Reenvío mínimo 60 s; invalida challenge anterior y no reinicia presupuesto de abuso de la invitación.
5. Verificar OTP mediante POST con protección CSRF. Consumo atómico de un solo uso, generación vigente, expiración, intentos y vínculo de navegador. Crear/reutilizar exactamente un ParticipantAccessBinding y ResponseSession mediante constraints y transacción. Rotar sesión temporal para evitar fixation.
6. Entregar cookie opaca propia `__Host-ieo-participant`, Secure, HttpOnly, SameSite=Lax, Path=/ y sin Domain. Digest en ParticipantAuthSession; TTL propuesto absoluto 12 h, idle 30 min, nunca posterior a ventana o revocación. No localStorage, query string ni token en el bundle.
7. Presentar introducción oficial y aviso de uso aprobado, registrar aceptación explícita y versión; una verificación de email no es consentimiento de participación.
8. Cargar únicamente preguntas y borrador de la sesión autorizada. Guardar en servidor con control de revisión. Al expirar, OTP permite recuperar la misma sesión, sin crear duplicados. Nunca mostrar contenido sólo por poseer enlace o introducir email.
9. Enviar definitivamente mediante POST idempotente, fijar revisión y `submittedAt`, marcar participación y retirar permiso de escritura. Mostrar sólo agradecimiento. Nuevo OTP tras envío devuelve confirmación, no edición ni resultados. Cierre/cancelación revoca acceso ordinario aun con cookie vigente.

Correo y enlace comparten canal: OTP prueba control del buzón y protege contra enlaces reenviados/scanners, pero no es MFA independiente. Un buzón comprometido o compartido sigue siendo riesgo. El intermediario de correo ve dirección y mensaje; no debe recibir respuestas ni puntuaciones.

Rate limiting persistente en MySQL para OTP por invitación, challenge, IP seudonimizada y límite global: propuesta inicial de 3 envíos/15 min e invitación, 10 intentos fallidos/hora/invitación, además del máximo 5/challenge. Límites IP más amplios para oficinas con NAT, ajustados en pruebas; no bloquear todo un diagnóstico por compartir red. Limitación adicional al login, importaciones, guardado y exportación por principal. Incrementos atómicos, expiración, respuesta genérica y Retry-After. No reiniciar contadores con reenvío o creación de nuevo challenge. Si no puede verificarse el límite de OTP, fallar cerrado sin emitir nuevos códigos.

Gestión de sesión y expiración basada en las recomendaciones de [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html); los parámetros concretos anteriores pertenecen a esta propuesta.

## Separación de identidad y respuestas

Invitation contiene email cifrado, estado, perspectiva, segmentos logísticos y digest de enlace. ResponseSession y Response no tienen nombre/email/teléfono, identificador de invitación ni User. ParticipantAccessBinding es la única asociación directa y se mantiene en tabla restringida; sirve a verificación, reanudación y cierre de participación. No se expone a analítica/exportaciones.

Propuesta de privilegios MySQL: rol de acceso con Invitation/challenges/binding; rol analítico con sesiones/respuestas/snapshots y sin Invitation/binding; rol operativo con proyecciones de logística; rol de migración independiente, fuera del runtime. El servicio de captura necesita transacción de envío que actualice sesión e invitación; usar conexión interna con los permisos estrictamente necesarios para esa operación. No pretender que las credenciales separadas aíslan un proceso Node.js completamente comprometido: la aplicación y sus secretos son frontera común.

Cifrar email y abiertas originales en aplicación con cifrado autenticado, nonce único y keyVersion; claves fuera de MySQL, con rotación y respaldo seguro. Cifrar discos/backups y limitar SQL directo. No guardar IP, user agent ni email en tablas analíticas. Redactar incidencias y auditoría para evitar un segundo vínculo indirecto. Las respuestas abiertas pueden contener nombres aunque no existan columnas de identidad; la ausencia de email no las anonimiza.

Tiempos exactos, un solo directivo, puesto singular, sede pequeña y cuenta B2B pueden revelar identidad. Seguimiento al coordinador: totales adecuados al contexto, sin contenido, PI, detalle de cada guardado ni orden de envíos. Puede gestionar entrega de invitaciones; no obtiene automáticamente quién terminó y a qué hora. Recordatorios generales respetuosos; no listados públicos de pendientes ni pruebas de participación (S02 §12).

## Publicación, segmentos y cualitativas

La reportabilidad exige decisión contextual documentada: tamaño, jerarquía, puesto, sede, cruces y texto. No imponer «n<5» como regla metodológica. Estado por defecto PENDING implica no publicar esa desagregación. La revisión se vincula a snapshot, filtros, columnas y audiencia, y aplica al total y a perspectivas pequeñas, no sólo a segmentos explícitos.

Evitar inferencias por diferencias: un total más todos los segmentos salvo uno puede revelar el bloqueado; tampoco publicar RI/BT y los demás RP si permiten deducir un RP protegido. La aprobación evalúa el conjunto de salidas relacionadas. Para el MVP no permitir consultas/cortes arbitrarios interactivos: sólo vistas y filtros previamente revisados. Supresión complementaria puede ocultar más celdas; no recalcular un indicador oficial con una población distinta para disimular la supresión. El motivo de ocultación es de divulgación, no ND matemático.

La revisión cualitativa consulta originales sólo con grant; conserva original y genera texto para reporte con SAFE_FOR_REPORT, REDACTED o DO_NOT_QUOTE. No se exporta REVIEW_PENDING ni DO_NOT_QUOTE a audiencia ordinaria. Desidentificar texto no basta si sus metadatos o contexto revelan a alguien. La interfaz de revisión nunca muestra email o invitación junto a la respuesta.

## Endpoints, entradas y navegador

| Riesgo | Control concreto |
|---|---|
| Permisos de API y mass assignment | Casos de uso autorizan recurso/organización/estado; Zod estricto con lista de campos; cliente no asigna roles, hashes, scores, versiones ni estados internos |
| SQL injection | Prisma parametrizado; SQL excepcional sólo parametrizado y revisado; jamás interpolar filtros/orden/IDs; orden por allowlist ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)) |
| CSRF | Mutaciones por POST/PATCH, validación Origin/Host confiables, token CSRF en flujos propios con cookies; no confiar sólo en SameSite; verificar proxy y protección efectiva de Server Actions ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)) |
| XSS almacenado | Mostrar preguntas y abiertas como texto; sin HTML arbitrario, eval ni dangerouslySetInnerHTML; escape contextual; CSP con nonces donde corresponda |
| Fuga por cache | Respuestas autenticadas, DTO, descargas y páginas de participante con no-store/private; sin cache público de RSC ni CDN; invalidación de permisos inmediata |
| Filtración de enlaces | Referrer-Policy:no-referrer; sin recursos de terceros, analytics ni trackers en /r; sanitizar URL en proxy/APM antes de guardar logs |
| Clickjacking y transporte | TLS, HSTS tras validar dominio, frame-ancestors 'none', nosniff, cookies Secure, redirecciones internas permitidas |
| Abuso de importación | Tamaño/filas máximos, parsear datos sin macros/fórmulas ejecutables, reporte de errores sin PII, previa validación antes de aplicar lote |
| Exposición de IDs | UUID aleatorios; comprobar ownership; errores homogéneos para recursos ajenos; no listar tenants ni sesiones por ID guessed |
| Carreras | Bloqueos de diagnóstico/sesión, optimistic concurrency e idempotencia; cierre, envío y expiración se verifican en backend |
| Permisos por sesión obsoletos | Reconsultar User activo, membresía, asignación y grants en operaciones; no confiar en rol antiguo incluido en cookie |

## Exportaciones

EXP01 y PI de EXP03 son datos individuales sensibles aunque seudonimizados; requieren grant específico. EXP02 original requiere permiso cualitativo y motivo de auditoría. Exportación agregada respeta DisclosureReview y sólo usa texto revisado. EXP04 incluye reglas y metadatos metodológicos, nunca claves ni secretos.

Cada descarga identifica solicitante, propósito, snapshot/run, filtros, columnas, versión de esquema, número de filas y hash del artefacto. Registrar solicitud, generación y descarga; no guardar contenido en AuditLog. No inferir que el cliente recibió por completo un stream sólo porque se inició: registrar estado diferenciable.

CSV UTF-8, escape correcto de comillas/separadores/saltos. Tratar nombres, notas y texto abierto como datos hostiles: pueden iniciar con `=`, `+`, `-`, `@`, tabuladores o saltos. Para mantener exactitud sin ejecutar fórmulas, propuesta de dos perfiles explícitos: CSV para lectura con neutralización y manifiesto del escape; CSV técnico reversible con texto libre codificado (p.ej. base64 UTF-8) y `text_encoding`, con decodificación documentada. Los valores originales de la base nunca se modifican. Un CSV neutralizado para Excel no se usa como fuente de reprocesamiento exacto.

En EXP01 usar seudónimo del paquete distinto del token/invitación; sólo el permiso técnico autoriza fechas exactas y metadata necesaria. En reporte ordinario reducir tiempos y columnas identificables. Los filtros nunca permiten reconstruir un segmento bloqueado. Archivo privado fuera de webroot, URL sin bearer permanente, autenticación y autorización de nuevo al descargar; caducidad técnica propuesta 24 h. Borrar artefactos temporales y registrar purga. CSV por streaming acotado o trabajo del mismo monolito; no diseñador de reportes.

## Auditoría, secretos y operación

AuditLog append-only para cuenta runtime, sin UPDATE/DELETE; mutación metodológica y su auditoría en la misma transacción. Auditoría incluye CREATE, UPDATE, OPEN, CLOSE, FREEZE, REOPEN, EXCLUDE, PROCESS y EXPORT, aprobación/revocación de grants y lecturas sensibles. Si no puede auditarse una acción metodológica, no confirmarla silenciosamente. Metadata por allowlist; actorRef analítico no debe almacenar el ID de invitación.

AuditLog no es event sourcing ni garantiza resistencia absoluta al administrador de MySQL. Backups cifrados fuera del host y controles de administración permiten detectar/recuperar alteraciones; hash de snapshot verifica integridad respecto de copia confiable. Registrar accesos operativos a backups y claves.

Secrets separados por entorno y propósito: DB, firma/auth, digest/HMAC OTP, lookup de email, cifrado, SMTP. No commit, no NEXT_PUBLIC_, no cuerpos sensibles en logs. Rotación con keyVersion y conservación controlada de claves necesarias para históricos. Runtime con mínimo privilegio; credencial de migración sólo durante despliegue. Desactivar exposición pública de MySQL; TLS a DB si cruza red; limitar backups y consola de servidor.

Ambientes separados y datos sintéticos en tests. Dependencias fijadas y revisión de vulnerabilidades antes de despliegue. Respaldo/restauración debe recuperar catálogo, originales, snapshots, runs y claves bajo acceso separado; practicar reproducción después de restaurar. RPO/RTO, retención y derechos de retiro se acuerdan antes del piloto (GAP-012), sin inventar obligaciones jurídicas ni afirmar cumplimiento legal no evaluado.

## Riesgos residuales y pruebas de liberación

El custodio del servidor puede acceder a datos/claves; email puede estar comprometido; textos pueden identificar; segmentos pequeños y múltiples reportes pueden permitir inferencia; nuevas versiones pueden introducir drift; backups pueden perder claves. Documentar estas limitaciones en el aviso aprobado y procedimiento operativo.

Pruebas exigidas: acceso cruzado entre organizaciones y entre sesiones; roles y grants expirados/revocados; scanner GET sin efectos; OTP vencido/replay/fuerza bruta/reenvío concurrente; token rotado; recuperación del mismo borrador; envío repetido y carrera con cierre; rechazo de escritura tras envío/freeze; datos sensibles ausentes en logs/DTO; SQL/XSS/CSRF; cache entre usuarios; CSV malicioso; descarga sin permisos; reidentificación por complementos; restauración e integridad histórica. Ningún fallo de estos controles críticos se difiere para después de participantes reales.

## Controles ejecutables de Phase 1

Autenticación propia local: Argon2id (19 MiB, 2 iteraciones, paralelismo 1, salt estándar), bearer aleatorio de 32 bytes y SHA-256 persistido. Cookie HttpOnly host-only, Path=/, SameSite=Lax; Secure y prefijo __Host- en producción. TTL absoluto 8h e inactividad 30min configurables. Cada operación protegida comprueba usuario activo y sesión no revocada/vencida. Logout es POST y revoca en DB; el token anterior se rechaza. Usuario deshabilitado se rechaza y sus sesiones no revocadas se marcan al detectar el estado.

Membresía activa + organización activa autoriza metadata de consultor/coordinador. TECH_ADMIN tiene rama explícita de lectura de metadata técnica; no supera los helpers de membresía. No hay permisos analíticos implementados. Página ajena y UUID inexistente producen 404. UUID no reemplaza autorización.

Login/logout exigen Origin exacto contra APP_ORIGIN. Referrer-Policy strict-origin-when-cross-origin conserva Origin de formularios legítimos; una política no-referrer hizo fallar logout durante E2E y fue corregida sin aceptar Origin null. GET no muta. JSON acotado y validado con Zod; Prisma parametriza consultas; no HTML sin escapar. Errores públicos genéricos, logs internos con código fijo sin objeto Error/SQL/secreto. Auditoría registra cuatro acciones básicas sin credenciales ni email intentado.

Limitador en memoria acotado, no distribuido: 10 intentos/correo/15min, 60 globales/minuto; claves HMAC con AUTH_SECRET. Reinicios borran contadores y un atacante puede consumir presupuesto global: confirmar límite de proxy antes de exposición sostenida. CSP implementada solo para frame-ancestors/base-uri/form-action/object-src; no prometer CSP con nonce. No cachear páginas autenticadas en CDN/proxy. Backups, DB TLS, privilegios runtime, retención de auditoría y operación productiva requieren checklist de infraestructura. No hay exports, OTP ni respuestas sensibles todavía.

## Controles añadidos en Phase 2

Todas las mutaciones de workspace repiten autenticación y comprueban en MySQL la membresía IEO_CONSULTANT activa, organización activa y estado DRAFT antes de escribir. Coordinadores sólo leen; TECH_ADMIN sin membresía ve metadata mínima. La creación de organización, membresía, diagnóstico, cinco perspectivas y auditoría es transaccional. Los responsables seleccionados se revalidan server-side por rol y organización. Segmentos de otra organización no se pueden editar ni desactivar.

Las rutas JSON exigen Origin exacto de Phase 1, tamaño máximo 16 KiB y Zod; Prisma usa consultas parametrizadas. Errores internos no muestran SQL ni secrets. AuditLog añade sólo acción, actor, organización, diagnóstico, entidad, estado previo/nuevo o nombres de campos cambiados; nunca objetivo, notas, sponsor o credenciales en metadata. Reportabilidad es una declaración del consultor y permanece separada de la futura revisión de divulgación. No hay contenido de respuestas en Phase 2.
