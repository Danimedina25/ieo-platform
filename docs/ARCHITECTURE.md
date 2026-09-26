# Arquitectura propuesta — Sistema Digital IEO®

> **Alcance incremental:** este documento conserva la arquitectura objetivo de Phase 0. Phase 1 implementó login y seis entidades; Phase 2 agregó el workspace DRAFT y dos entidades; Phase 3A añadió invitaciones, OTP y encuesta exclusivamente sintética. El alcance vigente está en [PHASE3A_DECISIONS.md](PHASE3A_DECISIONS.md). OIDC, SensitiveAccessGrant, DisclosureReview, procesamiento, catálogo oficial y exportaciones siguen diferidos; las rutas y entidades futuras de este documento no implican implementación actual.

Estado: diseño objetivo de Phase 0, revisión documental final 2026-09-24. Phase 1, Phase 2 y Phase 3A cuentan con implementación incremental; ver PHASE1_DECISIONS.md, PHASE2_DECISIONS.md y PHASE3A_DECISIONS.md. La documentación metodológica es la fuente de verdad; las decisiones técnicas aquí propuestas no son reglas nuevas del IEO®.

## Fuentes estudiadas y precedencia

La ruta solicitada `docs/requirements` no existe. Se estudiaron los 12 originales presentes directamente en `docs/`, sin moverlos ni alterarlos: 10 DOCX y 2 XLSX, incluidas todas sus hojas (15 del diccionario, 12 de la matriz), textos, tablas, metadatos y fórmulas de aceptación. Las referencias Sxx siguientes se utilizan en todo este paquete. La extracción temporal fue únicamente una herramienta de análisis, no código de producto.

| ID | Fuente disponible | SHA-256 |
|---|---|---|
| S01 | [00_Documento_Maestro_Paquete_Tecnico_IEO_Daniel_v1.0.docx](00_Documento_Maestro_Paquete_Tecnico_IEO_Daniel_v1.0.docx) | `427f7a9a0cc96843cdef49732fa560137ea5195aede9234ae920b0c68fb80d7d` |
| S02 | [5 Protocolo_Oficial_Aplicacion_IEO_v1.0.docx](5%20Protocolo_Oficial_Aplicacion_IEO_v1.0.docx) | `2b45af83164817c8953454057b3e8bd849d61777ec38cbcdd79adada3616e113` |
| S03 | [7 Modelo_Matematico_Oficial_IEO_v1.1.docx](7%20Modelo_Matematico_Oficial_IEO_v1.1.docx) | `b1310490922fe7c680aea78d9934ad42eedcc66fdcde8b83089a8a69a5666807` |
| S04 | [Diccionario Maestro de Datos y Codificación IEO.docx](Diccionario%20Maestro%20de%20Datos%20y%20Codificaci%C3%B3n%20IEO.docx) | `ab095966150444c32fd2f1f0bd8d9482d335193f73527c0824638b9507f512a9` |
| S05 | [Diccionario_Maestro_Datos_Codificacion_IEO_v1.0.xlsx](Diccionario_Maestro_Datos_Codificacion_IEO_v1.0.xlsx) | `4472751093748a9a4f46544077351bb17d14c574888681b527ea05c459db5c0f` |
| S06 | [Especificaciones Funcionales para la Digitalización y Automatización del Sistema IEO.docx](Especificaciones%20Funcionales%20para%20la%20Digitalizaci%C3%B3n%20y%20Automatizaci%C3%B3n%20del%20Sistema%20IEO.docx) | `5b4339a3175a40244e50b43e7f3a0bdd7ee188ed4a96d2047a9988565bfc09b2` |
| S07 | [IEO_Colaboradores_Version_Oficial_1.0.docx](IEO_Colaboradores_Version_Oficial_1.0.docx) | `de9b10a17b5961d2b40b7ef8e74d9c830d83feeb3e15b2194f01a445f0706ffb` |
| S08 | [IEO_Direccion_Version_Oficial_1.0.docx](IEO_Direccion_Version_Oficial_1.0.docx) | `1115599a6cd772ed21c39876c81471fd64e6e5aa854dd578bea8fe5fa51717f7` |
| S09 | [IEO_Especialistas_Version_Oficial_1.0.docx](IEO_Especialistas_Version_Oficial_1.0.docx) | `b4061684e57f047155cd5e6014075187df50c7ad1029200037227890e12e1e3a` |
| S10 | [IEO_Liderazgo_Version_Oficial_1.0.docx](IEO_Liderazgo_Version_Oficial_1.0.docx) | `55b95824583589c660c85b8588b235297fa98bc04ce89ab41c24b52062974612` |
| S11 | [IEO_Voz_del_Cliente_Version_Oficial_1.0.docx](IEO_Voz_del_Cliente_Version_Oficial_1.0.docx) | `7c49a6ee546ba09b2f64c90a35be6777b68a566c774b055577adc85fa834a9e3` |
| S12 | [Matriz_Casos_Prueba_Resultados_Esperados_IEO_v1.0.xlsx](Matriz_Casos_Prueba_Resultados_Esperados_IEO_v1.0.xlsx) | `ef5f19bbb3e53d7fa0e0b47823a0742cfe86bf32988e494868bcd33c28d1f9ce` |

S01 §3 establece la precedencia: instrumentos → Banco Maestro → diccionario → modelo matemático → protocolo de triangulación → protocolo de aplicación → matriz de aceptación. Cada documento gobierna su materia; esta jerarquía no permite inventar reglas ausentes. S06 aporta requisitos funcionales. Las instrucciones explícitas del proyecto fijan stack y alcance lean. [METHODOLOGY_GAPS.md](METHODOLOGY_GAPS.md) documenta ausencias y conflictos sin resolverlos silenciosamente.

Se verificaron 357 registros del diccionario contra los instrumentos: 328 de 329 textos cuantitativos coinciden y las 28 abiertas coinciden, descontando su numeración visible. COL_E04_R028 difiere: «jefe» en Excel / «líder» en Word (GAP-003). Los códigos y metadatos del Excel se preservan; no se regeneran a partir del texto. No se dispone del Banco Maestro original ni del protocolo completo de triangulación (GAP-001/002).

## Arquitectura general y alcance

Un monolito modular con Next.js App Router y TypeScript, ejecutado en runtime Node.js en el servidor del cliente, más MySQL 8.x/InnoDB/utf8mb4 y transporte de correo transaccional. Prisma para persistencia, Zod para entradas y contratos, React Hook Form para formularios, Tailwind CSS y shadcn/ui o equivalentes accesibles. Vitest prueba dominio e integración; Playwright prueba recorridos y permisos. Versiones exactas y compatibilidad se fijarán al iniciar Phase 1, sin instalar dependencias en esta fase.

Una instancia inicial de aplicación, TLS mediante proxy del servidor, MySQL accesible sólo desde servicios autorizados y respaldos cifrados. Un comando/tarea programada del mismo monolito atiende correo y, si el volumen lo requiere, trabajos de procesamiento persistidos en MySQL. No hay microservicios, Kubernetes, event sourcing, broker ni Redis obligatorio. Un registro de trabajo evita perder procesamiento por recarga o timeout HTTP.

La UI utiliza una lista de diagnósticos y un workspace con vistas consolidadas. No se requieren editor de cuestionarios, constructor de reportes, IA, aplicaciones móviles nativas ni panel global complejo. CSV es la entrega inicial; XLSX se evalúa después sin bloquear el piloto. La generación Word/PDF queda fuera. Las variables/subdimensiones de S03 §7 son opcionales y no integran una capa matemática obligatoria del MVP.

## Módulos y responsabilidades

| Módulo | Responsabilidad | Límite |
|---|---|---|
| Identidad administrativa | Usuarios, autenticación, membresías, asignación y permisos | No crea cuentas de participantes |
| Catálogo metodológico | Instrumentos, preguntas, escalas, fuentes, versiones, importación controlada | No permite editar una versión publicada |
| Diagnósticos | Organización, ficha de alcance, cinco perspectivas, población, segmentos, responsables y ventana | No calcula salud durante levantamiento |
| Participación | Invitaciones, correo, OTP, reanudación y control operativo | No devuelve respuestas a coordinadores |
| Captura | Introducción oficial, aceptación, guardado y envío | No revela orientación, PI ni resultados |
| Validación y cierre | Incidencias, exclusiones, dictámenes, checklist, acta, congelamiento | Juicio metodológico humano explícito |
| Motor IEO | Funciones puras de validación matemática y procesamiento versionado | Sin React, Next.js, Prisma, MySQL, red ni reloj implícito |
| Resultados y evidencia | Matriz por Elemento/perspectiva, revisión cualitativa, patrones profesionales, reportabilidad | No deduce causalidad ni concede acceso individual por cargo |
| Exportación y auditoría | EXP01–04 con permisos, manifiestos y trazabilidad de acciones | No publica enlaces abiertos ni expone secretos |

Estructura futura conceptual: `src/domain/ieo-engine`, `src/domain/assessment`, `src/application`, `src/infrastructure/persistence`, `src/infrastructure/auth`, `src/infrastructure/mail`, `src/app` y `src/components`. Estos directorios aún no se crean.

Dependencias: UI/Route Handlers/Server Actions → casos de uso de aplicación → dominio. Los casos de uso dependen de contratos de repositorios; infraestructura implementa esos contratos con Prisma. El dominio sólo conoce tipos propios. Las rutas verifican entrada y los casos de uso verifican autorización, organización, estado y precondiciones transaccionales. La capa de acceso devuelve DTO mínimos específicos por rol. Cada Server Action se trata como un endpoint público y verifica autorización por sí misma, siguiendo la [guía de Next.js](https://nextjs.org/docs/app/guides/authentication).

## Flujo de información y confidencialidad

1. El consultor define alcance, cinco estados de perspectiva, poblaciones, modalidades, segmentos autorizados, unidad B2B/B2C y versiones antes de abrir. Registra sponsor, consultor, coordinador y responsable técnico. El sponsor es una responsabilidad del acta, no un rol adicional con acceso a datos.
2. La prueba técnica usa invitaciones/sesiones marcadas como TEST; se preservan y excluyen del conjunto real. Se valida catálogo, escalas, orden, correo, dispositivo, exportación y protección antes de OPEN (S02 §8).
3. Participación conserva email cifrado, perspectiva, invitación y estado. Un vínculo protegido permite recuperar la sesión tras OTP; no existe `invitationId`, email o nombre en `ResponseSession` o `Response`.
4. La sesión de respuesta usa un identificador aleatorio independiente. Conserva la versión exacta, respuestas originales y metadatos analíticos autorizados, sin identificadores de contacto ni IP. Las abiertas pueden contener identidad escrita espontáneamente y requieren protección adicional.
5. El cierre detiene escrituras ordinarias. Se revisan incidencias, duplicados, distribución, reservas y suficiencia contextual; se registra el dictamen A/B/C y el acta. El 60 % individual no equivale a representatividad poblacional.
6. Un snapshot congelado preserva entradas, revisiones de respuesta, exclusiones, alcance, versiones y autorización. El motor recibe sólo la porción analítica validada y devuelve derivados con linaje.
7. Se guardan resultados por ejecución sin sobrescribir previas. Una política de divulgación filtra lecturas, exports y citas, separada del cálculo oficial: ocultar datos no equivale a eliminarlos del cálculo ni a cambiar ND/NP.

La separación es **seudonimización con vínculo restringido**, no anonimato irreversible. Se elige para permitir reanudación y prevenir duplicados. Permisos MySQL, repositorios separados y cifrado reducen acceso accidental; el servidor que maneja claves sigue siendo una frontera de confianza. [SECURITY.md](SECURITY.md) describe límites, correlaciones y controles.

## Instrumentos como datos

| Perspectiva | Código | Cuantitativos por E01–E08 | Total | Abiertas | N/A | Inversos |
|---|---|---|---:|---:|---|---:|
| DIR | IEO-DIR-01 | 9,11,10,10,10,8,8,9 | 75 | 0 | No | 0 |
| ESP | IEO-ESP-01 | 8,10,8,8,9,8,8,9 | 68 | 8 | Sí | 0 |
| LID | IEO-LID-01 | 8,11,8,9,9,8,8,9 | 70 | 8 | Sí | 0 |
| COL | IEO-COL-01 | 9,9,9,10,9,9,9,9 | 73 | 8 | Sí | 8 |
| CLI | IEO-CLI-01 | 5,6,4,5,5,6,7,5 | 43 | 4 | Sí | 0 |

Versión de los cinco instrumentos: 1.0. Total: 329 cuantitativos y 28 abiertas. Inversos COL: R009, R018, R027, R037, R046, R055, R064 y R073, con códigos completos de S05; nunca inferidos por redacción. Las abiertas de COL/LID/ESP siguen a cada Elemento; CLI presenta cuatro generales al final y `elementCode=NULL`, conservando códigos CLI_GEN_O01–O04. No forzar su pertenencia a E01–E08.

Preservar títulos, introducciones, instrucciones de cada bloque, etiquetas de escala, texto de N/A y agradecimiento como contenido versionado. COL se refiere a los últimos seis meses; DIR/ESP a condiciones actuales y CLI a experiencia directa; no imponer un periodo de seis meses a los cinco. La duración informativa debe provenir de la ficha o del plan aprobado; DIR indica 20–25 minutos.

Importador futuro: seed/JSON/CSV controlado → validación Zod → comparación con fuentes y checksum → informe de diferencias → aprobación de publicación → transacción de catálogo inmutable. Validar conteos, unicidad, orden, Elementos, N/A, inversos y abiertas. `item_order` cuantitativo y abierto son secuencias distintas en Excel; un `displayOrder` adicional reconstruye su intercalación oficial. `required` permanece pendiente de GAP-004; no asignar un default metodológico. Sin editor visual.

## Ciclo de vida, congelamiento y concurrencia

| Estado | Operación permitida | Salida / condición |
|---|---|---|
| DRAFT | Alcance y catálogo, responsables, permisos | TEST con paquete revisado |
| TEST | Prueba técnica separada | OPEN tras checklist y población validada |
| OPEN | Acceso, guardado, envío y seguimiento operativo | CLOSED al alcanzar ventana o cierre autorizado |
| CLOSED | Sin recepción; revisión, exclusiones justificadas y acta | FROZEN con conjunto validado y autorización |
| FROZEN | Lectura de snapshot; ejecutar motor autorizado | PROCESSED sólo al confirmar ejecución completa |
| PROCESSED | Resultados, revisión de divulgación, cualitativas y exportación | ARCHIVED; nunca editar entradas congeladas |
| ARCHIVED | Consulta histórica controlada | Sin mutaciones ordinarias |

Una extensión de ventana requiere motivo, actor y auditoría. `now` del servidor y ventana se comprueban aun si el trabajo programado de cierre se retrasa. OPEN→CLOSED, guardado y envío usan el mismo bloqueo corto de diagnóstico y sesión, en orden consistente: un envío se confirma antes del cierre o se rechaza; nunca queda a medias. Envíos repetidos son idempotentes. La reapertura es excepcional, no un botón que descongela y sobrescribe: conserva el snapshot anterior y abre una nueva revisión, con nueva acta y run. Autoridad y correcciones permitidas: GAP-010.

El acta preserva alcance final, instrumentos y versiones, apertura/cierre reales, invitados y participación, perspectivas válidas/con reservas/insuficientes/NP, incidencias, exclusiones, dictamen, restricciones, responsable y fecha de autorización (S02 anexo E). El checklist reproduce sus 16 puntos; no se reduce a un porcentaje.

## Contrato y reglas del motor

Entrada: paquete metodológico publicado e inmutable; proyección cuantitativa del snapshot sin identificadores directos ni texto abierto; preguntas oficiales con orientación y N/A; respuestas crudas tipadas; omisiones explícitas al construir la matriz esperada; decisiones aprobadas de inclusión/suficiencia; identificación de diagnóstico/revisión. Nunca recibe email, enlace, OTP, cookie ni claves. Una configuración sin regla necesaria produce un bloqueo técnico explícito, no ND inventado.

Salida: conteos y cobertura, derivados por respuesta, PI, RP, índice por perspectiva cuando completo, BT, RI, Global, estados, motivos y linaje por ejecución. Patrones interpretativos y decisiones de divulgación se registran aparte. El cálculo es determinista para la misma entrada, versión de motor y políticas aprobadas.

| Etapa | Regla documentada | Fuente / aceptación |
|---|---|---|
| VALIDATE | 1–5 o NA permitido; versión/pregunta/perspectiva válidas; separar MISSING; no abiertas, pruebas ni exclusiones en entrada analítica | S01 §6; S02 §§8,11,15; S05 R001 |
| RECODE | DIRECT=x; REVERSE=6−x; raw inmutable; NA sin recodificación numérica | S03 §4; T01–T05 |
| EXCLUDE N/A | NA fuera de numerador y denominador; conservar marcador | S03 §5; T05/T06N/T09 |
| SUFFICIENCY | aplicables=total cuantitativos del Elemento−NA; cobertura=válidos/aplicables; ≥0.60 suficiente, menor ND; omisiones siguen en denominador | S12 `03_COBERTURA`, T06/T06N/T07; cero denominador GAP-006 |
| CONVERT | score_100=(recoded−1)×25 | S03 §3; T01–T04 |
| PI | Media simple de scores válidos si suficiente | S03 §6; T08/T09 |
| RP | Media simple de PI válidas por perspectiva y Elemento, sin ponderar por reactivos contestados | S03 §8; T10/T11; dictamen GAP-009 |
| BT | max RP−min RP; ≥2 perspectivas; con 2 parcial y con ≥3 integrada; con 1 no calculable | S03 §10; T12–T17/T22 |
| RI | Media simple de RP; ≥2 INTEGRATED; 1 LIMITED y conserva RP (T19=80); 0 ND y NULL | S04 §28; S12 T18/T19/T22 |
| IEO GLOBAL | Media de ocho RI INTEGRATED, igual peso por Elemento; COMPLETE sólo con ocho; no imputar | S03 §12; S05 R016; T20/T21; parciales GAP-008 |

Índice por perspectiva: media de sus ocho RP válidos (S03 §9); no confundirlo con Global. Un RP de perspectiva fuera del alcance es NP; una pertinente no disponible es ND/limitación según nivel, según S05 `09_ESTADOS`. Preservar el estado de alcance original separado del estado de resultado.

BT: 0–12 HIGH_CONVERGENCE; 13–24 MODERATE_DIFFERENCE; 25–37 RELEVANT_GAP; 38–100 CRITICAL_GAP. Salud: 95–100 Ejemplar; 90–94 Muy saludable; 80–89 Saludable; 70–79 Estable con riesgos; 60–69 En erosión; 50–59 Erosión importante; 0–49 Crítico. Semáforo: verde oscuro 90–100, verde claro 80–89, amarillo 70–79, naranja 60–69, rojo 0–59. Son rangos transcritos, no una solución a huecos decimales: GAP-007. Mayor puntuación significa mayor salud organizacional; no invertir el Global por el nombre «erosión».

No usar redondeo intermedio ni valores de presentación como entradas posteriores. Propuesta técnica: aritmética racional exacta para sumas/promedios y comparación de cobertura por enteros; conservar numerador/denominador como cadenas en el artefacto de resultados, más proyección DECIMAL para consultas. Política de redondeo final pendiente de aprobación. Probar tolerancia <0.000001 de la matriz sobre proyección numérica, además de igualdad exacta cuando corresponda.

Patrones previstos: CONSISTENT_STRENGTH, CONSISTENT_EROSION, PERCEPTION_GAP, MIXED_RESULT, LIMITED_EVIDENCE (S04 §32). Registrar responsable, justificación y evidencia; no automatizar su asignación sin protocolo completo. BT expresa discrepancia y no modifica salud.

## Reproducción histórica

Cada diagnóstico fija versiones de los cinco instrumentos seleccionados, Banco Maestro, diccionario, modelo matemático, protocolo de aplicación y de triangulación, fuentes/hashes y fecha real de aplicación. Las versiones se fijan antes de apertura; congelarlas sólo al final permitiría cambios silenciosos durante captura.

Cada snapshot guarda conjunto canónico de respuestas/revisiones, población analítica, exclusiones, calidad, alcance y decisiones; hash SHA-256 de serialización estable, con esquema versionado y sin identidad. Cada ProcessingRun registra snapshot, versión del motor, commit/build, contrato, precisión, hora y autor. Un hash identifica integridad, pero no reemplaza guardar el contenido ni protege contra un administrador que reescriba todo. Las abiertas originales pueden revelar identidad en su propio texto: se cifran y se excluyen de la entrada matemática.

Conservar el artefacto del motor y dependencias para poder reejecutar versiones históricas. Actualizar un catálogo crea una versión nueva; no modifica filas referenciadas. Reprocesar crea un run nuevo; la selección del resultado publicado se audita y no borra runs anteriores. Los resultados parciales de un proceso fallido no son consultables como resultados oficiales. Cada run fija su ámbito: diagnóstico completo o corte analítico autorizado sobre el mismo snapshot. Un corte nunca reemplaza el Global organizacional ni altera el universo de la ejecución principal. Su divulgación requiere revisión propia y conjunta con las demás salidas.

## Exportaciones y evidencia

Cuatro conjuntos exigidos por S01 §12/S05 `12_EXPORTACIONES`: EXP01 crudos cuantitativos, EXP02 abiertas, EXP03 derivados y resultados (incluidas PI sólo con autorización sensible), EXP04 metadatos metodológicos. CSV UTF-8 con esquema, estados separados del valor nulo, IDs seudónimos, versión de snapshot/run, reglas, exclusiones y manifiesto de integridad. Un paquete CSV puede tener varios archivos tipados para evitar columnas ambiguas.

Separar exportación técnica restringida para auditoría y reproducción de salida agregada para reporte. Los originales cualitativos no se sustituyen por versiones redactadas; una proyección revisada se utiliza en reportes. No incluir email, token de acceso ni vínculo de identidad. Los IDs de exportación son estables dentro del paquete y distintos de la invitación. Protección contra fórmulas de hojas de cálculo y divulgación por diferencias en [SECURITY.md](SECURITY.md).

## Verificación y decisiones previas

[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) asigna los 23 casos críticos T01–T22 más T06N y pruebas adicionales de producto, seguridad e históricos. T22 comienza en PI y sólo integra un Elemento: se requiere además una prueba real del recorrido completo, sin atribuírsela al Excel.

Antes de Phase 1 confirmar proveedor de autenticación administrativa, capacidad del servidor para Node.js/MySQL compatible y correo, responsables de acceso sensible y retención, ubicación definitiva de fuentes y aprobación de esta arquitectura. Resolver cada GAP antes de implementar su comportamiento dependiente; no es necesario esperar todos para construir infraestructura sin datos reales. No iniciar Phase 1 sin revisión del usuario.

## Requirement coverage review

Revisión de cobertura documental, no declaración de funcionalidad implementada. Segunda pasada realizada el 2026-09-24: se reabrieron los 12 originales, se comprobaron sus hashes sin cambios y se contrastaron las reglas con esta propuesta. Se verificaron número, Elemento, texto y N/A de las 329 preguntas contra los DOCX; sólo COL_E04_R028 difiere. Se revisaron las 28 abiertas, las 15 hojas del diccionario y las 12 de aceptación, incluidas fórmulas y comparadores. Se comprobaron enlaces locales de los ocho documentos creados. No se ejecutaron tests de aplicación porque aún no existe código de producto.

### Covered

| Requerimiento original | Evidencia | Cobertura propuesta |
|---|---|---|
| Cinco perspectivas en un diagnóstico | S01 §§4–5; S06 §3 | AssessmentPerspective, un workspace |
| Cinco instrumentos / 329 + 28 / orden y secciones | S05 y S07–S11 | Catálogo, InstrumentSection, QuestionVersion, importador con diferencias |
| Ocho inversos sólo COL | S03 §4; S05 `04_REACTIVOS` | Metadata privada + RECODE + casos frontera |
| N/A diferente de omisión, ND, NP y NULL | S01 §§6,9; S12 T06N | Valores tipados y estados separados |
| Denominador y 60 % | S12 `03_COBERTURA!A8` | total−NA, sin imputación; cero denominador aparte |
| PI, RP, BT, RI y Global completo | S03 §§6–12; S12 | Motor independiente, igual peso y linaje por run |
| IEO por perspectiva completo | S03 §9 | Ocho RP, resultado distinto de Global |
| Abiertas generales CLI y revisión de citas | S11; S05 `05_ABIERTAS`; S02 §13 | Elemento nullable, original + revisión protegida |
| Versionado de instrumentos/banco/modelo/protocolos y fecha | S02 §18.3; S06 §8 | Paquete inmutable, snapshot y artefacto de motor |
| Participante sin cuenta, sólo confirmación | Solicitud; S01 §10; S06 §18 | Enlace + OTP + sesión temporal; sin resultados |
| Confidencialidad y riesgo contextual | S02 §§3,12–13; S06 §§39–41 | Vínculo protegido, políticas de divulgación, sin mínimo universal |
| Calidad, población, B2B/B2C, checklist y acta | S02 §§4–17 y anexos | Campos, decisiones humanas y validación de cierre |
| Cierre y freeze | S01 §§5,11; S06 §33 | Transacciones, snapshot inmutable, autorización explícita |
| Auditoría y cuatro exports | S01 §§11–12; S05 | AuditLog, ExportRecord, manifests y permisos |
| Stack y pantallas lean | Solicitud | Monolito, MySQL, 10 vistas, CSV, sin editor ni IA |
| Pruebas oficiales y adicionales | S12; S06 §§46–48 | Plan trazable y bloqueo de piloto ante FAIL crítico |

### Partially covered

| Área | Límite real | Siguiente comprobación |
|---|---|---|
| Certificación de catálogo | Banco original ausente y una diferencia de texto | GAP-001/003 antes de publicación |
| Triangulación interpretativa y formato de reporte | Fórmulas básicas disponibles; faltan fuentes complementarias | GAP-002 antes de Phase 6 |
| Reproducción operativa | Diseño completo; aún sin almacenamiento, backups ni artefacto ejecutable | Phases 1,5,8 y prueba de restauración |
| Seguridad y autorización | Propuesta documentada; proveedor/infraestructura no comprobados | Phase 1 y endurecimiento continuo |
| Aceptación formal | 23 expectativas revisadas; comparadores incompletos y ninguna app ejecutada | GAP-013 y evidencia PASS futura |

### Needs methodological clarification

| Tema | Registro | Parte dependiente |
|---|---|---|
| Fuentes faltantes y sincronización | GAP-001–003 | Catálogo certificado / interpretación |
| Obligatoriedad y borradores no enviados | GAP-004/005 | Envío y selección analítica |
| Todos N/A | GAP-006 | Estado de cobertura y razón oficial |
| Decimales y redondeo | GAP-007 | Clasificaciones y reporte |
| Índices parciales / LIMITED / ND | GAP-008 | Global e índice por perspectiva incompletos |
| Dictamen versus cálculo/publicación | GAP-009 | Elegibilidad multifuente |
| Reapertura y exclusiones | GAP-010 | Correcciones y denominadores excepcionales |
| Acceso individual excepcional | GAP-011 | Exportaciones técnicas y revisión original |
| Retención y retiro | GAP-012 | Operación con datos reales |
| Validación de NULL y estados en matriz | GAP-013 | Certificación de aceptación |
