# Modelo de datos propuesto

> **Alcance incremental:** este documento conserva la arquitectura objetivo de Phase 0. Phase 1 implementa únicamente login local, sesiones, membresías organizacionales, metadata de diagnósticos y auditoría básica con seis entidades. OIDC, SensitiveAccessGrant, DisclosureReview, procesamiento/worker, revisiones detalladas y correo: **Deferred / Not implemented in Phase 1**. El alcance vigente está en [PHASE1_DECISIONS.md](PHASE1_DECISIONS.md); las rutas y entidades futuras de este documento no implican implementación actual.

Estado: diseño lógico para MySQL; no es un schema Prisma ni una migración. Fuentes S01–S12 identificadas en [ARCHITECTURE.md](ARCHITECTURE.md). Los nombres en PascalCase son entidades propuestas; los códigos metodológicos existentes se conservan exactamente. `Assessment` equivale a diagnóstico y `Question` al reactivo/pregunta oficial.

## Convenciones MySQL y garantías

MySQL 8.x con InnoDB, `utf8mb4`, fechas `DATETIME(3)` UTC y zona de aplicación IANA guardada en Assessment. Propuesta: MySQL 8.4 si el servidor lo permite; verificar versión exacta antes de migraciones. UUID aleatorio de aplicación en `CHAR(36)` con collation binaria para IDs; hashes en `BINARY(32)`, secretos cifrados en `VARBINARY`/`BLOB` con nonce y keyVersion. Códigos metodológicos en `VARCHAR` con collation sensible a mayúsculas para que su unicidad sea inequívoca; textos humanos en utf8mb4. Enteros de conteo no negativos, `BOOLEAN` con CHECK cuando corresponda.

Valores de consulta de resultados `DECIMAL(30,18)` nullable; no utilizarlos como entradas redondeadas de la siguiente etapa. El artefacto canónico conserva fracciones exactas (numerador/denominador como cadenas) y los datos para recomputarlas. Toda división indefinida produce ausencia de valor controlada; no NaN, Infinity ni cero fabricado. Ver GAP-006/007/008.

FK reales con `relationMode=foreignKeys`; no emulación de integridad. MySQL requiere coherencia de tipo/collation entre columnas relacionadas. Usar índices únicos compuestos para FKs de pertenencia. Las reglas entre filas (estado del diagnóstico o pregunta del instrumento correcto) requieren transacciones/aplicación, no sólo CHECK. Prisma documenta los [modos de relación](https://docs.prisma.io/docs/orm/prisma-schema/data-model/relations/relation-mode); MySQL documenta [CHECK](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html). Revisar SQL generado y agregar restricciones soportadas mediante migraciones revisadas cuando Prisma no las exprese.

Por defecto `ON DELETE RESTRICT` en metodología, respuestas, diagnósticos, snapshots y resultados. No borrados en cascada de evidencia. Desactivar usuarios y versiones referenciadas. Purga de credenciales temporales sí puede eliminar registros caducados conforme a política técnica; retención de evidencia pendiente de GAP-012. `createdAt`, `createdBy` (FK User administrativo cuando aplique), y `updatedAt` acompañan entidades mutables. Actor participante se representa como principal de sesión, no como User.

Cada entidad de diagnóstico porta `organizationId` y `assessmentId` cuando tiene acceso independiente. Parent keys `UNIQUE(organizationId,id)` y `UNIQUE(organizationId,assessmentId,id)` permiten FKs compuestas que impiden cruces de organización. Esto refuerza integridad, pero no sustituye autorización en servidor.

## Organización, administración y alcance

| Entidad | Propósito y campos relevantes | Relaciones y restricciones |
|---|---|---|
| Organization | `id`, `name`, `status`, timestamps | Padre de diagnósticos y membresías; no copiar nombres en cada respuesta |
| User | Sólo administrativo: `id`, `email`, `name?`, `status`, `emailVerifiedAt?`, `technicalAdmin` | Email normalizado único; ningún participante se registra aquí |
| AdminAccount | Identidad externa: `id`, `userId`, `provider`, `providerAccountId`, tokens cifrados sólo si necesarios | FK User; UNIQUE(provider,providerAccountId). No vincular automáticamente proveedores por email no verificado |
| AdminSession | `id`, `userId`, `tokenHash`, `expiresAt`, `lastSeenAt`, `revokedAt?` | FK User; tokenHash único; índice(userId,expiresAt). Adaptador de auth deberá persistir digest, no bearer en claro |
| OrganizationMembership | `organizationId`, `userId`, `role`=IEO_CONSULTANT/ORG_COORDINATOR, `active` | PK(organizationId,userId,role); FK Organization/User |
| AssessmentAssignment | `organizationId`, `assessmentId`, `userId`, `role` | PK(assessmentId,userId,role); FK membresía con organización/rol y FK Assessment. Restringe acceso a diagnósticos asignados |
| Assessment | `id`, `organizationId`, `name`, `purpose`, `period`, `timezone`, `opensAt`, `plannedClosesAt`, `openedAt?`, `closedAt?`, `status`, `revisionNumber`, `methodologyPackageId`, `rowVersion` | FK Organization/MethodologyPackage; índice(organizationId,status,createdAt), CHECK opensAt<plannedClosesAt; UNIQUE(organizationId,id) |
| AssessmentScope | Una ficha por revisión: `id`, `assessmentId`, `revisionNumber`, unidades/sedes incluidas, población total estimada, modalidad, exclusiones de alcance, propósito, sponsor, consultor/coordinador/técnico, `approvedBy`, `approvedAt`, `changeReason` | FK Assessment y usuarios responsables cuando tienen cuenta; UNIQUE(assessmentId,revisionNumber). Campos estructurados o JSON validado para unidades sin crear un ERP de sedes |
| AssessmentPerspective | `id`, `organizationId`, `assessmentId`, `perspectiveCode`, `instrumentVersionId`, `status`=APPLICABLE/NOT_APPLICABLE/NOT_AVAILABLE, `populationEstimate`, plan censo/muestra, diversidad, reservas, unidad CLI B2B/B2C y temporalidad | UNIQUE(assessmentId,perspectiveCode); crear exactamente DIR/ESP/LID/COL/CLI por transacción. FK Perspective e InstrumentVersion con misma perspectiva |
| Segment | `id`, `assessmentId`, `dimension`, `code`, `label`, `purpose`, `active` | UNIQUE(assessmentId,dimension,code); dimensiones autorizadas por alcance; no nombres de participantes |
| InvitationSegment | `organizationId`, `assessmentId`, `invitationId`, `segmentId` | PK(invitationId,segmentId); FKs compuestas al mismo diagnóstico |
| SessionSegment | `organizationId`, `assessmentId`, `responseSessionId`, `segmentId` | PK(responseSessionId,segmentId); metadatos analíticos autorizados copiados al crear sesión y fijados por snapshot, sin FK a Invitation |

El sponsor ejecutivo no necesita una cuenta para figurar en alcance/acta. Un directivo que responde DIR es participante; una eventual membresía administrativa es independiente y no confiere permisos por el cargo. `technicalAdmin` habilita mantenimiento y altas, no lectura analítica automática.

Conteos de invitados/respuestas son derivados; no editar `invited_count` manualmente. Conservar conteos al congelar para reproducir el acta. En B2B documentar concentración por cuenta con etiqueta seudónima autorizada; no inferir que contactos son clientes independientes ni introducir ponderación por cuenta (S02 §14, S03 §8). Un identificador de cuenta raro también puede reidentificar y se somete a reportabilidad.

## Catálogo y versiones inmutables

| Entidad | Propósito y campos relevantes | FK, índices y restricciones |
|---|---|---|
| Perspective | `code` PK DIR/ESP/LID/COL/CLI, `name`, significado | Cinco códigos estables |
| Element | `code` PK E01–E08, `order`, `name` oficial | UNIQUE(order); integración por Elemento, no por correspondencia uno a uno entre preguntas |
| SourceArtifact | `id`, `kind`, `filename`, `declaredVersion`, `sha256`, `privateStorageKey`, `receivedAt`, `status`, `certifiedBy?` | UNIQUE(kind,sha256); registrar origen y diferencias; hash desconocido no se inventa |
| MethodologyVersion | `id`, `component`=BANK/DICTIONARY/MATH/APPLICATION_PROTOCOL/TRIANGULATION_PROTOCOL, `version`, `sourceArtifactId`, `effectiveFrom`, `effectiveTo?`, `approvedBy?`, `status`, `rulesSchemaVersion`, `rulesJson` | UNIQUE(component,version); FK SourceArtifact. Reglas como datos validados, nunca código/eval subido |
| MethodologyPackage | `id`, `code`, `version`, FKs explícitas `bankVersionId`, `dictionaryVersionId`, `mathVersionId`, `applicationProtocolVersionId`, `triangulationProtocolVersionId`, `manifestHash`, `status`, `publishedAt`, `publishedBy` | UNIQUE(code,version); validar tipo de cada componente antes de publicar; no publicar paquete incompleto |
| PackageInstrument | `packageId`, `perspectiveCode`, `instrumentVersionId` | PK(packageId,perspectiveCode); FK a versión de misma perspectiva; exactamente cinco al publicar |
| Instrument | `id`, `code`, `perspectiveCode`, `name` | UNIQUE(code), FK Perspective |
| InstrumentVersion | `id`, `instrumentId`, `perspectiveCode`, `version`, `sourceArtifactId`, `contentHash`, `status`, `effectiveFrom`, `effectiveTo?`, presentación, objetivo, confidencialidad, elegibilidad, instrucciones, agradecimiento, periodo de referencia, duración documentada | UNIQUE(instrumentId,version); UNIQUE(id,perspectiveCode); publicación inmutable |
| Scale | `code` PK LIKERT_1_5 | Identidad conceptual |
| InstrumentScaleOption | `instrumentVersionId`, `valueCode`=1…5/NA, `label`, `displayOrder` | PK(instrumentVersionId,valueCode); etiquetas exactas por instrumento; DIR no tiene NA |
| InstrumentSection | `id`, `instrumentVersionId`, `elementCode?`, `title`, `introduction`, `instructions`, `displayOrder` | UNIQUE(instrumentVersionId,displayOrder); FK Element nullable para sección general CLI |
| Question | `id` UUID interno, `instrumentId`, `officialCode`, `sourceStableId` ITEM-xxxx/OPEN-xxx, `type` QUANT/OPEN | UNIQUE(instrumentId,officialCode); identidad lógica permanente, código no reciclable |
| QuestionVersion | `id`, `questionId`, `instrumentVersionId`, `sectionId`, `elementCode?`, `text`, `orientation?`, `scaleCode?`, `allowNA`, `required?`, `officialOrder`, `orderInElement?`, `displayOrder`, `active`, `sourceGlobalId?`, `sourceOfficialCode?`, `sourceLocator` | UNIQUE(instrumentVersionId,questionId), UNIQUE(instrumentVersionId,displayOrder); FK Question/Section/Element/Scale; QUANT exige Elemento, DIRECT/REVERSE y escala; OPEN no tiene score/orientación |

No crear conflicto de UNIQUE entre cuantitativos y abiertas: ambos usan números oficiales que pueden repetirse, por eso `displayOrder` es otra columna. Preservar `officialCode`, `sourceOfficialCode` (p.ej. COL-LI-01), `sourceStableId` y UUID interno con significados distintos. La versión de pregunta identifica el texto realmente mostrado. `required=NULL` representa metadato sin resolver sólo en staging; no publicar instrumento con obligatoriedad pendiente de GAP-004. No inferir inversos por análisis lingüístico.

Cada AssessmentPerspective referencia además la combinación `(methodologyPackageId,perspectiveCode,instrumentVersionId)` permitida por PackageInstrument, mediante índice único de esa terna. Mantener `methodologyPackageId` coherente con Assessment mediante FK compuesta. Esto impide elegir una versión fuera del paquete fijado.

## Identidad / participación frente a contenido

### Invitation

`id`, `organizationId`, `assessmentId`, `assessmentPerspectiveId`, `emailCiphertext`, `emailLookupHmac`, `keyVersion`, `tokenHash`, `tokenGeneration`, `expiresAt`, `status` CREATED/SENT/OPENED/COMPLETED/EXPIRED/CANCELLED, `sentAt?`, `verifiedAt?`, `completedAt?`, `isTest`, `deliveryStatus`, `createdBy`.

FK compuesta a AssessmentPerspective. TokenHash único. Índices `(assessmentId,assessmentPerspectiveId,status)` y `(assessmentId,assessmentPerspectiveId,emailLookupHmac)`; propuesta de unicidad para impedir segunda invitación accidental a la misma dirección/perspectiva en el mismo diagnóstico. Cancelar/rotar reutiliza invitación; no crea segunda sesión. La validación de poblaciones decide si alguien participa en más de una perspectiva; el sistema no asigna perspectivas por título. Emails compartidos requieren revisión de población, no tratarlos como dos personas automáticamente.

`OPENED` no significa GET recibido ni participación. Se registrará sólo tras verificación interactiva; no se necesita rastreo de apertura de correo. No guardar `access_token` en claro aunque el diccionario conceptual use ese nombre: su implementación es tokenHash. EmailLookupHmac usa clave de búsqueda y dominio de organización; no hash simple de correo enumerable.

### ParticipantAccessBinding — vínculo restringido

`id`, `organizationId`, `assessmentId`, `invitationId`, `responseSessionId`, `createdAt`, `revokedAt?`.

FKs compuestas a Invitation y ResponseSession del mismo diagnóstico; UNIQUE(invitationId), UNIQUE(responseSessionId). Tabla separada con privilegios exclusivos del módulo de acceso y servicio de captura. No accesible por repositorio de resultados, exportador analítico ni coordinador. El vínculo es reversible para la aplicación autorizada: no llamarlo anonimato. No poner `invitationId` en ResponseSession ni usar el mismo UUID en ambas. El diagrama representa el vínculo precisamente para hacer visible esta limitación.

### AccessChallenge, ParticipantAuthSession y correo

| Entidad | Campos | Restricciones |
|---|---|---|
| AccessChallenge | `id`, `invitationId`, `tokenGeneration`, `browserBindingHash`, `otpHmac`, `keyVersion`, `expiresAt`, `attempts`, `consumedAt?`, `invalidatedAt?`, `createdAt` | FK Invitation; índice(invitationId,createdAt); consumo atómico y presupuesto global de intentos; HMAC vinculado a challenge/invitación/propósito |
| ParticipantAuthSession | `id`, `accessBindingId`, `tokenHash`, `expiresAt`, `idleExpiresAt`, `revokedAt?`, `createdAt` | FK binding; tokenHash único; índice(accessBindingId,expiresAt); cookie opaca separada de admin; no es ResponseSession |
| RateLimitBucket | `scope`, `keyHmac`, `windowStart`, `count`, `blockedUntil?`, `expiresAt` | PK(scope,keyHmac,windowStart); incrementos atómicos compartidos entre procesos; sin IP en claro |
| MailDelivery | `id`, `invitationId?`, `challengeId?`, `kind`, `status`, `attemptCount`, `nextAttemptAt`, `providerMessageId?`, `encryptedPayload?`, `expiresAt`, `lastErrorCode?` | FK respectivas; índice(status,nextAttemptAt); payload efímero cifrado, purgado tras envío/expiración; sin cuerpos en logs |

Mailer es adaptador de infraestructura; no envía datos de respuestas. Secrets de correo y cifrado viven fuera de estas tablas. El token sólo existe en claro transitoriamente al crear el mensaje y en el navegador del destinatario.

### ResponseSession y respuestas

`ResponseSession`: `id`, `organizationId`, `assessmentId`, `assessmentPerspectiveId`, `instrumentVersionId`, `status` STARTED/SUBMITTED/INVALIDATED, `startedAt`, `submittedAt?`, `introAcceptedAt?`, `introContentHash`, `consentVersion`, `currentRevision`, `rowVersion`, `isTest`, `invalidatedReason?`. FK al AssessmentPerspective y su instrumento/version exactos; UNIQUE(organizationId,assessmentId,id). Sin nombre, email, teléfono, User, invitationId, IP ni user agent. Tiempos exactos son internos restringidos; no se exponen al coordinador ni se exportan libremente.

`Response` (equivale a quantitative_response): `id`, `organizationId`, `assessmentId`, `responseSessionId`, `questionVersionId`, `instrumentVersionId`, `revision`, `answerState` ANSWERED/MISSING, `rawResponse`=1/2/3/4/5/NA o NULL sólo para MISSING, `answeredAt`, `supersedesResponseId?`.

`OpenResponse`: mismas claves de pertenencia y revisión; `responseTextCiphertext?`, `answerState`, `answeredAt`, `supersedesOpenResponseId?`, `keyVersion`. El cifrado del texto preserva el valor original recuperable. Texto vacío no significa NA.

Propuesta técnica para conciliar autoguardado con originales inmutables: cada cambio crea una revisión de respuesta, no sobrescribe `rawResponse`; el envío fija la revisión final. Es historial local de respuestas, no event sourcing del sistema. `UNIQUE(responseSessionId,questionVersionId,revision)` y FK de supersedes al mismo par sesión/pregunta. Un contador de sesión y bloqueo optimista evitan carreras entre pestañas; la selección vigente es la última revisión hasta el corte enviado/congelado. Borrar una selección crea un estado MISSING, preservando su historial. Estas revisiones no se muestran como bitácora al coordinador.

Una pregunta todavía no guardada no necesita fila: la lista de preguntas de la versión permite reconstruir MISSING. La combinación `rawResponse=NA` se distingue de `answerState=MISSING,rawResponse=NULL`. `is_na` de exportación es derivado; no mantener dos campos editables contradictorios. FK compuestas con `instrumentVersionId` impiden responder preguntas de otro instrumento; aplicación y CHECK controlan tipo QUANT/OPEN, estado y `allowNA`. Un valor prohibido se rechaza, no se transforma en missing/NA.

## Validación, cierre y divulgación

| Entidad | Campos y propósito | Restricciones |
|---|---|---|
| Incident | `id`, ámbito diagnóstico/perspectiva, `type`, `description`, `impact` HIGH/MEDIUM/LOW, `actionTaken`, `status`, `createdBy/At`, `resolvedAt?` | FK Assessment/Perspective/User; texto protegido; índice(assessmentId,status). No almacenar una respuesta cruda en metadata |
| Exclusion | `id`, `assessmentId`, `revisionNumber`, `responseSessionId?`, `responseId?`, `reasonCode`, `reasonDescription`, `authorizedBy/At`, `supersedesExclusionId?` | Exactamente un target tipado por CHECK; FK real, no recordId sin integridad. Sesiones de prueba excluidas. Exclusión por reactivo/denominador pendiente GAP-010 |
| QualityAssessment | `id`, `assessmentId`, `revisionNumber`, `scopeType`, `perspectiveCode?`, `elementCode?`, `verdict` A/B/C, `integrityReview`, `coverageReview`, `diversityReview`, `independenceReview`, `incidentReview`, `reservations`, `analysisEligibility?`, `reviewedBy/At` | FKs de ámbito y autor; `scopeKey` no nula derivada del ámbito + UNIQUE(assessmentId,revisionNumber,scopeKey) evita el problema de UNIQUE con NULL en MySQL; elegibilidad conforme GAP-009 |
| ClosureRecord | `id`, `assessmentId`, `revisionNumber`, `scopeId`, `checklistJson`, `actaJson`, `actaSchemaVersion`, `authorizedBy`, `authorizedAt`, `actaHash` | UNIQUE(assessmentId,revisionNumber); FK Scope/User; checklist con 16 puntos Sí/No/N/A y observaciones; JSON validado con todos los campos del anexo E |
| DisclosureReview | `id`, `assessmentId`, `snapshotId`, `audience`, `scopeKey`, `filtersJson`, `riskFactorsJson`, `decision` PENDING/APPROVED/BLOCKED, `allowedColumns`, `reason`, `reviewedBy/At`, `revision` | FKs snapshot/User; UNIQUE(snapshotId,audience,scopeKey,revision); política para total, perspectiva, segmento o cruces; no sólo un boolean en Segment |
| QualitativeReview | `id`, `openResponseId`, `snapshotId`, `revision`, `status` REVIEW_PENDING/SAFE_FOR_REPORT/REDACTED/DO_NOT_QUOTE, `reportText?`, `reviewedBy/At`, `reason` | FK a revisión original congelada; UNIQUE(openResponseId,snapshotId,revision); texto para reporte separado; no sustituir original |
| SensitiveAccessGrant | `id`, `assessmentId`, `userId`, `permission`, `purpose`, `approvedBy`, `approvedAt`, `expiresAt`, `revokedAt?` | FK Assessment/User; índice(assessmentId,userId,permission,expiresAt); concesión sólo tras política GAP-011; no autoaprobación |

`DisclosureReview` se aplica después de calcular, tanto a pantalla como a descargas. Un segmento bloqueado no se elimina del universo matemático. Restringir también totales/complementos que permitan deducirlo. Nuevos snapshots invalidan aprobaciones anteriores; cambiar audiencia/filtros/columnas requiere revisión adecuada. No interpretar `SAFE_FOR_REPORT` como permiso para cualquier audiencia sin evaluar contexto.

## Congelamiento, ejecución y resultados

| Entidad | Campos y propósito | Restricciones |
|---|---|---|
| FrozenSnapshot | `id`, `assessmentId`, `revisionNumber`, `methodologyPackageId`, `closureRecordId`, `schemaVersion`, `canonicalPayloadCiphertext`, `sha256`, `keyVersion`, `frozenAt`, `frozenBy`, `supersedesSnapshotId?` | UNIQUE(assessmentId,revisionNumber); FKs reales; snapshot append-only. Incluye IDs/revisiones, valores, decisiones, exclusiones, metadata analítica y fuentes, nunca identidad/vínculo |
| ProcessingRun | `id`, `assessmentId`, `snapshotId`, `engineVersion`, `engineBuildHash`, `inputHash`, `analyticScopeKey` (ALL o corte explícito), `scopeFiltersJson`, `idempotencyKey`, `status` QUEUED/RUNNING/SUCCEEDED/FAILED, `requestedBy/At`, `startedAt?`, `finishedAt?`, `leaseUntil?`, `errorCode?`, `outputHash?`, `outputSchemaVersion`, `exactOutputCiphertext?` | FK snapshot/User; UNIQUE(assessmentId,idempotencyKey); índice(status,leaseUntil); reintento fallido crea intento/run trazado; sólo SUCCEEDED publicable |
| ProcessedResponse | `runId`, `responseId`, `recodedResponse?`, `score100?`, `processingStatus`, `ruleId` | PK(runId,responseId), FK Response y Run mismo diagnóstico; NA derivados NULL |
| IndividualElementScore | `runId`, `responseSessionId`, `elementCode`, `totalItems`, `naItems`, `missingItems`, `validItems`, `applicableItems`, `coverageRate?`, `coverageStatus?`, `piScore?`, `resultStatus` VALID/ND, `reasonCode?` | PK(runId,responseSessionId,elementCode), FKs; combina element_coverage e individual_element_score sin perder campos; exactos en artefacto |
| PerspectiveElementResult | `runId`, `perspectiveCode`, `elementCode`, `validPiCount`, `rpScore?`, `resultStatus` VALID/ND/NP, `qualityAssessmentId?`, `reasonCode?` | PK(runId,perspectiveCode,elementCode); 40 posiciones cuando se procesa diagnóstico completo, incluidos estados ausentes |
| PerspectiveIndexResult | `runId`, `perspectiveCode`, `validElementCount`, `score?`, `resultStatus`, `reasonCode?` | PK(runId,perspectiveCode); fórmula completa de 8 RP; parcial GAP-008 |
| TriangulationGap | `runId`, `elementCode`, `validPerspectiveCount`, `btScore?`, `btClass?`, `evidenceStatus` PARTIAL/INTEGRATED/NOT_CALCULABLE, `maxPerspectivesJson`, `minPerspectivesJson` | PK(runId,elementCode); mantener todas las perspectivas empatadas sin elegir una arbitrariamente; valores max/min se reconstruyen de RP |
| IntegratedElementResult | `runId`, `elementCode`, `validPerspectiveCount`, `riScore?`, `integrationStatus` INTEGRATED/LIMITED/ND | PK(runId,elementCode); RI limitado conserva valor de una perspectiva; sin evidencia NULL |
| GlobalIEOResult | `runId`, `validElementCount`, `integratedElementCount`, `globalScore?`, `displayScore?`, `healthLevel?`, `trafficLight?`, `resultStatus` COMPLETE/LIMITED/ND, `reasonCode?` | PK/FK runId; COMPLETE exige 8 integrados; reglas parciales y clasificación sujetas a GAP-007/008 |
| TriangulationInterpretation | `id`, `runId`, `elementCode`, `patternCode`, `note`, `evidenceRefsJson`, `reviewedBy/At`, `revision` | FK Run/Element/User; separada de cálculo y versionada; sin causalidad automática |

Tablas de resultados incluyen organizationId/assessmentId y FKs compuestas a Run; los pares run/sesión deben pertenecer al snapshot. Un CHECK local exige `score BETWEEN 0 AND 100 OR score IS NULL`, conteos válidos y valores nulos en estados ND/NP. Las relaciones de suma, conteo y pertenencia al snapshot se validan en el caso de uso antes de confirmar el run.

Cada ProcessingRun fija filtros analíticos sobre segmentos del snapshot: ALL para diagnóstico completo o un corte definido por el consultor. Las tablas se distinguen por runId y no mezclan cortes; el Global de un corte se identifica como tal y nunca sustituye al Global organizacional. El snapshot completo permanece intacto. Reportabilidad se evalúa por ámbito, audiencia y combinación de salidas, aunque los cálculos estén disponibles internamente.

No crear una tabla genérica de resultados con claves ambiguas o múltiples NULL en UNIQUE. El linaje completo queda en el artefacto exacto: Global→8 RI→RP incluidos→PI válidas→IDs de revisiones de respuestas→preguntas e instrumentos. Las tablas tipadas son proyecciones consultables; nunca recalcular usando un CSV redondeado.

Snapshot canónico versionado conserva el conjunto y las decisiones; no depende de volver a consultar membresías de segmentos o exclusiones que puedan cambiar después. Una reapertura crea otra revisión sin alterar el snapshot histórico. El cambio de nombre de Organization no altera el nombre contextual guardado en el acta congelada.

## Auditoría y exportaciones

| Entidad | Campos | Integridad e índices |
|---|---|---|
| AuditLog | `id`, `organizationId?`, `assessmentId?`, `actorType` ADMIN/PARTICIPANT/SYSTEM, `actorUserId?`, `actorRef?`, `action`, `entityType`, `entityId`, `metadataJson`, `timestamp`, `correlationId` | FK User/Assessment cuando corresponda; índice(assessmentId,timestamp,id), índice(actorUserId,timestamp), índice(entityType,entityId,timestamp). Entidad polimórfica es referencia auditora validada por aplicación, no FK fingida |
| ExportRecord | `id`, `assessmentId`, `snapshotId`, `runId?`, `type` EXP01/02/03/04, `purpose`, `audience`, `filtersJson`, `disclosureReviewIdsJson`, `sensitiveGrantId?`, `status`, `format`, `schemaVersion`, `manifestHash?`, `requestedBy/At`, `expiresAt?`, `downloadedAt?`, `rowCount?` | FK snapshot/run/grant/User; índice(assessmentId,requestedAt); artefactos privados temporales; permiso vuelve a comprobarse en descarga |

AuditLog registra CREATE, UPDATE, OPEN, CLOSE, FREEZE, REOPEN, EXCLUDE, PROCESS, EXPORT y eventos de concesión/revocación, publicación metodológica y lectura sensible. Metadata con lista permitida y antes/después redactados; nunca copia emails, respuestas, tokens, OTP ni el vínculo. Auditoría global de TECH_ADMIN se limita a mantenimiento y denegaciones; no cruza identidad y contenido.

## ERD textual

Se usa ERD textual para mostrar los límites sin crear archivos Figma. `1—N` indica cardinalidad; todas las flechas analíticas mantienen el mismo organizationId/assessmentId. Las tablas auxiliares y restricciones detalladas arriba forman parte del modelo.

```text
Organization 1—N Assessment 1—5 AssessmentPerspective N—1 Perspective
User N—N Organization [OrganizationMembership]
User N—N Assessment [AssessmentAssignment]
User 1—N AdminAccount / AdminSession
Assessment 1—N AssessmentScope / Segment / Incident / QualityAssessment
Assessment N—1 MethodologyPackage
MethodologyPackage N—1 MethodologyVersion (cinco componentes explícitos)
MethodologyVersion N—1 SourceArtifact
MethodologyPackage 1—5 PackageInstrument N—1 InstrumentVersion
Instrument 1—N InstrumentVersion 1—N InstrumentSection
Instrument 1—N Question 1—N QuestionVersion N—1 InstrumentVersion
QuestionVersion N—0..1 Element; QUANT exige Element; OPEN permite GEN
InstrumentVersion 1—N InstrumentScaleOption

ZONA DE IDENTIDAD Y ACCESO
AssessmentPerspective 1—N Invitation 1—N AccessChallenge
Invitation N—N Segment [InvitationSegment]
Invitation 1—0..1 ParticipantAccessBinding 1—N ParticipantAuthSession
                               |
                 acceso restringido, relación reversible
                               |
ZONA ANALÍTICA                   v
AssessmentPerspective 1—N ResponseSession (1 binding por sesión ordinaria)
ResponseSession N—N Segment [SessionSegment]
ResponseSession 1—N Response / OpenResponse N—1 QuestionVersion
OpenResponse 1—N QualitativeReview
Assessment 1—N Exclusion N—1 ResponseSession o Response (target exclusivo)
Assessment 1—N ClosureRecord 1—1 FrozenSnapshot 1—N ProcessingRun
ProcessingRun 1—N ProcessedResponse N—1 Response
ProcessingRun 1—N IndividualElementScore (sesión × Elemento)
ProcessingRun 1—N PerspectiveElementResult (perspectiva × Elemento)
ProcessingRun 1—N PerspectiveIndexResult (perspectiva)
ProcessingRun 1—N TriangulationGap / IntegratedElementResult (Elemento)
ProcessingRun 1—1 GlobalIEOResult
ProcessingRun 1—N TriangulationInterpretation
FrozenSnapshot 1—N DisclosureReview / ExportRecord
Assessment 1—N SensitiveAccessGrant / AuditLog
```

## Transacciones obligatorias y validación futura

| Operación | Unidad atómica y condición |
|---|---|
| Publicar catálogo | Validar todos los metadatos/fuentes y crear paquete completo; si hay diferencia no aprobada, rollback |
| Crear diagnóstico | Assessment, ficha inicial y exactamente cinco AssessmentPerspective coherentes con paquete |
| Verificar OTP | Bloqueo invitación/challenge, vigencia y generación; incrementar intento o consumir; crear/reutilizar un solo binding y ResponseSession; crear sesión auth |
| Guardar | Bloquear diagnóstico y sesión en orden fijo; OPEN+ventana+no enviada; comprobar rowVersion; insertar revisiones y avanzar contador |
| Enviar | Mismo bloqueo; validar contrato oficial; fijar revisión final, submittedAt y estado; marcar Invitation COMPLETED mediante binding, revocar escritura, auditar; reintento no duplica |
| Cerrar/congelar | Detener escrituras; resolver validación pendiente; acta+autorización+snapshot+hash+estado+auditoría en una transacción coherente |
| Procesar | Reservar run/lease con idempotencia; calcular fuera de bloqueo largo sobre snapshot; insertar todas las proyecciones y marcar SUCCEEDED en transacción; fallo no publica; actualizar estado de Assessment sólo si el run corresponde a su revisión vigente, mediante compare-and-set |
| Excluir/reabrir | Autoridad y razón verificadas; congelado exige nueva revisión, nunca UPDATE de snapshot/resultados previos |

Probar constraints y transacciones con MySQL real, no SQLite. Manejar deadlocks con reintentos acotados idempotentes. El volumen máximo de participantes y tamaño del snapshot debe medirse antes del piloto; si exige almacenamiento privado de artefactos, conservar hash y publicación atómica sin cambiar el dominio. No se necesitan stored procedures para el motor.

## Esquema implementado en Phase 1

El esquema ejecutable es `prisma/schema.prisma`; la migración inicial está versionada en `prisma/migrations`. El ERD completo anterior sigue siendo futuro.

| Tabla actual | Campos / función y restricciones |
|---|---|
| User | UUID, email normalizado UNIQUE, name opcional, passwordHash Argon2id, status ACTIVE/DISABLED, technicalAdmin, timestamps |
| AdminSession | UUID, userId FK, tokenHash SHA-256 UNIQUE, expiresAt, lastSeenAt, revokedAt opcional, createdAt; índice userId/expiresAt |
| Organization | UUID, name, status ACTIVE/INACTIVE, timestamps |
| OrganizationMembership | PK compuesta organizationId/userId/role, active, createdAt; FKs a organización/usuario; índice userId/active |
| Assessment | UUID, organizationId FK, name, period, status DRAFT, timestamps; UNIQUE organizationId/id, índice organizationId/createdAt |
| AuditLog | UUID, organizationId/assessmentId/actorUserId opcionales, action, entityType, entityId opcional, metadataJson opcional, createdAt; FKs y relación compuesta organización/diagnóstico para impedir mezcla de tenants; índices por organización/diagnóstico/fecha y actor/fecha |

Todas usan InnoDB/utf8mb4 y relaciones reales con borrado Restrict. `_prisma_migrations` es tabla interna de la herramienta. No Invitation, ResponseSession ni Response existen aún. Los DTO de metadata contienen únicamente id, name, period, status y nombre de organización.

## Esquema ejecutable añadido en Phase 2

`prisma/migrations/20260925183711_phase2_diagnosis_workspace/migration.sql` amplía Assessment con `objective`, `timezone`, `plannedOpensAt`, `plannedClosesAt`, `scopeUnitsText`, `sponsorName`, `consultantUserId`, `coordinatorUserId`, `methodologyNotes`. Los dos responsables son FK opcionales a User; su rol y organización se validan en el caso de uso.

`AssessmentPerspective`: UUID, FK Assessment, código DIR/ESP/LID/COL/CLI, aplicabilidad nullable APPLICABLE/NOT_APPLICABLE/NOT_AVAILABLE, población entera nullable, plan CENSUS/SAMPLE nullable, notas, unidad CLI B2B/B2C nullable, timestamps. UNIQUE(assessmentId,perspectiveCode). Se crean cinco filas en una transacción y la migración añade cinco a cada Assessment previo. CHECK de MySQL 8 impide población negativa, B2B/B2C fuera de CLI y población/plan en estados distintos de APPLICABLE. NULL significa sólo captura pendiente.

`Segment`: UUID, FK Assessment, dimensión libre validada, etiqueta, reportabilidad PENDING/REPORTABLE/NOT_REPORTABLE con default PENDING, motivo, active, timestamps. UNIQUE(assessmentId,dimension,label), índice(assessmentId,active). Desactivar conserva la fila. El estado declarado no constituye una revisión de riesgo ni permiso automático de exportación.

Estas son las únicas dos tablas de aplicación añadidas en Phase 2. No existen tablas de participantes, catálogo, respuestas ni resultados. Las FK, InnoDB y utf8mb4 se conservan.
