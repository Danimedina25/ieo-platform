# Plan de implementación

> **Alcance incremental:** este documento conserva la arquitectura objetivo de Phase 0. Phase 1 implementó login y seis entidades; Phase 2 agregó el workspace DRAFT y dos entidades (AssessmentPerspective, Segment). OIDC, SensitiveAccessGrant, DisclosureReview, procesamiento/worker, revisiones detalladas y correo: **Deferred / Not implemented in Phase 1**. El alcance vigente está en [PHASE2_DECISIONS.md](PHASE2_DECISIONS.md); las rutas y entidades futuras de este documento no implican implementación actual.

Estado: **Phase 0 documentada, pendiente de revisión del usuario**. No se ha iniciado Phase 1. Los entregables actuales son documentos; no existe aplicación ni instrucciones de instalación. Referencias metodológicas en [ARCHITECTURE.md](ARCHITECTURE.md); bloqueos específicos en [METHODOLOGY_GAPS.md](METHODOLOGY_GAPS.md).

Seguridad, confidencialidad y auditoría se construyen desde el primer flujo. Phase 7 consolida y verifica; no autoriza dejar sin protección las fases anteriores. Trabajar con datos sintéticos hasta completar aceptación técnica/metodológica y política de uso. Ninguna duda se resuelve con un default silencioso o un test cuyo resultado esperado se derive del mismo código que se prueba.

## Phase 0 — Architecture

- Objetivos: estudiar todas las fuentes, conciliar catálogos, identificar reglas ciertas y dudas; proponer monolito, modelo MySQL, permisos, diez vistas y secuencia de entrega.
- Módulos: arquitectura, datos, seguridad, UX/rutas y contrato conceptual del motor.
- Dependencias: 12 documentos disponibles en `docs/`; ruta `docs/requirements` ausente; fuentes faltantes GAP-001/002.
- Definición de terminado: siete documentos solicitados y README, inventario/hash de originales, diferencias trazables, segunda pasada y resumen ejecutivo. Revisión del usuario requerida antes de comenzar Phase 1. Esto no equivale a aprobación metodológica de GAPs.

## Phase 1 — Base project + database + authentication

- Objetivos: sólo después de revisión, iniciar Next.js/TypeScript App Router; configurar Prisma/MySQL, validación, lint/build/tests y autenticación administrativa.
- Módulos: infraestructura Node.js, identidad, membresías/asignaciones, repositorios por organización, AuditLog inicial, secretos y ambientes.
- Dependencias: confirmar proveedor OIDC o alternativa local mantenida; versión real de MySQL y permisos de migración; Node.js, TLS, correo, backup y capacidad del servidor; aprobar diseño de acceso sensible y responsables.
- Definición de terminado: migraciones reproducibles sobre MySQL real con InnoDB/utf8mb4/FKs/índices/CHECK; login/logout, revocación, sesión con digest y tres roles; pruebas negativas entre organizaciones y de privilegios; build y checks apropiados pasan. Sin cuentas de participante, sin secretos en repo, sin acceso implícito a respuestas por ser técnico. Restauración técnica básica probada con datos sintéticos.

## Phase 2 — Diagnosis workspace

- Objetivos: organización/diagnóstico, ficha de alcance, cinco perspectivas, segmentos, versiones y plan de cobertura; workspace lean y prueba técnica.
- Módulos: catálogos/importación controlada, diagnóstico, población y responsables, checklist, incidencias y auditoría.
- Dependencias: Phase 1; fuente certificada y corrección GAP-001/003 para publicar catálogo oficial; GAP-004 para obligatoriedad de versiones aplicables. Se puede construir staging con fuentes pendientes sin etiquetarlas oficiales.
- Definición de terminado: exactamente cinco estados de perspectiva por diagnóstico; versión fijada antes de OPEN; alcance/ventana auditados; muestra/censo, diversidad y unidad B2B/B2C documentables; no inventar representatividad automática. Coordinador limitado por backend. TEST separa evidencia sintética; no se abre aplicación real con catálogo sin certificar.

## Phase 3 — One complete instrument vertical slice

- Objetivos: recorrido completo de captura de un instrumento oficial, desde invitación hasta confirmación, con reanudación y envío inmutable. Propuesta técnica: COL, porque ejercita N/A, abiertas y los ocho inversos en un solo instrumento.
- Módulos: invitaciones/correo, OTP, binding protegido, sesiones temporales, intro versionada, renderer por datos, revisiones de respuestas y seguimiento operativo.
- Dependencias: Phase 2; GAP-003/004 resueltos para COL; aviso/retención GAP-012 antes de uso real; proveedor de correo probado. La primera vertical no exige implementar aún el cálculo Global.
- Definición de terminado: COL muestra 73 cuantitativas/8 abiertas exactas en su orden, sin orientación expuesta; scanner GET no consume ni envía correo; OTP limitado/de un uso; retomar conserva misma sesión; guardado distingue MISSING/NA; envío idempotente impide edición y muestra sólo agradecimiento. Playwright móvil y permisos negativos pasan; originales nunca se recodifican al guardar. Todo con datos sintéticos.

## Phase 4 — Survey Engine + five instruments

- Objetivos: extender el mismo renderer/captura a DIR/ESP/LID/CLI sin duplicar lógica ni textos en React.
- Módulos: catálogos completos, secciones, escalas, validación, flujo de ocho bloques y abiertas generales CLI.
- Dependencias: Phase 3; paquete oficial completo y obligatoriedad resuelta.
- Definición de terminado: 329 cuantitativas + 28 abiertas; distribución exacta por Elemento; DIR rechaza NA en UI y servidor; sólo COL invierte después en motor; CLI mantiene cuatro generales con Elemento NULL; introducciones y periodos propios. Verificación automática de conteos/códigos/textos contra fixtures oficiales aprobados, pruebas de importación inválida y recorrido de los cinco instrumentos.

## Phase 5 — IEO Mathematical Engine

- Objetivos: implementar `src/domain/ieo-engine` independiente y versionado; cierre, validación y snapshot como frontera formal de entrada; motor puro desde VALIDATE hasta Global.
- Módulos: reglas/casos de uso de cierre, acta/checklist, calidad/exclusiones, snapshots, ProcessingRun, motor y proyecciones con linaje.
- Dependencias: datos y catálogos de Phases 2–4; GAP-005/006/007/008/009/010 resueltos para comportamientos dependientes; protocolo de GAP-002 recibido para certificar integración. Se pueden desarrollar funciones de fórmula ya definida y fixtures sintéticos antes de cerrar las dudas, sin simular aprobación.
- Definición de terminado: Vitest ejecuta motor sin Next.js ni MySQL; originales intactos; N/A/ND/NP/MISSING correctos; precisión sin redondeo intermedio; pruebas oficiales T01–T22 + T06N y casos aclarados pasan. Cierre/congelamiento/envío se serializan; sólo snapshot autorizado entra al motor; fracaso no publica resultados parciales; misma entrada/build produce mismo hash de salida. Reprocesar no sobrescribe histórico.

## Phase 6 — Results + triangulation

- Objetivos: matriz ocho Elementos × cinco perspectivas, RP/BT/RI/Global e índice por perspectiva completo; evidencia/interpretación profesional y reportabilidad.
- Módulos: vistas de resultados, DisclosureReview, revisión cualitativa, patrones registrados y filtros autorizados.
- Dependencias: Phase 5; GAP-002/007/008/009; grants de GAP-011 para originales/PI; definiciones de anonimización y comunicación aprobadas.
- Definición de terminado: Global nunca aislado de Elementos/perspectivas; datos restringidos no salen en payload; ND/NP/LIMITED/supresión se distinguen; BT parcial con dos perspectivas e integrada con tres o más; estados de patrones conforme protocolo; no inferencia causal. Pruebas de reidentificación por total/complementos/RI/BT y metadatos; revisión de citas original→redactada conserva fuente. No inventar parcial numérico ni clasificación decimal.

## Phase 7 — Security + audit + exports

- Objetivos: completar EXP01–04, permisos excepcionales, auditoría de lecturas/descargas, endurecimiento operativo y procedimientos de respaldo/retención.
- Módulos: exportador CSV, manifiestos, grants, política de divulgación, backup/restauración, revisión de logs/cachés/cabeceras y límites.
- Dependencias: Phases 1–6 con controles ya presentes; GAP-011/012 resueltos. XLSX sólo si su dependencia mantenida, tamaño y pruebas añaden poco trabajo; CSV suficiente para terminar.
- Definición de terminado: exports crudos/PI sólo con autorización explícita, evidencia ordinaria revisada, metadatos completos para reproducir; sin secretos/identidad ni inyección de fórmulas; descarga revalida permisos; CSV reversible documentado. Todas las acciones críticas auditadas sin contenido sensible; secretos rotables, permisos MySQL mínimos, prueba de restauración y reejecución histórica. SQL/XSS/CSRF/IDOR/OTP/cache/exports pasan pruebas de seguridad.

## Phase 8 — Acceptance testing + stabilization

- Objetivos: aceptación formal por custodia y UAT del flujo completo; corregir problemas, documentar operación y liberar piloto controlado.
- Módulos: todo el recorrido, estabilidad y documentación técnica final; ninguna funcionalidad extra.
- Dependencias: Phases 1–7, fuentes certificadas, GAPs que afectan piloto resueltos mediante decisión versionada y fixtures; GAP-013 para registro de PASS de nulidad/estados.
- Definición de terminado: 23 casos oficiales críticos PASS con entrada/esperado/obtenido/versiones/tester/fecha, más pruebas adicionales de seguridad/metodología; cinco instrumentos revisados y UAT aprobado; pruebas de carga al volumen acordado; reconstrucción Global→raw y restauración demostradas. Ningún FAIL matemático, de confidencialidad, congelamiento o versionado permite piloto. Entregar runbook de despliegue, recuperación, incidencias y responsables; alcance del piloto y limitaciones aprobados.

## Matriz de aceptación matemática oficial

S12 es la referencia de entrada/salida. Sus 23 casos son T01–T22 **más T06N**. `READY` en el Excel es disponibilidad del caso, no PASS de esta aplicación. No existe todavía resultado de plataforma.

| Casos | Fuente S12 | Expectativa documentada | Prueba prevista |
|---|---|---|---|
| T01–T04 | `02_REACTIVOS`, filas 4–7 | Directo 1→0, 5→100; inverso 1→5→100, 5→1→0 | Vitest puro; raw intacto |
| T05 | `02_REACTIVOS`, fila 8 | NA conserva marcador y derivados NULL | Assert de nulidad, exclusión y estado; comparador GAP-013 |
| T06 | `03_COBERTURA`, fila 4 | 6 válidos /10, 4 omitidos → 0.60 SUFFICIENT | Frontera exacta sin flotante |
| T06N | `03_COBERTURA`, fila 5 | 6 válidos / (10−4 NA) =1, SUFFICIENT | No tratar NA como missing |
| T07 | `03_COBERTURA`, fila 6 | 5/10 →0.50 INSUFFICIENT, PI ND | ND=NULL, no cero |
| T08/T09 | `04_PI`, filas 4–5 | PI=50 completo y con NA excluido | Igual peso por reactivo válido |
| T10/T11 | `05_RP`, filas 4–5 | RP=60; PI ND no entra | Media de personas válidas, no de todas las respuestas agrupadas |
| T12–T17 | `06_BT`, filas 4–9 | 12/13,24/25,37/38 en clases correctas | Fronteras enteras y ≥2 perspectivas |
| T18 | `07_RI`, fila 4 | DIR90 n2, COL60 n100 → RI75 | No ponderar por n |
| T19 | `07_RI`, fila 5 | Única RP80 → RI80 LIMITED; BT no calculable | Assert valor y estado, no sólo número |
| T20 | `08_GLOBAL`, fila 4 | Media 60,65,…95 →77.5; Estable con riesgos/YELLOW | Valor exacto separado de presentación final |
| T21 | `08_GLOBAL`, fila 5 y nota A23 | 80.512371615325, no 80.5125 | No redondear RI a 2 decimales antes de Global |
| T22 | `09_END_TO_END`, filas 5–9 y 13–14 | RP85/75/70/65/95 →RI78, BT30 RELEVANT_GAP | Integración de un Elemento a partir de PI |

Probar además fronteras de salud de `08_GLOBAL!A9:F21`. Donde S12 utiliza `ABS(actual−expected)<0.000001`, mantener esa tolerancia para sus proyecciones numéricas; comparar también estado, clasificación y nulidad. Guardar resultados reales del runner, sin completar PASS por ausencia de error o por copia de celdas de la fuente.

## Casos adicionales necesarios

| Área | Casos y evidencia | Fase |
|---|---|---|
| Catálogo | Unicidad, conteos y orden, diferencia COL28, genéricas CLI, N/A DIR inválido, ocho inversos exactos, metadata incompleta rechazada | 2–4 |
| Captura | Omisión vs NA, borrador guardado, reanudación, dos pestañas, red interrumpida, envío repetido, cierre mientras envía | 3–5 |
| Suficiencia | Todo NA, cero válidos, cobertura justo por debajo/encima, mezcla NA+missing; incompleto válido en unos Elementos y ND en otros | 5, tras GAPs |
| Resultados | NP fuera de alcance, ND pertinente sin evidencia, cero/una/dos/tres/cinco perspectivas, empates max/min, Global incompleto y calidad C | 5–6 |
| Redondeo | 12.4/12.5/24.8/37.5 BT; 49.5/79.5/89.5/94.5 salud; empate y presentación según resolución versionada | 5–6 |
| Histórico | Nueva versión de pregunta/regla no cambia snapshot anterior; reapertura genera revisión; nuevo run conserva anterior; checksum y artefacto exacto reproducibles | 5,8 |
| Seguridad | Aislamiento organización/sesión, escalamiento de rol, grants vencidos, GET scanner, OTP replay/fuerza bruta, CSRF/XSS/SQL, cache y logs | 1–8 |
| Divulgación | Segmentos singulares y cruces, inferencia por complementos/RI/BT, citas identificables, CSV peligroso, permisos al descargar | 6–8 |
| Recorrido real | Crear → TEST → OPEN → cinco instrumentos → CLOSED → acta/FROZEN → motor → resultados → evidencia → cuatro exports | 8 |

Vitest de integración utilizará MySQL real para FKs, índices, transacciones y concurrencia. Playwright cubrirá móvil, desktop/tablet, teclado, errores, roles y flujo completo. No sustituir invariantes MySQL con tests de SQLite. Fixtures oficiales se versionan con hash de fuente; fixtures ampliados se etiquetan como técnicos o como aclaraciones aprobadas, sin presentarlos falsamente como casos originales de S12.

## Decisiones recomendadas antes de Phase 1

1. Aprobar monolito modular, diez vistas y CSV como primera salida; conservar stack solicitado.
2. Confirmar ubicación de fuentes (`docs/` actual o futura `docs/requirements`) y mecanismo de entrega/certificación del Banco Maestro y documentos faltantes.
3. Elegir autenticación administrativa y verificar compatibilidad real de adaptador, digest de sesiones y MySQL; identificar cuentas de custodia y permisos.
4. Confirmar servidor (Node.js, versión MySQL, TLS, correo, tareas programadas, backups, capacidad y volumen esperado). No asumir que disponer de MySQL implica poder hospedar Next.js.
5. Aprobar el modelo de confidencialidad seudonimizado con vínculo protegido, reportabilidad contextual y ausencia de acceso individual automático.
6. Asignar responsable de resolver GAPs y establecer prioridades: fuentes/required antes de catálogo/captura; selección analítica/calidad/decimales antes del motor oficial; grants/retención antes de datos reales.

Las decisiones de implementación pueden avanzar tras revisión de arquitectura; las metodológicas las resuelve la custodia. No convertir el listado anterior en un requisito de resolver todas las dudas antes de preparar infraestructura sintética.
