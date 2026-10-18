#!/bin/bash
# Encrypted, consistent MySQL backup of the IEO database (Phase 7).
# Usage: BACKUP_PASSPHRASE_FILE=/secure/path/passphrase scripts/backup.sh <database> <output-dir>
# Requires mysqldump (or the Compose container) and openssl. The passphrase file must live outside the repository,
# and the application encryption keys (PARTICIPANT_*, OTP_HMAC_SECRET) must be backed up separately: without them
# encrypted emails and open answers in the backup cannot be read.
set -euo pipefail
database="${1:?database name}"; outdir="${2:?output directory}"
: "${BACKUP_PASSPHRASE_FILE:?set BACKUP_PASSPHRASE_FILE}"
mkdir -p "$outdir"
file="$outdir/${database}_$(date -u +%Y%m%dT%H%M%SZ).sql.gz.enc"
dump() {
  if command -v docker >/dev/null && docker compose ps --status running mysql >/dev/null 2>&1; then
    docker compose exec -T mysql bash -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysqldump -uroot --single-transaction --routines --triggers --set-gtid-purged=OFF '$database'"
  else
    mysqldump --single-transaction --routines --triggers "$database"
  fi
}
dump | gzip -9 | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass "file:$BACKUP_PASSPHRASE_FILE" -out "$file"
chmod 600 "$file"
shasum -a 256 "$file" > "$file.sha256"
echo "$file"
