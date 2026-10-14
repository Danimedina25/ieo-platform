# Dudas metodológicas IEO®

Estado: abiertas para revisión del custodio metodológico. No constituyen reglas aprobadas. Las referencias S01–S12 se resuelven en [ARCHITECTURE.md](ARCHITECTURE.md). Los originales están en `docs/`; `docs/requirements` no existe en esta entrega. Cada resolución deberá identificar responsable, fecha, fuente aprobada, versión afectada y casos de aceptación. Una duda bloquea la funcionalidad dependiente, no todo el proyecto.

### GAP-001

Document: S01 §3 y §16; S05 `00_README!B7`, `13_VERSIONADO!A5:G5`.
Requirement: Conservar la versión y procedencia del Banco Maestro 2.0 Sincronizado.
Question: ¿Se entregará el Banco Maestro referido o se certificará formalmente el diccionario Excel como copia equivalente del banco para esta aplicación? El archivo del banco no está disponible; el diccionario sí contiene 329 reactivos y 28 abiertas.
Technical impact: No puede certificarse la equivalencia ni inventarse un hash del banco ausente. Bloquea publicar el paquete metodológico definitivo, no diseñar ni probar el importador.
Suggested options, if applicable: Entregar el banco; o emitir certificación versionada con alcance y diferencias, preservando ambas fuentes.

### GAP-002

Document: S01 §3, §16; S06 §31 y §51.
Requirement: Integración, triangulación e interpretación conforme a sus fuentes oficiales.
Question: Faltan el Protocolo Oficial de Integración y Triangulación 1.1, la Guía Oficial de Interpretación y Aplicación 1.1 y la Plantilla Oficial de Reporte Diagnóstico. ¿Cuál es el paquete vigente y qué reglas adicionales contiene, particularmente para patrones y evidencia limitada?
Technical impact: Las fórmulas documentadas de BT y RI pueden especificarse; no se pueden certificar todos los patrones ni la compatibilidad de salida con una plantilla no recibida. No bloquea la arquitectura básica; sí la aceptación completa de Phase 6.
Suggested options, if applicable: Recibir las fuentes o una especificación oficial sustitutiva con reglas y ejemplos. No inferir causalidad ni automatizar patrones sin regla.

### GAP-003

Document: S07, Elemento IV, reactivo 28; S05 `04_REACTIVOS!B31` y `L31`; S01 §3.
Requirement: Texto exacto y sincronizado del instrumento.
Question: Word dice «mi líder inmediato»; Excel dice «mi jefe inmediato» en COL_E04_R028. La jerarquía documental ya da precedencia al cuestionario. ¿Cómo formalizará el custodio la corrección del diccionario/banco y su versión antes de publicar la importación?
Technical impact: Rechazar una importación certificada como idéntica mientras exista esta diferencia. Conservar el texto de Word como fuente primaria, sin modificar silenciosamente archivos oficiales.
Suggested options, if applicable: Fe de erratas versionada o nueva entrega sincronizada. La precedencia no necesita inventarse; la corrección oficial sigue pendiente.
Resolution: **Resuelto** (confirmado por Daniel Medina, 2026-10-14): el texto oficial de COL_E04_R028 es «mi **líder** inmediato», como en el Word. El importador usará ese texto y dejará registrada la diferencia con el Excel S05 («jefe»); los archivos originales no se modifican. Una fe de erratas formal del diccionario queda como mejora documental, no como bloqueo.

### GAP-004

Document: S04 §9 (`required` según configuración oficial); S02 §8 y §11; S05 cabeceras de `04_REACTIVOS` y `05_ABIERTAS`; S07–S11.
Requirement: Obligatoriedad compatible con participación voluntaria e instrumentos incompletos.
Question: No hay campo `required` por pregunta en el Excel ni una regla explícita de obligatoriedad en los instrumentos. ¿Qué preguntas son obligatorias y puede enviarse definitivamente un cuestionario con omisiones, incluidas abiertas?
Technical impact: Bloquea validación definitiva del envío; no convertir cada pregunta en obligatoria ni asignar N/A automáticamente. Borradores y distinción MISSING/NA sí pueden diseñarse.
Suggested options, if applicable: Matriz oficial por pregunta/tipo y ejemplos de envío parcial permitido.
Resolution: **Resuelto** por Marco (custodio metodológico), comunicado por Pedro Eloy Rodríguez; registrado 2026-10-14. (1) Ningún reactivo es obligatorio de forma individual; las omisiones cuantitativas se conservan como MISSING, nunca como NA. (2) Las preguntas abiertas son opcionales; se puede enviar con todas vacías. (3) El envío definitivo sólo se permite si **cada uno de los Elementos** del instrumento alcanza cobertura ≥ 60 %, con cobertura = respondidos válidos / (reactivos del Elemento − NA), igual que T06N, en todos los instrumentos. Ejemplo: 10 reactivos con 2 NA → se requieren ≥ 5 válidos (5/8 = 62.5 %). (4) Por debajo del umbral, el cuestionario queda guardado como borrador y no puede enviarse. Nota: las fuentes (Protocolo §11, Especificaciones §17, Modelo Matemático §5.1) usan el 60 % sólo para calcular la PI de cada Elemento después del cierre (ND si no se alcanza); el bloqueo del envío es una regla nueva del custodio y por ahora no se incorporará a una versión oficial del Protocolo/Especificaciones (decisión confirmada 2026-10-14); este registro es su fuente de trazabilidad. Elemento con todos sus reactivos NA (0/0): ver GAP-006. Casos de aceptación por aprobar: frontera exacta 60 %, 59.x %, mezcla NA+MISSING, un solo Elemento por debajo del umbral.

### GAP-005

Document: S06 §17 (conservar registros guardados o enviados); S02 §11 y §17; S05 `08_CAMPOS`, estados STARTED/SUBMITTED/INVALIDATED.
Requirement: Evaluar incompletos por Elemento y preservar envío voluntario.
Question: Al cerrar, ¿un borrador guardado pero nunca enviado puede incorporarse al cálculo? ¿Qué aceptación informada y acto de autorización lo habilitan? Las fuentes ordenan conservarlo, pero no distinguen claramente conservación de inclusión analítica.
Technical impact: Congelar todos los registros preserva evidencia; la selección del conjunto analítico requiere regla aprobada. No incluir ni descartar automáticamente borradores. Bloquea procesar un conjunto con esta situación sin resolución.
Suggested options, if applicable: Sólo enviados, o borradores con consentimiento y criterio explícito. Ninguna opción se adopta aquí.
Resolution: **Resuelto** (Marco vía Pedro; complemento decidido por Daniel Medina, 2026-10-14, confirmado 2026-10-14): sólo los cuestionarios con envío definitivo (SUBMITTED) entran al cálculo. Todo borrador se conserva pero no entra, alcance o no el umbral de GAP-004. El cálculo se ejecuta tras el cierre sobre los enviados; no espera a que todos los invitados cumplan, porque la participación es voluntaria. La suficiencia de participación por perspectiva (cuántas personas) es otro tema: GAP-009.

### GAP-006

Document: S12 `03_COBERTURA!F4:G6`, nota A8; S05 `08_CAMPOS` coverage_rate obligatorio, R005/R006; S03 §5.
Requirement: Cobertura y PI cuando todo un Elemento es N/A.
Question: El denominador es total menos N/A; si todos son N/A queda 0/0. La matriz deja la cobertura vacía cuando el denominador es cero. ¿Qué coverage_status y reason_code oficiales corresponden y se admite coverage_rate NULL? No existe evidencia para producir una PI numérica.
Technical impact: Nunca dividir por cero ni inventar 0 % o 100 %. Reservar valor nulo y motivo técnico pendiente; acordar estado oficial y fixture antes de certificar ese caso.
Suggested options, if applicable: Definición explícita de ND, cobertura no calculable y motivo, con ejemplo oficial.
Resolution: **Resuelto** (propuesta confirmada 2026-10-14): para el umbral de envío de GAP-004, un Elemento con todos sus reactivos en NA (0/0) **no bloquea el envío**, porque NA es una respuesta legítima y las instrucciones oficiales piden no responder por intuición. Bloquearlo sería incoherente con 1 válido + resto NA = 100 %. El cuestionario entra al cálculo; ese Elemento queda ND para esa persona (sin PI) y no cuenta en Nₚ al calcular su RP. Sus demás Elementos sí entran. Sigue pendiente el coverage_status/reason_code oficial.

### GAP-007

Document: S03 §§10, 13–15; S05 `11_REGLAS!D13:D16`; S12 `06_BT` y `08_GLOBAL`.
Requirement: Clasificaciones y redondeo deterministas sin redondeo intermedio.
Question: ¿Cómo clasificar BT=12.4/12.5/24.8/37.5 y salud=79.5/89.5/94.5? Los intervalos escritos dejan huecos decimales; el modelo recomienda entero final pero no precisa si la clase usa el valor exacto o redondeado ni cómo resolver empates .5. ¿La misma política aplica a PI/RP/RI y Global?
Technical impact: Bloquea clasificación automática completa y reporte ejecutivo; las fórmulas y valores exactos siguen siendo especificables. No extender intervalos por decisión técnica.
Suggested options, if applicable: Clasificar tras redondeo oficial o definir intervalos continuos sobre el valor exacto; aprobar ejemplos para cada frontera y una regla de empate.

### GAP-008

Document: S03 §§9 y 12.1; S04 §§28–29; S05 `09_ESTADOS!A22:E24`; S06 §27.
Requirement: Diferenciar COMPLETE, LIMITED y ND; IEO por perspectiva parcial.
Question: Con menos de ocho RI INTEGRATED, ¿LIMITED lleva un valor numérico o sólo una limitación? ¿Cuál es la frontera entre LIMITED y ND global? Para IEO por perspectiva con Elementos faltantes, ¿se omite el índice o se admite un parcial y con qué fórmula/etiqueta?
Technical impact: No promediar arbitrariamente los Elementos disponibles ni llamar completo al promedio de ocho RI LIMITED. Mantener los resultados válidos por Elemento y bloquear la salida global parcial no definida.
Suggested options, if applicable: Omitir índices incompletos o publicar una fórmula parcial explícita y versionada; ninguna se selecciona.

### GAP-009

Document: S02 §§7 y 16–17; S05 `10_RESULTADOS!F5`; S03 §8.
Requirement: RP exige PI válidas y suficiencia metodológica; dictamen A/B/C.
Question: ¿Cómo se traduce un dictamen C global, por perspectiva o excepcionalmente por Elemento en elegibilidad para RP, BT, RI y Global? ¿Puede haber cálculo técnico restringido pero no publicación? ¿Qué reservas de B deben acompañar cada salida?
Technical impact: El porcentaje de participación no sustituye el juicio del consultor. Registrar dictamen por alcance y elegibilidad explícita; no inferir automáticamente que una PI válida habilita publicación. Se necesita regla de transición y fixtures.
Suggested options, if applicable: Tabla oficial dictamen × alcance × permiso de cálculo/publicación, conservando reservas.

### GAP-010

Document: S04 §§34–36; S05 `07_ENTIDADES!E21` (exclusion mutable_after_freeze=1), R020; S01 §11; S06 §33.
Requirement: Exclusiones y correcciones excepcionales sin perder congelamiento.
Question: ¿Quién autoriza reaperturas/correcciones, qué puede corregirse y cómo afectan exclusiones a un reactivo frente a una sesión completa y al denominador? El Excel marca exclusiones mutables después de freeze, mientras S04 congela las exclusiones aprobadas.
Technical impact: La propuesta preserva snapshots y originales, pero no habilita cambios sobre una revisión congelada. Bloquea el procedimiento excepcional y la exclusión por reactivo hasta su definición.
Suggested options, if applicable: Nueva revisión autorizada con acta y motivo, manteniendo la anterior. Precisar si sólo se excluyen sesiones o también reactivos y el tratamiento matemático de estos últimos.

### GAP-011

Document: S01 §10 y §12; S02 §§2–3 y §13; S06 §§35–41.
Requirement: Exportar crudos y PI para auditoría sin dar acceso individual automático.
Question: ¿Qué autoridad concede acceso excepcional a crudos, PI y texto cualitativo original, a quién, con qué propósito y vigencia? Las fuentes permiten una función metodológicamente autorizada y protegida, pero no definen su aprobación.
Technical impact: Los tres roles administrativos no bastan para autorizar datos individuales. Diseñar permisos específicos por diagnóstico y denegar por defecto; no habilitar EXP01 ni PI de EXP03 por el solo rol de consultor/técnico.
Suggested options, if applicable: Designar custodio aprobador y permisos temporales de auditoría/revisión cualitativa. No conceder facultad de aprobación implícita.

### GAP-012

Document: S02 §9 y §13; S04 §21 y §36; S06 §13 y §39–41.
Requirement: Confidencialidad, uso informado, minimización y reproducibilidad histórica.
Question: No se define plazo de conservación de correos, vínculo protegido, borradores, originales y backups, ni el tratamiento de retiro de participación frente a datos congelados. ¿Cuál es la política aprobada y qué texto informado la explica?
Technical impact: No prometer anonimato irreversible ni retención indefinida. Diseñar separación, expiración de credenciales y purga de secretos; no fijar retención de evidencia metodológica por cuenta propia. Resolver antes de levantar datos reales.
Suggested options, if applicable: Calendario diferenciado de identidad, evidencia y respaldo, con alcance explícito de retiro y repercusión sobre reproducción histórica.

### GAP-013

Document: S12 `02_REACTIVOS!J8`, caso T05; `07_RI!M5`; `10_ACEPTACION`.
Requirement: Todos los 23 casos críticos deben obtener PASS.
Question: El comparador de T05 devuelve vacío si platform_score_100 está vacío, aunque el derivado esperado es NULL; no puede certificar PASS de ese caso mediante esa celda. M5 de T19 compara valor pero no valida LIMITED. ¿Se aprueba una matriz corregida o un registro automatizado que compare explícitamente valor, nulidad y estado?
Technical impact: Un Excel sin FAIL no equivale a aceptación completa. Los tests deberán verificar las expectativas documentadas, incluidos estados, y adjuntar la discrepancia del comparador sin alterar el original.
Suggested options, if applicable: Fe de erratas del evaluador o aceptación firmada de fixtures tipados que preserven todas las expectativas oficiales.

### GAP-014

Document: Propuesta de Pedro Eloy Rodríguez (2026-10-14), no aprobada por Marco; S07–S11 (orden de los instrumentos); [ARCHITECTURE.md](ARCHITECTURE.md) (`displayOrder` oficial).
Requirement: Mostrar los instrumentos en su orden oficial.
Question: Pedro propone rotar el orden de los Elementos por participante para que las omisiones no se concentren en los últimos Elementos. ¿Lo aprueba el custodio? Si se aprueba: ¿se rotan bloques completos de Elemento o reactivos individuales?, ¿cómo quedan las abiertas y la introducción?, ¿afecta la validez del instrumento por efectos de orden?
Technical impact: Con el umbral ≥ 60 % por Elemento (GAP-004), ningún cuestionario enviado puede tener un Elemento sin evidencia suficiente, así que la rotación aporta menos que con un umbral global. Si se adopta, hay que guardar la semilla y el orden mostrado en ResponseSession para auditar y reanudar con el mismo orden. Hasta entonces se conserva el orden oficial.
Source conflict: El Protocolo Oficial de Aplicación §10 exige conservar "integridad de reactivos, orden del instrumento, escala y opciones de respuesta" en cualquier modalidad, y el Documento Maestro §5.4 indica "No alterar texto, orden, escala u orientación". La rotación contradice ambas fuentes; sólo podría adoptarse con una modificación oficial versionada del Protocolo aprobada por Marco.
Suggested options, if applicable: Mantener orden oficial (conforme a fuentes); o rotación de bloques completos por Elemento con orden persistido por sesión, sólo tras cambio oficial del Protocolo.
Resolution: **Descartado por ahora** (confirmado 2026-10-14). Se mantiene el orden oficial de cada instrumento. Podría reconsiderarse con evidencia del pilotaje y un cambio oficial del Protocolo.
