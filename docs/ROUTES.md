# Rutas y operaciones propuestas

> **Alcance incremental:** este documento conserva la arquitectura objetivo de Phase 0. Phase 1 implementa únicamente login local, sesiones, membresías organizacionales, metadata de diagnósticos y auditoría básica con seis entidades. OIDC, SensitiveAccessGrant, DisclosureReview, procesamiento/worker, revisiones detalladas y correo: **Deferred / Not implemented in Phase 1**. El alcance vigente está en [PHASE1_DECISIONS.md](PHASE1_DECISIONS.md); las rutas y entidades futuras de este documento no implican implementación actual.

Diseño contractual; no hay endpoints ni Server Actions implementados. Las vistas se detallan en [SCREEN_MAP.md](SCREEN_MAP.md). Todas las operaciones pasan por los mismos casos de uso autorizados, independientemente de su transporte. Las entradas de esta tabla son orientativas para Phase 1, no funciones de producción.

## Rutas de navegación

| Ruta | Uso y acceso |
|---|---|
| `/` | Redirige a `/diagnosticos` o `/login` según sesión administrativa |
| `/login` | Inicio de sesión administrativo; no alta pública |
| `/diagnosticos` | Lista filtrada por membresía/asignación; creación en diálogo |
| `/diagnosticos/[id]` | Workspace; tab General por defecto |
| `/diagnosticos/[id]?tab=general` | Ficha de alcance, responsables, versiones y panel de auditoría |
| `/diagnosticos/[id]?tab=perspectivas` | Cinco perspectivas, población, muestra/censo, segmentos y unidad CLI |
| `/diagnosticos/[id]?tab=participantes` | Invitados, importación y entrega, sin contenido analítico |
| `/diagnosticos/[id]?tab=seguimiento` | Participación agregada e incidencias |
| `/diagnosticos/[id]?tab=cierre` | Validación, dictámenes, acta, freeze y procesamiento |
| `/diagnosticos/[id]?tab=resultados&view=matriz` | Run autorizado; vista inicial de resultados |
| `/diagnosticos/[id]?tab=resultados&view=evidencia` | Revisión cualitativa protegida |
| `/diagnosticos/[id]?tab=resultados&view=exportaciones` | Generación y descarga autorizada |
| `/r/[token]` | Entrada sin efectos sobre participación en GET; enlace secreto sólo aquí |
| `/r/acceso` | Verificación OTP ligada al contexto previo y navegador |
| `/r/introduccion` | Intro/aviso del instrumento y aceptación explícita |
| `/r/cuestionario` | Preguntas y borrador propios; sesión temporal, sin token en URL |
| `/r/gracias` | Confirmación tras envío; sin scores, semáforo ni prueba descargable |

No usar `/r/[token]/cuestionario`: mantener el bearer en cada URL multiplica filtraciones. Los segmentos estáticos `/r/acceso`, `/r/introduccion`, `/r/cuestionario`, `/r/gracias` son reservados y prevalecen frente al dinámico; tokens base64url largos no coinciden con esos nombres. Query params `tab`, `view`, `run`, `perspective`, `element` se validan por allowlist y autorización. Cambiar una URL no cambia permisos.

Rutas de Auth.js/proveedor bajo `/api/auth/[...nextauth]`, si se confirma Auth.js. Callbacks son técnicos, no pantallas extra. No dar de alta participantes mediante este flujo.

## Lecturas administrativas

Preferir carga en servidor mediante casos de uso, sin duplicar una API REST para todo. Cada lectura valida sesión, organización, asignación, permiso de campo y estado:

| Consulta de aplicación | Entrada autorizada | Salida mínima |
|---|---|---|
| `listAssessments` | Principal, filtros/paginación | Diagnósticos asignados; T sólo metadata técnica |
| `getWorkspace` | Assessment ID + tab | DTO específico C/O/T; sin datos ocultos incluidos en props |
| `getParticipationSummary` | Diagnóstico y filtros autorizados | Conteos agregados; no PI ni vínculo |
| `getInvitationDelivery` | Diagnóstico, página | Email operativo y estado de entrega; sin token ni tiempos analíticos |
| `getClosureReview` | Consultor asignado | Integridad, cobertura contextual, incidencias, dictámenes y acta |
| `getProcessingStatus` | Diagnóstico/run propio | Estado y error técnico redactado; sin resultados incompletos |
| `getResults` | Snapshot/run SUCCEEDED y audiencia | Matriz filtrada por DisclosureReview; ND/NP/LIMITED separados |
| `getQualitativeEvidence` | Run/filtros; grant para original | Texto revisado o original sólo con permiso; sin identidad |
| `getAuditLog` | Diagnóstico y filtros acotados | Bitácora redactada; sin secretos ni respuestas |

Si el cliente requiere polling de procesamiento, usar `GET /api/diagnosticos/[id]/procesamientos/[runId]`; mismo caso de uso y permisos. No exponer un buscador global de respuestas/sesiones.

## Server Actions administrativas

Los nombres identifican comandos futuros. Son POST bajo transporte de Next.js y no una barrera de seguridad por tener nombre opaco. Cada comando revalida permisos en servidor.

| Acción | Rol/precondición | Entrada esencial | Efecto atómico y auditoría |
|---|---|---|---|
| `createOrganizationAndAssessment` | C autorizado a crear en organización o nueva | Nombre, propósito, periodo, paquete | Organización/diagnóstico/ficha y cinco perspectivas; CREATE |
| `saveScope` / `configurePerspective` | C; DRAFT/TEST | Campos permitidos + rowVersion | Validar paquete, población, estado y motivo; UPDATE |
| `recordTechnicalChecklist` / `openAssessment` | C; TEST, catálogo certificado, pruebas separadas | Evidencia/checklist, fechas | OPEN con versiones fijadas y autorización |
| `previewParticipantImport` | C/O asignado | CSV acotado | Informe de errores/duplicados sin persistir lote todavía |
| `applyParticipantImport` | C/O, población aprobada | Lote validado y clave idempotente | Invitations/segmentos; no Users; CREATE |
| `sendInvitations` / `reissueInvitation` / `cancelInvitation` | C/O, misma organización/ventana | IDs operativos y motivo | MailDelivery, rotación/revocación; UPDATE; sin devolver bearer |
| `sendGeneralReminder` | C/O, OPEN y comunicación aprobada | Plantilla aprobada y alcance | Recordatorio no coercitivo; límites de frecuencia y auditoría |
| `recordIncident` / `resolveIncident` | C/O para hechos propios; C valida impacto | Descripción/acción sin respuesta cruda | INCIDENT_CREATE/UPDATE |
| `extendWindow` | C, razón y protocolo | Nueva fecha, rowVersion | Cambio auditado; no modificar alcance en secreto |
| `closeAssessment` | C, OPEN | Motivo, expectedVersion | CLOSED; frena recepción ordinaria; CLOSE |
| `recordQualityReview` | C, CLOSED | Ámbito, dimensiones, A/B/C, reservas, elegibilidad aprobada | QualityAssessment; UPDATE |
| `authorizeExclusion` | C, CLOSED y competencia metodológica | Target tipado, motivo, evidencia | Exclusion sin DELETE; EXCLUDE; reglas GAP-010 |
| `freezeAssessment` | C, CLOSED, revisión/acta completas | Acta y autorización explícita | Snapshot+hash+ClosureRecord+FROZEN; FREEZE |
| `requestProcessing` | C, snapshot autorizado y reglas resueltas | Snapshot, motor permitido, ámbito ALL/corte autorizado, idempotencyKey | ProcessingRun QUEUED; PROCESS; no calcular largo dentro del request |
| `reopenAssessment` | Grant y política GAP-010 aprobada | Motivo, snapshot previo, alcance de corrección | Nueva revisión, mantiene histórico; REOPEN |
| `reviewDisclosure` | C competente, snapshot específico | Audiencia, filtros, riesgo, decisión | DisclosureReview revisionada; revisar inferencias por complementos |
| `reviewQualitativeResponse` | C con grant de revisión | Original congelado, texto para reporte y estado | QualitativeReview; original intacto; UPDATE |
| `recordTriangulationInterpretation` | C, protocolo disponible | Run/Elemento, patrón, evidencia y nota | Interpretación profesional versionada; sin sobrescribir scores |
| `requestExport` | C o principal con grants específicos | EXP01–04, propósito, snapshot/run, audiencia/filtros | ExportRecord + evento EXPORT; datos filtrados por política |
| `manageAdminAccess` | T, reautenticación | User/membresía/asignación | Altas/revocaciones auditadas; no autoasignar acceso sensible |
| `grantSensitiveAccess` | Sólo autoridad definida por GAP-011 | Permiso, propósito, diagnóstico, vigencia, destinatario | Grant auditado; no autoaprobación ni herencia por cargo |

Importación de catálogo mediante comando administrativo controlado de despliegue y publicación aprobada; no editor visual ni endpoint público para subir reglas ejecutables. Validación de source/hash/metadatos y auditoría son obligatorias.

## API del participante

Una API mínima explícita facilita autoguardado y verificación; la sesión de participante es independiente de Auth.js.

| Método/ruta | Autorización y entrada | Respuesta y efectos |
|---|---|---|
| `POST /api/participante/acceso/iniciar` | Token válido, navegador, CSRF, rate limit; ventana | Crear contexto/challenge y solicitar OTP; respuesta genérica; nunca respuestas |
| `POST /api/participante/acceso/reenviar` | Cookie previa/contexto vigente, CSRF y límites | OTP nuevo, invalida anterior sin reiniciar presupuesto de intentos |
| `POST /api/participante/acceso/verificar` | Challenge, OTP, binding navegador | Consumir atómicamente; cookie temporal y ruta destino, no bearer en JSON |
| `POST /api/participante/introduccion/aceptar` | Sesión temporal verificada | Consentimiento/intro versionada y hora; permitir cuestionario |
| `GET /api/participante/cuestionario` | Sesión propia, intro aceptada, ventana/estado | DTO de instrumento y borrador; sin orientación ni datos de otros |
| `PATCH /api/participante/respuestas` | Cookie propia + CSRF; OPEN y no SUBMITTED | Lista de questionVersionId y valores, expectedRevision; guardar revisiones; devolver revisión confirmada |
| `POST /api/participante/enviar` | Cookie propia + CSRF; OPEN, contrato oficial | Revisar última revisión e idempotencyKey; fijar envío; confirmación sin resultados |
| `POST /api/participante/salir` | Sesión/cookie + CSRF | Revocar credencial y borrar cookie; no borrar borrador |

El backend deriva ResponseSession, instrumento, perspectiva y diagnóstico del vínculo autorizado; no acepta esos campos para reasignar respuestas. El envío no acepta un score, raw recodificado ni un ID de invitación. Cada questionVersionId se comprueba contra la versión de esa sesión. `GET` no consume enlace ni OTP, no inicia cuestionario, no marca completado.

La reanudación repite OTP y recupera la misma ResponseSession mediante UNIQUE del binding. Tras envío devuelve sólo confirmación. Si el diagnóstico cierra mientras se escribe, el servidor rechaza nuevos cambios y conserva el último guardado; inclusión analítica de borradores permanece en GAP-005.

## Descargas y contratos comunes

`GET /api/diagnosticos/[id]/exportaciones/[exportId]/descargar`: sólo artefacto previamente solicitado, autenticación administrativa vigente, pertenencia, grant y DisclosureReview todavía válidos. Auditar inicio/resultado de descarga. Nunca URL pública con email, invitationId o token del participante. La descarga puede registrar auditoría, pero no modifica la base metodológica.

JSON de error con `code`, mensaje seguro, errores de campo y correlationId sin PII. 401 sin sesión, 403 sin permiso cuando revelar existencia es adecuado, 404 homogéneo para recurso ajeno, 409 conflicto de revisión/estado, 422 entrada inválida, 429 límite y Retry-After. Errores de OTP genéricos; nunca revelar si un email externo existe.

Mutaciones metodológicas incluyen `expectedVersion`; envío/procesamiento/importación incluyen clave de idempotencia acotada al principal y operación. Repetir una petición exitosa devuelve su resultado previo; reutilizar clave con payload distinto se rechaza. No usar GET para mutaciones. Cache-Control:no-store en participante, lecturas sensibles, polling y exportación. No CORS abierto con credenciales. Los route groups internos de Next.js no cambian estas URLs ni sustituyen autorización.

## Rutas implementadas en Phase 1

| Ruta | Método | Comportamiento actual |
|---|---|---|
| / | GET | Redirige a login o diagnósticos según sesión |
| /login | GET | Formulario; autenticado redirige a diagnósticos |
| /diagnosticos | GET | Consulta autorizada a MySQL; metadata mínima |
| /diagnosticos/[id] | GET | Shell autorizado; 404 si ajeno/inexistente |
| /api/auth/login | POST | Origin, JSON/Zod, límite de intentos, password, creación de sesión y cookie |
| /api/auth/logout | POST | Origin, revocación servidor, borrado cookie, 303 login |

No APIs CRUD, server actions futuras, rutas de participante ni rutas metodológicas están implementadas. GET de las mutaciones devuelve 405.
