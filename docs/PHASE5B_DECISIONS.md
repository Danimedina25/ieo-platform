# Phase 5B — decisiones previas al código

Estado: **aprobada el 2026-10-18 e implementada**; evidencia en [PHASE5B_VALIDATION.md](PHASE5B_VALIDATION.md). Phase 5A está terminada ([PHASE5A_ACCEPTANCE.md](PHASE5A_ACCEPTANCE.md)). Phase 5B conecta el motor con los diagnósticos: abrir, cerrar, documentar el cierre, congelar los datos y procesarlos. Usa las reglas provisionales de GAP-009 y GAP-010 adoptadas el 2026-10-17. Todos los datos siguen siendo de prueba (`isTest=true`) mientras GAP-012 siga abierto.

## Ciclo de vida

| Estado | Qué se permite | Para avanzar |
|---|---|---|
| DRAFT | Configurar alcance, perspectivas y segmentos; crear invitaciones | **Abrir**: paquete fijado y las cinco perspectivas clasificadas, al menos una aplicable |
| OPEN | Los participantes responden y envían | **Cerrar** (acto explícito del consultor) |
| CLOSED | Nadie responde; el consultor registra exclusiones, incidencias, dictamen y checklist | **Congelar y autorizar procesamiento**: acta completa |
| FROZEN | Se lee la copia congelada; se ejecuta el motor | **Procesar** con éxito |
| PROCESSED | Resultados disponibles (pantallas en Phase 6); se puede reprocesar | — |

- Los participantes **sólo pueden responder en OPEN**. Las invitaciones se pueden crear en DRAFT u OPEN. Si `plannedClosesAt` ya pasó, el servidor rechaza guardar y enviar aunque el consultor no haya cerrado; cerrar sigue siendo un acto explícito, sin tareas programadas.
- Alcance, perspectivas y segmentos sólo se editan en DRAFT, como hoy.
- **Reapertura** (GAP-010): el Consultor IEO puede reabrir un diagnóstico CLOSED, FROZEN o PROCESSED con un motivo obligatorio. Se crea la revisión siguiente y vuelve a OPEN; el acta, la copia congelada y los resultados de la revisión anterior se conservan intactos.
- Sólo el **Consultor IEO** con membresía activa ejecuta estas acciones. El coordinador ve el estado, sin datos.

## Cierre (estado CLOSED)

- **Participación por perspectiva:** invitados, enviados y borradores, calculados por el sistema (no se capturan a mano).
- **Exclusiones:** sólo de cuestionarios completos y enviados, con motivo de una lista (duplicado, prueba, fuera de la población, incidencia técnica, manipulación reportada) y descripción. El consultor elige la invitación; el servidor resuelve la sesión sin mostrar respuestas. Se pueden revocar mientras el diagnóstico esté CLOSED.
- **Incidencias** (Anexo C del Protocolo): fecha, perspectiva, descripción, impacto, acción y responsable.
- **Dictamen de calidad** (Protocolo §16): uno global (A/B/C) y uno por perspectiva aplicable; excepcionalmente por perspectiva y Elemento. B y C exigen el texto de reservas.
- **Checklist oficial** (Anexo D): los 16 puntos con Sí / No / N/A y observación. Todos deben contestarse.
- **Acta** (Anexo E): se arma con los datos anteriores más organización, alcance, instrumentos y versiones, fechas reales de apertura y cierre, consultor responsable y fecha de autorización. Se guarda con su hash.

## Congelamiento y procesamiento

- **Congelar** crea una copia inmutable (`FrozenSnapshot`) con su SHA-256: sesiones enviadas no excluidas, respuestas cuantitativas crudas por código de pregunta, instrumentos y versiones, alcance de las cinco perspectivas y dictámenes. Sin correos, invitaciones, vínculos de identidad ni texto abierto. Los borradores no entran (GAP-005).
- **Procesar** ejecuta el motor de 5A sobre esa copia y crea un `ProcessingRun` con la versión del motor, los hashes de entrada y salida, y el resultado exacto completo. Un fallo deja el run en FAILED y no publica nada parcial. Reprocesar crea un run nuevo sin borrar los anteriores; el diagnóstico apunta al último exitoso.
- **Resultados guardados en tablas:** RP por perspectiva y Elemento (40), BT y RI por Elemento (8), IEO por perspectiva (5) e IEO Global (1), para que Phase 6 los consulte. **Las PI individuales sólo quedan en el resultado exacto del run**, no en tablas, porque su acceso requiere la autorización de GAP-011.
- Con **dictamen C global**, el run se ejecuta y se conserva para auditoría, pero queda marcado como **no publicable**.

## Tablas nuevas

`ClosureRecord`, `QualityAssessment`, `Exclusion`, `Incident`, `FrozenSnapshot`, `ProcessingRun`, `PerspectiveElementResult`, `ElementResult` (BT + RI), `PerspectiveIndexResult` y `GlobalResult`. `Assessment` agrega `revisionNumber`, fechas reales de apertura y cierre, y el run vigente. Todo con FKs reales, `ON DELETE RESTRICT` y CHECK de puntajes 0–100 y estados.

## Pantalla

Una pestaña **Cierre** en el workspace del diagnóstico: estado y acciones (abrir, cerrar, reabrir), participación, exclusiones, incidencias, dictamen, checklist, vista previa del acta, congelar y procesar, y el estado técnico de cada run (versión, hashes, publicable). Los resultados en sí se muestran en Phase 6.

## Fuera de alcance

Pantallas de resultados y triangulación (Phase 6), revisión de divulgación y cualitativa (Phase 6), exportaciones (Phase 7), cierre automático por calendario, estado ARCHIVED y participantes reales (GAP-012).

## Pruebas y definición de terminado

- Unit: transiciones permitidas y prohibidas, armado del snapshot (sin identidad, sin borradores ni excluidos), validación de acta, checklist y dictamen.
- Integración MySQL: ciclo completo DRAFT → PROCESSED con los cinco instrumentos; respuestas rechazadas fuera de OPEN y tras `plannedClosesAt`; exclusión que cambia el resultado; dictamen C de perspectiva y global; reproceso con el mismo hash de salida; reapertura que conserva la revisión anterior; permisos (coordinador, otra organización); el resultado del run coincide con el motor ejecutado directamente.
- Playwright: el consultor recorre abrir → participantes responden → cerrar → dictamen y checklist → congelar → procesar.
- Las suites anteriores siguen pasando, adaptadas a que ahora se responde sólo en OPEN.

## Cierre de implementación

- `src/domain/closure` (transiciones, checklist del Anexo D, validaciones, copia congelada y acta), `src/application/closure.ts` (servicios con bloqueo de fila del diagnóstico y auditoría) y la pestaña **Cierre** (`closure-workspace.tsx`) con sus rutas en `/api/assessments/[id]/…`.
- **Detalle añadido:** una invitación creada en DRAFT queda en CREATED sin enviarse; al abrir el diagnóstico se envía con un token nuevo, para que nadie reciba un enlace que todavía no funciona.
- Las exclusiones pertenecen a su revisión: al reabrir, la revisión nueva empieza sin exclusiones ni dictámenes.
- Las relaciones de `ClosureRecord.authorizedById` y `Exclusion.revokedById` usan `ON UPDATE RESTRICT` para poder validar con CHECK (mismo motivo que en Phase 3B).
- El seed agrega «Aplicación de prueba A 2026» (abierta, cinco perspectivas aplicables) para las pruebas de participantes; «Diagnóstico Demo A 2026» sigue en DRAFT para las del workspace.
- Las pruebas E2E reutilizan la sesión del consultor: el limitador de login (10 intentos por cuenta cada 15 minutos) se rebasaba con la suite completa.
- El run guarda el resultado exacto del motor; las tablas tipadas son proyecciones con `DECIMAL(30,18)` y la fracción exacta en texto. Las PI individuales sólo están en el resultado exacto.
