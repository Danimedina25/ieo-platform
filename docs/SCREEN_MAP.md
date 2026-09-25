# Mapa de pantallas y dirección visual

> **Alcance incremental:** este documento conserva la arquitectura objetivo de Phase 0. Phase 1 implementó login y seis entidades; Phase 2 agregó el workspace DRAFT y dos entidades (AssessmentPerspective, Segment). OIDC, SensitiveAccessGrant, DisclosureReview, procesamiento/worker, revisiones detalladas y correo: **Deferred / Not implemented in Phase 1**. El alcance vigente está en [PHASE2_DECISIONS.md](PHASE2_DECISIONS.md); las rutas y entidades futuras de este documento no implican implementación actual.

Propuesta: **10 vistas principales**, con cinco dentro del mismo workspace. No se añaden pantallas independientes para cada perspectiva, Elemento, incidencia o cuestionario. Auditoría es un panel del workspace. Fuentes S01, S02 y S06 en [ARCHITECTURE.md](ARCHITECTURE.md); controles completos en [SECURITY.md](SECURITY.md).

`[id]` siempre es diagnóstico; la organización se resuelve y autoriza en servidor. Roles abreviados: C=IEO_CONSULTANT asignado, O=ORG_COORDINATOR asignado, T=TECH_ADMIN. El participante tiene sesión temporal, no rol administrativo.

| # / Vista | Ruta | Propósito y rol | Información mostrada | Acciones | Navegación |
|---|---|---|---|---|---|
| 1 Login | `/login` | Acceso administrativo T/C/O | Marca, método de acceso, errores genéricos | Ingresar mediante proveedor acordado; cerrar sesión desde menú administrativo | A `/diagnosticos`; retorno sólo a rutas internas permitidas |
| 2 Diagnósticos | `/diagnosticos` | C/O ven asignados; T ve inventario técnico mínimo | Organización, nombre, periodo, estado, consultor; filtros simples | C crea organización/diagnóstico en diálogo; T administra accesos en panel, sin contenido de respuestas; O abre asignados | A workspace General |
| 3 Workspace: configuración | `/diagnosticos/[id]?tab=general` o `tab=perspectivas` | C configura; O consulta logística; T sólo soporte concedido | Ficha de alcance, responsables, sedes, periodo, versiones y cinco perspectivas con estado/población; segmentos y CLI B2B/B2C | Guardar borrador, validar población, revisar instrumentos, prueba técnica, definir plan de cobertura y ventana; abrir tras checklist | Tabs General/Perspectivas/Participantes/Seguimiento/Cierre/Resultados |
| 4 Participantes | `/diagnosticos/[id]?tab=participantes` | C/O, soporte T asignado | Contacto operativo mínimo, perspectiva, entrega, errores de importación; sin respuestas, PI ni enlace/token completo | Importar CSV con previsualización, validar duplicados, enviar/reemitir/cancelar invitación, registrar incidencia; recordatorio general | Mismo workspace; a Seguimiento |
| 5 Seguimiento | `/diagnosticos/[id]?tab=seguimiento` | C/O; T sólo datos técnicos autorizados | Conteos y distribución permitida, ventana, incidencias, reservas; no contenido individual ni tiempos de cada envío para O | Registrar incidencia, revisar entrega; C documenta extensión y abre Cierre | A participantes o cierre; sin drill-down a respuesta por persona |
| 6 Cierre y procesamiento | `/diagnosticos/[id]?tab=cierre` | C con permisos; O sin acceso decisorio | Checklist 16 puntos, distribución, dictamen global/perspectiva/Elemento, exclusiones, acta, freeze y runs con estados | Cerrar, validar, documentar exclusión, autorizar/congelar, procesar, reintentar run; reapertura excepcional tras GAP-010, con motivo | A resultados sólo tras run válido; auditoría en panel |
| 7 Resultados y evidencia | `/diagnosticos/[id]?tab=resultados&view=matriz` (`view=evidencia` / `exportaciones`) | C autorizado; T sólo grant específico; O no acceso automático | Matriz 8×5, RP/RI/BT/Global, cobertura y limitaciones; índices por perspectiva completos; cualitativas con permisos; manifest/export histórico | Revisar reportabilidad, registrar interpretación, redactar citas, descargar EXP01–04 según permiso; seleccionar ejecución histórica | Subvistas en el mismo tab; detalle por Elemento en panel, sin pantalla nueva |
| 8 Acceso / OTP / introducción | `/r/[token]` → `/r/acceso` → `/r/introduccion` | Invitado; OTP autoriza sólo su sesión | Entrada genérica, verificación de correo, intro oficial, propósito, voluntariedad, confidencialidad, uso, plazo y canal de dudas | Solicitar/verificar OTP, reenvío limitado, aceptar continuar; enlace inválido/expirado como estado de la misma vista | A cuestionario; si enviado, a gracias; nunca a administración |
| 9 Cuestionario | `/r/cuestionario` | Sesión temporal verificada y diagnóstico OPEN | Un bloque oficial por Elemento, reactivos y escala legible; abiertas en orden oficial; progreso de captura y estado de guardado | Elegir 1–5/NA permitido, escribir, guardar, continuar/volver y enviar definitivamente; omisiones según GAP-004 | Ocho bloques más abiertas generales CLI dentro de la misma ruta; confirmación de envío y luego gracias |
| 10 Confirmación | `/r/gracias` | Participante que envió | Confirmación y agradecimiento | Cerrar; sin descarga de prueba de participación ni resultados | Fin del recorrido |

El workspace consolida configuración general y perspectivas como dos tabs de una misma vista de configuración. Evidencia/exportaciones son subvistas del tab Resultados. Contar vistas no equivale a contar URLs técnicas: autenticación usa callbacks y participante tiene varias etapas, pero no exige layouts/páginas de producto independientes.

## Información y estados clave

General conserva alcance antes de resultados; cambios posteriores se justifican. Perspectivas siempre muestra DIR, ESP, LID, COL y CLI, incluidas no aplicables/no disponibles, con su explicación. Los controles no permiten cambiar instrumentos iniciados. Configuración de segmentos no equivale a aprobación para reportar.

Participantes no se convierte en una página de vigilancia. O gestiona base y entrega; seguimiento muestra agregados aprobados. C sólo accede a detalle analítico individual con grant explícito y sin asociación a email. Pruebas técnicas se marcan visiblemente y se excluyen del diagnóstico real.

Cierre diferencia cerrar recepción, validar, congelar y procesar. Presenta bloqueos con causa concreta: acta incompleta, dictamen pendiente, fuente no certificada o regla sin resolver. Reapertura no borra la ejecución anterior. No hay inputs para escribir PI/RP/BT/RI/Global manualmente.

Resultados no muestra el Global aislado: siempre acompañado de los ocho Elementos, perspectivas y brechas relevantes (S03 §16). Distinguir NA, MISSING, ND, NP, LIMITED y «oculto por confidencialidad» con texto. Un cero válido debe verse como 0, nunca como vacío. Columnas/celdas protegidas tampoco se entregan en JSON. Detalles de trazabilidad son un panel restringido, no links a la identidad.

Evidencia conserva abiertas CLI generales, filtros por perspectiva y Elemento sólo cuando el mapeo exista. La revisión muestra original y versión para reporte únicamente al principal autorizado; no una tabla que mezcle contacto y texto. Exportaciones explica tipo y propósito y muestra permisos/filtros antes de generar; no introduce un editor de reportes.

Auditoría: panel lateral dentro de General/Cierre/Resultados, filtrado por diagnóstico, actor/acción/fecha y redactado. Administración técnica de usuarios/asignaciones: panel desde Diagnósticos. No se justifica pantalla 11 en el MVP.

## Dirección visual

Interfaz profesional, limpia, corporativa y sobria. Fondo neutro claro, superficies blancas, tipografía sans serif legible, un acento azul oscuro y escala de grises. Colores de salud exclusivamente para semáforo metodológico y acompañados de etiqueta, nunca como único portador del significado. Sin gradients decorativos, glassmorphism, animaciones gratuitas o mosaicos de métricas.

Admin desktop-first, compatible con tablet: encabezado compacto con diagnóstico/organización/estado, tabs persistentes, tabla principal y panel contextual. Espaciado consistente basado en múltiplos de 4/8 px; formularios agrupados por tarea; tablas con encabezados claros, alineación numérica y filas legibles. Confirmaciones para cierre/envío explican el efecto; no interrumpir cada guardado reversible.

Participante mobile-first: columna única, texto del reactivo completo, controles táctiles amplios y etiquetas de escala siempre accesibles. Evitar una matriz Likert horizontal que obligue a desplazarse en teléfono. Agrupar por bloques oficiales sin aleatorizar ni ocultar reactivos inversos mediante otra redacción. NA es elección separada y no preseleccionada; no mostrar orientación ni conversión a 0–100.

Accesibilidad: foco visible, etiquetas y fieldsets semánticos, navegación por teclado, lectores de pantalla, contraste suficiente y errores asociados al campo. Indicador de guardado accesible sin anunciar continuamente cada tecla. Diseñar para ancho móvil de 320 px y zoom 200 %; tablas administrativas permiten desplazamiento localizado sin perder contexto.

Estados previstos: carga, vacío, guardando, guardado, error de red, conflicto entre pestañas, sesión vencida, OTP incorrecto/limitado, invitación revocada, diagnóstico cerrado, envío confirmado y resultado restringido. No prometer funcionamiento offline: se conserva el último guardado confirmado en servidor, y se advierte antes de perder cambios locales sin transmitirlos a almacenamiento persistente del navegador.
