# Phase 2 — decisiones antes de implementar

Phase 1 fue aprobada. Este documento fija el alcance de Phase 2 antes de modificar el código. La documentación original sigue siendo fuente metodológica y los trece GAP existentes permanecen abiertos.

## Alcance y esquema

El consultor podrá crear un diagnóstico en una organización activa donde tenga membresía IEO_CONSULTANT o crear organización y diagnóstico de forma atómica. Habrá un workspace de General y Perspectivas, con exactamente cinco filas DIR/ESP/LID/COL/CLI; segmentos simples bajo Perspectivas. Sólo estado de diagnóstico DRAFT.

Dos tablas nuevas: `AssessmentPerspective` y `Segment`. `Assessment` agrega objetivo, zona horaria IANA opcional, fechas planificadas UTC opcionales, texto de unidades/sedes, nombre de sponsor, responsables consultor/coordinador como FK opcionales y observaciones metodológicas. El borrador incompleto es válido. No se crea AssessmentScope, Assignment, catálogo ni instrumentos.

`AssessmentPerspective.applicability` es NULL al crear, antes de decisión humana; no es cuarto estado oficial. `populationEstimate` NULL o entero no negativo, plan CENSUS/SAMPLE opcional, notas opcionales, B2B/B2C sólo CLI. Una fila por código y diagnóstico, con índice único. `Segment.reportabilityStatus=PENDING` es información declarada: no significa aprobación de divulgación. `active=false` conserva la fila.

## Permisos y simplificaciones

Las lecturas de consultor/coordinador dependen de membresía activa en organización activa. TECH_ADMIN sin membresía conserva sólo la ficha de metadata mínima de Phase 1 y no edita. TECH_ADMIN con membresía IEO_CONSULTANT puede ejercer exactamente el permiso de consultor en esa organización. Los casos de uso vuelven a autenticar y autorizar, aun cuando el frontend o layout hayan comprobado la sesión.

La pantalla de creación será un diálogo accesible en `/diagnosticos`, con selección de organización propia o creación de una nueva. No hay wizard. Mutaciones: Route Handlers JSON POST/PATCH con Origin exacto, Zod y tamaño acotado, consistentes con Phase 1. Auditoría dentro de la misma transacción que cada escritura. No se guarda contenido sensible en metadata. El seed añade sólo las diez filas de perspectivas para los dos diagnósticos demo existentes.

Fechas planificadas se capturan explícitamente como UTC en el formulario y se guardan como DateTime UTC. `timezone` es una etiqueta IANA para contexto futuro; no se hace conversión implícita del navegador. Esto evita interpretar mal la hora al cambiar de zona; se podrá mejorar el control en otra fase sin cambiar datos previos. No hay apertura/cierre automático. Se valida apertura < cierre si ambas fechas existen.

No calcularemos representatividad, umbrales ni suficiencia. No se autoriza OPEN ni se presenta el paquete metodológico como certificado. La UI sólo muestra “Pendiente de certificación”. No hay cuenta de sponsor. El texto de unidades/sedes evita modelar un catálogo de sedes. Los segmentos tienen dimensión libre validada, etiqueta y reportabilidad declarada; no se presupone un mínimo universal.

## Diferido y dudas

Participantes, invitaciones, OTP, correo, instrumentos, catálogo, respuestas, motor, resultados, exportaciones, workers, OIDC y reglas de divulgación quedan diferidos. No hay nuevas dudas metodológicas necesarias para guardar esta metadata operativa; los GAP-001–GAP-013 no se resuelven. La futura autorización de reportes no dependerá exclusivamente del estado declarado en Segment.

La migración debe preservar exactamente las tablas y datos de Phase 1. Las pruebas usarán MySQL 8 real y seguirán cubriendo la seguridad y E2E existentes.

## Decisiones verificadas durante implementación

- La migración crea sólo AssessmentPerspective y Segment, añade campos nullable a Assessment y enumera sólo valores capturados en esta fase. Incluye backfill DIR/ESP/LID/COL/CLI para diagnósticos Phase 1 existentes. El seed asegura esas filas sin duplicarlas.
- Se añadieron CHECK de MySQL 8 para población no negativa, unidad CLI exclusiva, plan/población sólo en aplicables y ventana planificada coherente. Zod impone las mismas invariantes en el servidor; la UI no decide reglas metodológicas. Estado NULL se mantiene para perspectivas sin configurar.
- El consultor responsable se asigna al creador inicialmente; en General puede cambiarse o dejarse sin asignar durante DRAFT. Cualquier responsable seleccionado debe tener usuario activo, membresía activa del rol requerido y pertenecer a esa organización.
- Las APIs nuevas usan POST/PATCH/DELETE con Origin exacto, JSON máximo 16 KiB, Zod y respuesta sin caché. Sólo cambian registros DRAFT. Los UUID y selects del cliente se revalidan en cada caso de uso. Recurso ajeno responde 404.
- El diagnóstico nuevo con organización nueva requiere que el usuario ya posea al menos una membresía activa IEO_CONSULTANT; no existe un rol global de consultor sin organización en el modelo MVP. La organización creada asigna al creador la membresía adecuada dentro de la misma transacción.
- `Segment` conserva historial simple mediante `active=false`; una clave única (assessmentId,dimension,label) evita duplicados aun si un registro fue desactivado. No hay interfaz de reactivación en Phase 2.
- Se eligieron diálogos nativos HTML para formularios de creación/configuración y botones explícitos de guardado. El formulario General usa React Hook Form. Las fechas previstas se introducen con etiqueta UTC, sin conversión implícita desde la zona del navegador. No existe autosave.
- El script `test:db:prepare` comprueba el nombre de la base `_test`, reinicia exclusivamente sus datos de fixtures dentro de una transacción, migra y aplica seed. Esto evita dependencia entre corridas de E2E y el limitador de login conserva sus umbrales productivos.
- Phase 1 conserva su proyección de metadata para TECH_ADMIN. El workspace completo se entrega sólo si existe membresía organizacional activa; sin ella, el administrador técnico ve la ficha mínima. No se infiere permiso metodológico del flag técnico.
