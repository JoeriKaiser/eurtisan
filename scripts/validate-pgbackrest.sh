#!/bin/bash
set -euo pipefail

IMAGE="eurtisan-postgres:pgbackrest-validation"
SUFFIX="${RANDOM}-$$"
CONTAINER="eurtisan-pgbackrest-validation-$SUFFIX"
DATA_VOLUME="eurtisan-pgbackrest-data-$SUFFIX"
REPO_VOLUME="eurtisan-pgbackrest-repo-$SUFFIX"
SPOOL_VOLUME="eurtisan-pgbackrest-spool-$SUFFIX"
CONFIG_FILE="$(mktemp)"
CIPHER_PASS="validation-only-pgbackrest-cipher-passphrase"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker volume rm -f "$DATA_VOLUME" "$REPO_VOLUME" "$SPOOL_VOLUME" >/dev/null 2>&1 || true
  rm -f "$CONFIG_FILE"
}
trap cleanup EXIT INT TERM

cat >"$CONFIG_FILE" <<'EOF'
[global]
repo1-type=posix
repo1-path=/var/lib/pgbackrest
repo1-cipher-type=aes-256-cbc
repo1-retention-full=2
archive-async=n
spool-path=/var/spool/pgbackrest
start-fast=y
process-max=2
log-level-console=warn

[eurtisan]
pg1-path=/var/lib/postgresql/data
pg1-user=eurtisan
EOF
chmod 0644 "$CONFIG_FILE"

docker build --file Dockerfile.postgres --tag "$IMAGE" . >/dev/null

docker volume create "$DATA_VOLUME" >/dev/null
docker volume create "$REPO_VOLUME" >/dev/null
docker volume create "$SPOOL_VOLUME" >/dev/null
docker run --rm --user root \
  -v "$REPO_VOLUME:/var/lib/pgbackrest" \
  -v "$SPOOL_VOLUME:/var/spool/pgbackrest" \
  "$IMAGE" sh -ec \
  'chown -R postgres:postgres /var/lib/pgbackrest /var/spool/pgbackrest'

start_database() {
  docker run -d --name "$CONTAINER" \
    -e POSTGRES_USER=eurtisan \
    -e POSTGRES_PASSWORD=validation-only \
    -e POSTGRES_DB=eurtisan \
    -e PGBACKREST_REPO1_CIPHER_PASS="$CIPHER_PASS" \
    -v "$DATA_VOLUME:/var/lib/postgresql/data" \
    -v "$REPO_VOLUME:/var/lib/pgbackrest" \
    -v "$SPOOL_VOLUME:/var/spool/pgbackrest" \
    -v "$CONFIG_FILE:/etc/pgbackrest/pgbackrest.conf:ro" \
    "$IMAGE" \
    -c wal_level=replica \
    -c archive_mode=on \
    -c 'archive_command=pgbackrest --stanza=eurtisan archive-push %p' \
    -c archive_timeout=60s >/dev/null

  for _ in $(seq 1 60); do
    if docker exec "$CONTAINER" psql -U eurtisan -d eurtisan -tAc 'SELECT 1;' \
      2>/dev/null | grep -qx 1; then
      return 0
    fi
    sleep 1
  done
  docker logs "$CONTAINER" >&2
  return 1
}

start_database
docker exec --user postgres "$CONTAINER" pgbackrest --stanza=eurtisan stanza-create >/dev/null
docker exec --user postgres "$CONTAINER" pgbackrest --stanza=eurtisan check >/dev/null

docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U eurtisan -d eurtisan -c \
  'CREATE TABLE recovery_marker (value text PRIMARY KEY);' >/dev/null
docker exec --user postgres "$CONTAINER" pgbackrest --stanza=eurtisan --type=full backup >/dev/null

docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U eurtisan -d eurtisan -c \
  "INSERT INTO recovery_marker (value) VALUES ('keep-before-target');" >/dev/null
docker exec "$CONTAINER" psql -U eurtisan -d eurtisan -tAc 'SELECT pg_switch_wal();' >/dev/null
docker exec --user postgres "$CONTAINER" pgbackrest --stanza=eurtisan check >/dev/null
TARGET_TIME="$(docker exec "$CONTAINER" psql -U eurtisan -d eurtisan -tAc \
  "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') || '+00';")"
sleep 2

docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U eurtisan -d eurtisan -c \
  "INSERT INTO recovery_marker (value) VALUES ('discard-after-target');" >/dev/null
docker exec "$CONTAINER" psql -U eurtisan -d eurtisan -tAc 'SELECT pg_switch_wal();' >/dev/null
docker exec --user postgres "$CONTAINER" pgbackrest --stanza=eurtisan check >/dev/null
docker stop "$CONTAINER" >/dev/null
docker rm "$CONTAINER" >/dev/null

docker run --rm --user root \
  -e PGBACKREST_REPO1_CIPHER_PASS="$CIPHER_PASS" \
  -v "$DATA_VOLUME:/var/lib/postgresql/data" \
  -v "$REPO_VOLUME:/var/lib/pgbackrest" \
  -v "$SPOOL_VOLUME:/var/spool/pgbackrest" \
  -v "$CONFIG_FILE:/etc/pgbackrest/pgbackrest.conf:ro" \
  "$IMAGE" sh -ec \
  'find /var/lib/postgresql/data -mindepth 1 -delete; chown postgres:postgres /var/lib/postgresql/data; exec su-exec postgres pgbackrest --stanza=eurtisan --type=time --target="$1" --target-action=promote restore' \
  sh "$TARGET_TIME" >/dev/null

start_database
KEEP_COUNT="$(docker exec "$CONTAINER" psql -U eurtisan -d eurtisan -tAc \
  "SELECT COUNT(*) FROM recovery_marker WHERE value='keep-before-target';")"
DISCARD_COUNT="$(docker exec "$CONTAINER" psql -U eurtisan -d eurtisan -tAc \
  "SELECT COUNT(*) FROM recovery_marker WHERE value='discard-after-target';")"

if [[ "$KEEP_COUNT" != "1" || "$DISCARD_COUNT" != "0" ]]; then
  echo "PITR validation failed: before-target=$KEEP_COUNT after-target=$DISCARD_COUNT" >&2
  exit 1
fi

echo "pgBackRest full backup, WAL archive, and point-in-time restore validation passed"
