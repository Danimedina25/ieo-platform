# Operación: respaldo, restauración y reproducción histórica

Procedimientos de Phase 7. Escritos para el responsable técnico del servidor. Los valores de RPO/RTO, retención y ubicación de respaldos se definen con el cliente (`INFRASTRUCTURE_REQUIREMENTS.md`, GAP-012).

## Qué hay que respaldar

| Elemento | Dónde vive | Cómo se respalda |
|---|---|---|
| Base MySQL (catálogo, respuestas, copias congeladas, runs, actas, auditoría) | MySQL | `scripts/backup.sh` (cifrado) |
| Claves de cifrado y HMAC: `PARTICIPANT_ENCRYPTION_KEY`, `PARTICIPANT_LOOKUP_SECRET`, `OTP_HMAC_SECRET` | Variables de entorno | **Por separado**, en un gestor de secretos o bóveda con acceso distinto al de los respaldos |
| Frase del respaldo (`BACKUP_PASSPHRASE_FILE`) | Archivo fuera del repositorio | Junto a las claves, con acceso separado |
| `AUTH_SECRET`, credenciales SMTP y de base | Variables de entorno | Igual que las claves; pueden regenerarse |

Sin `PARTICIPANT_ENCRYPTION_KEY` los correos y las respuestas abiertas del respaldo **no se pueden leer**; el resto (respuestas cuantitativas, copias congeladas, resultados) sí. Perder la clave es pérdida permanente de ese contenido.

## Respaldo

```sh
BACKUP_PASSPHRASE_FILE=/ruta/segura/frase scripts/backup.sh ieo_prod /ruta/respaldos
```

Produce `<base>_<fecha>.sql.gz.enc` (mysqldump consistente con `--single-transaction`, gzip y AES-256-CBC con PBKDF2) y su `.sha256`. Copiar ambos fuera del servidor.

## Restauración

Siempre en una base **vacía** y nueva, nunca sobre la que está en uso:

```sh
# como root de MySQL
CREATE DATABASE ieo_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ieo_restore.* TO 'ieo'@'%';
# después
BACKUP_PASSPHRASE_FILE=/ruta/segura/frase scripts/restore.sh /ruta/respaldos/<archivo>.sql.gz.enc ieo_restore
DATABASE_URL="mysql://…/ieo_restore" npm run verify:history
```

`verify:history` recalcula el SHA-256 de cada copia congelada y vuelve a ejecutar el motor sobre ella, comparando el hash de salida con el guardado. Debe terminar en «OK: todo reproducido exactamente». Un run hecho con otra versión del motor se reproduce con el artefacto de esa versión (el script lo informa y no lo reejecuta con la actual).

## Permisos mínimos de MySQL

La cuenta de la aplicación en producción no necesita crear ni borrar tablas:

```sql
CREATE USER 'ieo_app'@'%' IDENTIFIED BY '…';
GRANT SELECT, INSERT, UPDATE, DELETE ON ieo_prod.* TO 'ieo_app'@'%';
-- Las migraciones se aplican con una cuenta distinta, sólo durante el despliegue:
CREATE USER 'ieo_migrate'@'%' IDENTIFIED BY '…';
GRANT ALL PRIVILEGES ON ieo_prod.* TO 'ieo_migrate'@'%';
```

Pendiente para endurecer más: retirar `UPDATE` y `DELETE` sobre `AuditLog` a la cuenta de la aplicación (sólo inserta), cuando el despliegue permita permisos por tabla.

## Rotación de secretos

- `AUTH_SECRET`: rotarlo reinicia los contadores del limitador de login; no revoca sesiones (para eso, `revokedAt` en `AdminSession`).
- `OTP_HMAC_SECRET`: rotarlo invalida los códigos en curso; los participantes piden uno nuevo.
- `PARTICIPANT_LOOKUP_SECRET`: rotarlo exige recalcular `emailLookupHmac` de las invitaciones (descifrando el correo); planificar ventana.
- `PARTICIPANT_ENCRYPTION_KEY`: el formato de cifrado lleva versión; rotar exige recifrar correos y textos abiertos con la clave nueva conservando la anterior hasta terminar. No implementado todavía como comando; no rotar sin ese procedimiento.

## Simulacro registrado

La evidencia del simulacro de respaldo → restauración → `verify:history` está en [PHASE7_VALIDATION.md](PHASE7_VALIDATION.md).
