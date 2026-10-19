# Lo que falta para el piloto

Fecha: 2026-10-19. El sistema está completo en su versión de prueba (Phases 1 a 7): cuestionarios, cierre, cálculo, resultados y exportaciones funcionan y están probados, pero **sólo con datos ficticios**. Para aplicarlo con personas reales faltan decisiones y datos que no dependen del desarrollo. Esta lista dice qué falta, quién lo decide y qué bloquea.

## 1. Decisiones metodológicas — Marco

| # | Qué se necesita | Estado hoy | ¿Bloquea el piloto? |
|---|---|---|---|
| 1.1 | Confirmar las reglas adoptadas provisionalmente el 2026-10-17 y 18: redondeo de la Brecha (.5 baja), Global «limitado» o sin calcular, efecto del dictamen C, exclusiones sólo de cuestionarios completos y reapertura por el consultor | Funcionan como provisionales | Sí: deben quedar confirmadas o corregidas |
| 1.2 | Designar al **custodio metodológico** que aprueba el acceso a datos individuales (propuesto: Marco o quien él designe) y confirmar la regla: el consultor pide, el custodio aprueba, nadie se aprueba a sí mismo, máximo 30 días (GAP-011) | Provisional | Sí |
| 1.3 | **Certificar el catálogo**: entregar el Banco Maestro o declarar por escrito que el Diccionario en Excel es la versión oficial de los 329 reactivos y 28 abiertas (GAP-001) | Pendiente | Sí |
| 1.4 | Entregar el **Protocolo de Triangulación 1.1**, la **Guía de Interpretación** y la **Plantilla de Reporte** (GAP-002) | No recibidos | No para aplicar; sí para interpretar y reportar con los criterios oficiales |
| 1.5 | Aceptar el registro automático de los 23 casos oficiales como evidencia de aceptación matemática (GAP-013) | Hoy 23 de 23 PASS | Sí, como trámite |

## 2. Privacidad y retención — Marco, el cliente y su asesor legal (GAP-012)

| # | Qué se necesita | ¿Bloquea? |
|---|---|---|
| 2.1 | Definir quién es el **responsable** de los datos (la organización evaluada, la consultora IEO o ambas) y su domicilio y contacto | Sí |
| 2.2 | Revisar y aprobar el **aviso de privacidad** a partir del [borrador](PRIVACY_NOTICE_DRAFT.md) | Sí |
| 2.3 | Fijar **plazos de conservación**: correos de invitación, respuestas, respuestas abiertas, actas y respaldos | Sí |
| 2.4 | Decidir qué pasa si un participante **pide retirar** sus respuestas antes y después del cierre | Sí |
| 2.5 | Texto de la **invitación por correo** con lo que exige el Protocolo §9 (quién invita, duración, voluntariedad, confidencialidad, uso de resultados, fecha límite y canal de dudas) | Sí |

## 3. Infraestructura — el cliente o su proveedor

El detalle técnico está en [INFRASTRUCTURE_REQUIREMENTS.md](INFRASTRUCTURE_REQUIREMENTS.md). En resumen:

| # | Qué se necesita | ¿Bloquea? |
|---|---|---|
| 3.1 | Servidor con Node.js 24 y MySQL 8.4 (o 8.x), con acceso para desplegar | Sí |
| 3.2 | Dominio y certificado HTTPS | Sí |
| 3.3 | Servicio de correo (SMTP) con remitente, SPF y DKIM, y una prueba de entrega | Sí |
| 3.4 | Política de respaldos: frecuencia, dónde se guardan, cuánto se conservan, cuánta pérdida es aceptable (RPO) y en cuánto tiempo se debe recuperar (RTO) | Sí |
| 3.5 | Gestor de secretos o bóveda para guardar las claves de cifrado por separado de los respaldos | Sí |
| 3.6 | Límite de peticiones en el proxy (protección contra abuso del login y de los códigos) | Sí |

## 4. Datos del piloto — el consultor IEO y la organización piloto

| # | Qué se necesita |
|---|---|
| 4.1 | Organización piloto, objetivo, periodo y ventana de aplicación (fechas de apertura y cierre) |
| 4.2 | Perspectivas aplicables, no aplicables y no disponibles, con su justificación |
| 4.3 | Poblaciones y lista de correos por perspectiva (entregada por un canal seguro) |
| 4.4 | Sponsor, consultor IEO responsable, coordinador interno y responsable técnico |
| 4.5 | Fecha de la prueba técnica previa (Protocolo §8) |

## 5. Lo que haré yo cuando lo anterior esté listo

| Cambio | Depende de |
|---|---|
| Quitar el candado de «sólo pruebas»: hoy la base de datos y el código sólo aceptan invitaciones y sesiones de prueba y correos `.test` | 1.1, 1.3, 2.x |
| Mostrar el aviso de privacidad aprobado en la introducción del cuestionario y quitar las leyendas «PRUEBA» | 2.2 |
| Ajustar la invitación por correo al texto aprobado | 2.5 |
| Implementar la política de retención (purga programada) y el procedimiento de retiro | 2.3, 2.4 |
| Marcar el catálogo como certificado | 1.3 |
| Desplegar en el servidor, cargar catálogos, crear usuarios reales sin el seed de demostración y rotar todas las credenciales | 3.x |
| Configurar respaldos y hacer un simulacro de restauración en el servidor real | 3.4, 3.5 |
| Implementar el recifrado para rotar la clave de cifrado | 3.5 |
| Ejecutar la [prueba de aceptación con usuarios](UAT_SCRIPT.md) y corregir lo que salga | Todo lo anterior |

## Orden sugerido

1. Marco confirma 1.1, 1.2 y 1.5, y certifica el catálogo (1.3).
2. Marco, el cliente y su asesor legal cierran privacidad (sección 2) con el borrador como base.
3. En paralelo, el cliente prepara la infraestructura (sección 3).
4. Yo hago los cambios de la sección 5 y desplegamos.
5. Prueba de aceptación con usuarios (UAT) en el servidor real, todavía con datos ficticios.
6. Prueba técnica con la organización piloto (Protocolo §8) y, si todo pasa, apertura del piloto.
