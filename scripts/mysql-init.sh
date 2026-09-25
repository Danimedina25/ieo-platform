#!/bin/bash
# Runs only on first initialization of the dedicated development volume.
set -eu
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot <<'SQL'
CREATE DATABASE IF NOT EXISTS ieo_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS ieo_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ieo_test.* TO 'ieo'@'%';
GRANT ALL PRIVILEGES ON ieo_shadow.* TO 'ieo'@'%';
SQL
