#!/bin/bash
# Restores an encrypted backup into an EMPTY target database (never over a database in use).
# Usage: BACKUP_PASSPHRASE_FILE=/secure/path/passphrase scripts/restore.sh <backup.sql.gz.enc> <target-database>
set -euo pipefail
file="${1:?backup file}"; target="${2:?target database}"
: "${BACKUP_PASSPHRASE_FILE:?set BACKUP_PASSPHRASE_FILE}"
shasum -a 256 -c "$file.sha256"
restore() {
  if command -v docker >/dev/null && docker compose ps --status running mysql >/dev/null 2>&1; then
    docker compose exec -T mysql bash -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql -uroot '$target'"
  else
    mysql "$target"
  fi
}
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass "file:$BACKUP_PASSPHRASE_FILE" -in "$file" | gunzip | restore
echo "Restaurado en $target. Verifica con: DATABASE_URL=<url de $target> npm run verify:history"
