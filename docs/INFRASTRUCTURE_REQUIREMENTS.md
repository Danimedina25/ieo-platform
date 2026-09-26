# Infraestructura — información pendiente del cliente

No se presume ninguna configuración del servidor del cliente. Esta checklist no bloquea el desarrollo local. Validar antes de desplegar; Phase 3A implementa envío SMTP, pero no hay despliegue productivo ni credenciales SMTP del cliente validadas.

| Dato | Estado / criterio a confirmar |
|---|---|
| MySQL version | Pendiente; MySQL 8.x, InnoDB, utf8mb4; desarrollo validado con 8.4.10 |
| Database host | Pendiente; acceso privado preferido |
| Database port | Pendiente |
| Database name | Pendiente; separar desarrollo, pruebas y producción |
| Database user | Pendiente; usuario de aplicación con mínimo privilegio |
| Migration privileges | Pendiente; cuenta de despliegue con DDL, runtime con DML; shadow solo desarrollo |
| TLS requirement | Pendiente; verificar CA/hostname para DB remota y configuración del driver/CLI |
| Node.js version | Pendiente; aplicación selecciona Node 24 LTS |
| Linux distribution | Pendiente; comprobar compatibilidad de módulos nativos Argon2 |
| Reverse proxy | Pendiente; HTTPS, límites de peticiones, timeouts y rate limiting |
| Docker availability | Pendiente; opcional en producción, Compose local solo MySQL |
| PM2 availability | Pendiente; no requerido; un proceso inicial, sin cluster por ahora |
| SMTP provider | Pendiente: host, puerto, TLS, usuario, contraseña, remitente, SPF/DKIM y prueba de entrega; Phase 3A dispone de adaptador Nodemailer |
| Backup strategy | Pendiente; responsable, frecuencia, cifrado, retención y prueba de restauración |
| Available storage | Pendiente; volumen DB y crecimiento de auditoría |
| RAM | Pendiente; medir concurrencia de Argon2 y conexiones DB |
| CPU | Pendiente; medir login y build por separado |
| Domain | Pendiente; APP_ORIGIN debe coincidir exactamente con origen público |
| TLS certificate management | Pendiente; emisión, renovación y monitoreo |

Antes de exposición pública: secretos propios, usuarios reales provisionados por proceso controlado (no seed demo), credenciales de DB rotadas, HTTPS, limitación en proxy acordada, backups probados y dependencias revisadas. No montar el volumen demo en producción. El limitador actual es en memoria por proceso y se reinicia con la aplicación; no ofrece coordinación entre réplicas.

## Requisitos de Phase 3A para exposición real

Confirmar SMTP transaccional y política de correo, además de tres secretos independientes de 32 bytes base64url (`PARTICIPANT_ENCRYPTION_KEY`, `PARTICIPANT_LOOKUP_SECRET`, `OTP_HMAC_SECRET`) custodiados fuera del repositorio. La pérdida de la clave de cifrado impide recuperar correos y texto abierto históricos; establecer copia segura y rotación planificada antes de utilizar datos reales. `APP_ORIGIN` debe ser HTTPS público exacto. El proxy debe excluir el path completo de `/r/*` de access logs y APM, imponer límites globales por IP/origen para solicitudes OTP y proteger la base MySQL de acceso público. Las políticas por invitación se aplican en MySQL; sin una capa compartida de red no hay límite global distribuido. No activar `EMAIL_PROVIDER=console` en producción ni `E2E_MODE` fuera de una base local `_test`.
