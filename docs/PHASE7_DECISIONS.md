# Phase 7 — decisiones previas al código

Estado: **aprobada el 2026-10-18**. Phase 6 está terminada ([PHASE6_VALIDATION.md](PHASE6_VALIDATION.md)). Phase 7 agrega las cuatro exportaciones oficiales, los permisos excepcionales para datos individuales (GAP-011), la auditoría de lecturas y descargas, y los procedimientos de respaldo, restauración y reproducción histórica. Sigue siendo con datos de prueba (GAP-012).

## Permisos excepcionales (GAP-011, propuesta provisional)

- **Custodio metodológico**: nueva marca global de usuario (como `technicalAdmin`), asignada sólo por operación técnica controlada. Es quien aprueba accesos excepcionales; en la práctica, Marco o quien él designe. El seed crea `custodio@ieo.local`.
- **Permiso por diagnóstico** (`SensitiveAccessGrant`) con un alcance: **datos crudos** (EXP01), **puntuaciones individuales** (PI en EXP03 técnico) o **cualitativo original** (EXP02 completo). El Consultor IEO lo solicita con propósito y vigencia (máximo 30 días); el custodio lo aprueba o rechaza; cualquiera de los dos puede revocarlo. **Nadie aprueba su propia solicitud** y el administrador técnico no aprueba.
- Cada descarga revalida que el permiso siga vigente.
- **Lectura en pantalla**: el consultor del diagnóstico sigue leyendo las respuestas abiertas para revisarlas y redactarlas, como pide la especificación §16 y como se aprobó en Phase 6; cada lectura queda auditada (cuántas respuestas, sin su contenido). Lo que exige permiso es **exportar** originales, crudos o PI.

## Exportaciones (S05 `12_EXPORTACIONES`)

| Código | Contenido | Quién | Reglas |
|---|---|---|---|
| **EXP04** Metadatos | Paquete, instrumentos y versiones con sus hashes, reactivos (código, Elemento, orientación, N/A), reglas y políticas del motor, hashes de la copia congelada y del run | Consultor | Sin datos de participantes |
| **EXP03** Resultados (reporte) | RP, RI, BT y su clase, índices, Global, estados, motivos y cobertura | Consultor | Exige run publicable y revisión de divulgación de todas las perspectivas aplicadas. Una perspectiva no reportable se suprime, y también el RI, la BT y el Global en que participa, porque la revelarían |
| **EXP03** Técnico | Lo anterior sin supresión, más una fila de PI por persona seudónima y Elemento | Consultor con permiso de puntuaciones individuales | Para auditoría y reproducción |
| **EXP02** Cualitativas (reporte) | Respuestas aptas (texto original) y redactadas (texto redactado), con perspectiva, Elemento y pregunta | Consultor | Nunca pendientes ni «no citar»; omite perspectivas no reportables; sin seudónimo de sesión, para que no se crucen con EXP01 |
| **EXP02** Completo | Todas las respuestas, texto original, estado de revisión y seudónimo | Consultor con permiso cualitativo | |
| **EXP01** Crudos | Una fila por respuesta cuantitativa: seudónimo, perspectiva, reactivo, respuesta original (1–5, NA o vacía) y fecha de envío (sólo el día) | Consultor con permiso de datos crudos | |

- Se exporta siempre desde un run exitoso y su copia congelada, nunca desde datos vivos. Los seudónimos (`P0001`…) son propios de cada descarga y distintos de cualquier ID de sesión o invitación.
- **Formato**: un ZIP con CSV UTF-8 y un `manifest.json` (tipo, variante, diagnóstico, revisión, run, hashes de copia y resultado, versión del motor, permiso usado, filas, SHA-256 de cada archivo, quién y cuándo). Los valores numéricos van como fracción exacta y decimal.
- **Fórmulas peligrosas**: toda celda de texto que empiece con `=`, `+`, `-`, `@`, tabulador o retorno se antepone con un apóstrofo, y el manifiesto lo declara para poder revertirlo.
- Cada descarga se registra en `ExportRecord` y en la auditoría (tipo, variante, filas, hash, permiso), sin contenido. Se genera al momento de descargar, no se guardan archivos, y la respuesta lleva `no-store`.

## Respaldo, restauración y reproducción

- `scripts/backup.sh`: `mysqldump` consistente cifrado con una clave independiente (fuera del repositorio), más instrucciones para respaldar las claves de cifrado por separado.
- `npm run verify:history`: recalcula el SHA-256 de cada copia congelada y vuelve a ejecutar el motor sobre ella, comparando el hash de salida con el guardado. Se usa después de restaurar para demostrar la reproducción histórica. Se prueba restaurando un respaldo en una base aparte.
- Documento de operación: permisos mínimos del usuario MySQL de la aplicación, rotación de secretos, RPO/RTO a definir con el cliente y lo que se pierde si se pierden las claves.

## Endurecimiento y pruebas de seguridad

Encabezados de seguridad (CSP completa, `nosniff`, `frame-ancestors`), `no-store` en toda respuesta con datos, y pruebas explícitas de: acceso cruzado entre organizaciones (IDOR) en exportaciones y permisos, CSRF en las mutaciones nuevas, texto abierto con HTML/JS mostrado como texto, inyección de fórmulas en CSV, permisos vencidos o revocados y autoaprobación.

## Trazabilidad con las fuentes

| Decisión | Origen |
|---|---|
| Cuatro exportaciones y sus campos | S05 `12_EXPORTACIONES`; Especificaciones §35–37 |
| Datos individuales sólo con autorización protegida | Documento Maestro (función metodológicamente autorizada y protegida); Especificaciones §39 |
| Custodio aprobador, sin autoaprobación, vigencia máxima 30 días | Propuesta provisional (GAP-011): las fuentes exigen la autorización pero no definen quién la otorga |
| Reportabilidad decidida por el consultor, sin mínimo universal | Protocolo §13; Especificaciones §41 |
| Suprimir RI, BT y Global que revelarían una perspectiva no reportable | Consecuencia técnica de la decisión del consultor (riesgo por combinaciones, Protocolo §13) |
| EXP02 de reporte sin seudónimo de sesión | Desviación de S05 (`response_session_id`) para evitar el cruce con EXP01; la variante completa con permiso lo incluye |
| Fecha de envío por día en EXP01 | Ajuste de S05 (`answered_at`) para reducir riesgo de identificación |
| ZIP, manifiesto, neutralización de fórmulas, respaldo cifrado | Técnico, de `SECURITY.md` (Phase 0) |

## Tablas nuevas

`SensitiveAccessGrant` y `ExportRecord`; `User` agrega `methodologyCustodian`.

## Fuera de alcance

XLSX (CSV es suficiente según el plan), reporte diagnóstico automático (GAP-002), cortes por segmento, aviso de privacidad y retención (GAP-012) y participantes reales.

## Pruebas y definición de terminado

- Unit: escritura CSV y neutralización de fórmulas, ZIP y manifiesto, reglas de supresión por divulgación, vigencia de permisos.
- Integración MySQL: cada exportación con y sin permiso; supresión correcta; ninguna exportación ordinaria con IDs de sesión, correos o PI; permiso vencido, revocado o autoaprobado rechazado; IDOR; auditoría de lecturas y descargas; `verify:history` reproduce los hashes.
- Playwright: el consultor descarga EXP04, EXP03 y EXP02 de reporte; solicita un permiso; el custodio lo aprueba; el consultor descarga EXP01.
- Prueba de restauración documentada con su evidencia. Las suites anteriores siguen pasando.
