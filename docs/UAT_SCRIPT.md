# Prueba de aceptación con usuarios (UAT)

Guion para que el equipo IEO recorra el sistema completo antes del piloto y deje constancia de lo que funciona. Se hace **con datos ficticios**: correos inventados y respuestas inventadas. No usar nombres ni correos de personas reales.

## Preparación

| Rol en la prueba | Cuenta | Quién la usa |
|---|---|---|
| Consultor IEO | Cuenta de consultor de la organización de prueba | Consultor del equipo |
| Coordinador interno | Cuenta de coordinador de la misma organización | Otra persona del equipo |
| Custodio metodológico | Cuenta de custodio | Marco o quien él designe |
| Participantes | Correos de prueba del equipo (uno por perspectiva, al menos) | Varias personas del equipo, de preferencia desde su celular |

Antes de empezar: el sistema desplegado en el servidor de prueba, los cinco catálogos cargados y las cuentas creadas. Cada fila se marca **PASS** si el resultado obtenido coincide con el esperado; si no, **FAIL** con una nota de qué pasó y una captura.

## A. Preparar el diagnóstico (consultor)

| ID | Pasos | Resultado esperado | Obtenido | PASS / FAIL |
|---|---|---|---|---|
| A1 | Iniciar sesión y crear un diagnóstico nuevo | El diagnóstico aparece en el listado con estado «Borrador» | | |
| A2 | En «General», capturar objetivo, periodo, fechas planeadas, sponsor y responsables; guardar y recargar | Los datos se conservan | | |
| A3 | En «Perspectivas», clasificar las cinco: al menos dos aplicables, una no aplicable y una no disponible; capturar población estimada | Se guarda la clasificación de cada perspectiva | | |
| A4 | En «Participantes», crear una invitación por cada perspectiva aplicable | Quedan en estado «CREATED» y **no** llega ningún correo todavía | | |
| A5 | En «Cierre», pulsar «Abrir aplicación» | Estado «Abierto»; llegan los correos de las invitaciones creadas | | |

## B. Responder (participantes, desde el celular)

| ID | Pasos | Resultado esperado | Obtenido | PASS / FAIL |
|---|---|---|---|---|
| B1 | Abrir el enlace del correo y pulsar «Continuar y recibir código» | Llega un código de 6 dígitos al correo | | |
| B2 | Escribir un código equivocado y después el correcto | El equivocado se rechaza; el correcto lleva a la introducción | | |
| B3 | Leer la introducción | Aparece la introducción oficial del cuestionario de esa perspectiva y su escala | | |
| B4 | Contestar parte del primer Elemento, cerrar el navegador, volver a entrar con el enlace y un código nuevo | Las respuestas guardadas siguen ahí | | |
| B5 | Dejar un Elemento por debajo del 60 % e ir a «Revisión y envío» | El botón «Enviar» está desactivado y el sistema dice qué Elemento falta | | |
| B6 | (Dirección) Verificar que no existe la opción N/A | No aparece N/A | | |
| B7 | (Voz del Cliente) Llegar a la pantalla «Preguntas abiertas» | Aparecen las 4 preguntas generales | | |
| B8 | Marcar N/A en todas las preguntas de un Elemento (excepto Dirección) | Se puede enviar; ese Elemento se marca «Todo N/A» | | |
| B9 | Completar el mínimo y enviar | Aparece el agradecimiento; al volver a entrar ya no se puede editar | | |
| B10 | Dejar un cuestionario a medias sin enviar | Queda como borrador | | |

## C. Cerrar y procesar (consultor)

| ID | Pasos | Resultado esperado | Obtenido | PASS / FAIL |
|---|---|---|---|---|
| C1 | En «Cierre», pulsar «Cerrar aplicación» | Estado «Cerrado»; la tabla de participación muestra invitados, enviados y borradores | | |
| C2 | Un participante intenta responder después del cierre | El sistema ya no permite responder | | |
| C3 | Excluir un cuestionario enviado como «Duplicado» y después revocar la exclusión | La exclusión aparece y luego desaparece | | |
| C4 | Registrar una incidencia | Aparece en la lista de incidencias | | |
| C5 | Intentar «Congelar» sin dictamen ni checklist | El sistema lo impide y dice qué falta | | |
| C6 | Registrar el dictamen global y el de cada perspectiva aplicable (al menos uno «B» con reservas) y contestar el checklist de 16 puntos | Se guardan | | |
| C7 | «Congelar y autorizar procesamiento» | Estado «Congelado»; se muestra el acta con su hash | | |
| C8 | «Procesar» | Estado «Procesado»; aparece un procesamiento «Exitoso · vigente · publicable» | | |

## D. Resultados (consultor)

| ID | Pasos | Resultado esperado | Obtenido | PASS / FAIL |
|---|---|---|---|---|
| D1 | Abrir «Resultados» | El Índice Global aparece junto con la matriz de 8 Elementos × 5 perspectivas y los índices por perspectiva | | |
| D2 | Revisar una celda con datos, una NP y una ND | Cada una muestra su valor o su motivo | | |
| D3 | Revisar la columna BT | Muestra valor, clase, si es parcial o integrada, y máximo y mínimo | | |
| D4 | Registrar un patrón de triangulación con justificación | Queda registrado con autor | | |
| D5 | Marcar una perspectiva como «No reportable» con motivo | Aparecen las advertencias; el Global y la matriz no cambian | | |
| D6 | Abrir «Ver respuestas» en evidencia cualitativa y redactar una cita | Se guarda la versión redactada y el original sigue igual | | |

## E. Exportaciones y permisos (consultor y custodio)

| ID | Pasos | Resultado esperado | Obtenido | PASS / FAIL |
|---|---|---|---|---|
| E1 | Descargar EXP04 y abrir el ZIP | Contiene manifiesto, instrumentos y reglas | | |
| E2 | Descargar EXP03 de reporte | Si hay una perspectiva no reportable, sus valores y los que la revelarían dicen «SUPRIMIDO_POR_DIVULGACION» | | |
| E3 | Intentar descargar EXP01 | El botón está desactivado: requiere permiso | | |
| E4 | Solicitar permiso de datos crudos con propósito y 7 días | Queda «Pendiente» | | |
| E5 | (Custodio) Entrar a «Custodia» y aprobar la solicitud | Queda «Vigente» | | |
| E6 | (Consultor) Descargar EXP01 y abrirlo en Excel | Una fila por respuesta, participantes como P0001…, sin correos | | |
| E7 | Revocar el permiso e intentar descargar de nuevo | Ya no se puede | | |

## F. Controles de acceso

| ID | Pasos | Resultado esperado | Obtenido | PASS / FAIL |
|---|---|---|---|---|
| F1 | (Coordinador) Entrar al diagnóstico | Ve la información general y las perspectivas, **no** ve Participantes, Cierre, Resultados ni Exportaciones | | |
| F2 | (Consultor de otra organización) Intentar abrir el diagnóstico por su dirección | «Página no disponible» | | |
| F3 | (Custodio) Intentar ver resultados de un diagnóstico | No tiene acceso | | |
| F4 | Cerrar sesión, volver con «atrás» y recargar la página | Pide iniciar sesión de nuevo | | |

## Cierre de la prueba

| Campo | Registro |
|---|---|
| Fecha | |
| Servidor y versión (commit) | |
| Participantes en la prueba | |
| Escenarios PASS / total | |
| FAIL encontrados y su corrección | |
| Aprobación del consultor IEO | |
| Aprobación del custodio metodológico | |

Criterio: el piloto se abre sólo si todos los escenarios críticos (B5, B9, C2, C7, C8, D1, E3, E7, F1, F2) están en PASS y los demás FAIL tienen corrección acordada.
