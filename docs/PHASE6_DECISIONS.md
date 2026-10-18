# Phase 6 — decisiones previas al código

Estado: **aprobada el 2026-10-18**. Phase 5B está terminada ([PHASE5B_VALIDATION.md](PHASE5B_VALIDATION.md)). Phase 6 muestra los resultados de un diagnóstico procesado y da al consultor las herramientas para interpretarlos: matriz de triangulación, patrones, evidencia cualitativa y decisión de qué se puede reportar. Sigue siendo con datos de prueba (GAP-012).

## Quién ve resultados

Sólo el **Consultor IEO** con membresía activa en la organización (Especificaciones §39). El coordinador, el administrador técnico y cualquier otro rol no acceden a resultados ni a respuestas abiertas. Ningún participante ni directivo ve respuestas individuales.

## Alcance

### 1. Pestaña «Resultados»

Disponible cuando el diagnóstico tiene un procesamiento exitoso. Muestra el run vigente; los anteriores se pueden consultar, marcados como históricos.

- **Índice Global**: valor entero, nivel de salud y semáforo, con estado COMPLETO / LIMITADO (indicando qué Elementos tienen una sola perspectiva) / NO DISPONIBLE (con el motivo). **Nunca aparece solo**: va en la misma pantalla que la matriz y los índices por perspectiva (Modelo §16).
- **Matriz 8 Elementos × 5 perspectivas** (Especificaciones §34): RP de cada celda con el número de personas válidas, o la etiqueta ND (con su motivo: sin evidencia, no disponible, dictamen C) o NP. Columnas de **RI** (integrado / limitado / ND) y **BT** (valor entero, clase, parcial con 2 perspectivas o integrada con 3 o más, y qué perspectivas son el máximo y el mínimo).
- **Índice por perspectiva**: valor y nivel cuando tiene los 8 Elementos; si no, ND y sus RP por Elemento.
- **Cobertura** por perspectiva y Elemento: cuántas personas tienen PI válida frente a cuántos cuestionarios se analizaron. No se muestra ninguna PI individual (GAP-011).
- **Presentación** (Modelo §13): RP y RI con un decimal, BT y Global como enteros, con la misma regla de redondeo (un .5 exacto baja). El valor exacto queda disponible en un detalle técnico.
- Avisos visibles: «PRUEBA — datos ficticios», «No publicable (dictamen C global)» y las reservas del dictamen B junto a la perspectiva correspondiente.

### 2. Patrones de triangulación

Por cada Elemento, el consultor **registra** uno de los cinco patrones oficiales (fortaleza consistente, erosión consistente, brecha de percepción, resultado mixto, evidencia limitada) con una justificación obligatoria. La pantalla muestra los datos que lo sustentan (RP y su nivel, BT y su clase), pero **el sistema no asigna ni sugiere patrones**: sus criterios están en el Protocolo de Triangulación, que no se ha recibido (GAP-002), y las especificaciones prohíben automatizar interpretaciones causales. Cada patrón queda ligado al run, con autor y fecha; cambiarlo crea un registro nuevo.

### 3. Evidencia cualitativa

El consultor consulta las respuestas abiertas de los cuestionarios analizados en la copia congelada, filtradas por perspectiva y Elemento, en orden aleatorio y **sin ningún identificador** de sesión o persona. Por cada respuesta puede marcar: pendiente, apta para reporte, redactada (con el texto anonimizado) o no citar. **El texto original nunca se modifica**; la versión redactada se guarda aparte.

### 4. Revisión de divulgación

Antes de reportar, el consultor marca los resultados de cada perspectiva como **reportables o no reportables**, con motivo. No hay un mínimo universal (Protocolo §13, Especificaciones §41): el sistema sólo **advierte** cuando una perspectiva tiene pocas personas válidas (menos de 3) o cuando ocultarla no basta porque podría deducirse del RI o la BT con las demás. Ocultar una perspectiva no la quita del cálculo: el RI, la BT y el Global no cambian. La decisión queda ligada al run; un run nuevo exige revisarla otra vez.

## Tablas nuevas

`TriangulationPattern` (run, Elemento, patrón, justificación, autor, fecha), `QualitativeReview` (respuesta abierta, run, estado, texto redactado, autor, fecha) y `DisclosureReview` (run, perspectiva, decisión, motivo, autor, fecha). Todo con FKs reales, `ON DELETE RESTRICT` y auditoría sin contenido de respuestas.

## Fuera de alcance

Reporte diagnóstico automático (falta la Plantilla Oficial, GAP-002), exportaciones (Phase 7), cortes por segmento (la captura no registra todavía el segmento de cada participante), acceso a PI individuales (GAP-011) y participantes reales (GAP-012).

## Pruebas y definición de terminado

- Unit: formato de presentación (decimales, redondeo, etiquetas ND/NP/LIMITED), advertencias de divulgación y validación de patrones.
- Integración MySQL: sólo el consultor de la organización lee resultados y abiertas; el coordinador y otra organización no; las abiertas no traen identificadores ni sesiones excluidas o en borrador; una respuesta redactada conserva el original; patrones y divulgación ligados al run; ocultar una perspectiva no cambia RI, BT ni Global; un run nuevo exige revisar la divulgación otra vez.
- Playwright: el consultor recorre resultados (Global junto a la matriz), registra un patrón, redacta una cita y marca una perspectiva como no reportable, en escritorio y móvil.
- Las suites anteriores siguen pasando.
