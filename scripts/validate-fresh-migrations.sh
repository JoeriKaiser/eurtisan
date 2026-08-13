#!/bin/sh
set -eu

POSTGRES_IMAGE="postgres:16-alpine@sha256:16bc17c64a573ef34162af9298258d1aec548232985b33ed7b1eac33ba35c229"
CONTAINER="eurtisan-fresh-migrations-$$"
DATABASE="eurtisan_migration_check"
USER_NAME="migration_check"
PASSWORD="migration-check-password"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker run -d --rm \
  --name "$CONTAINER" \
  --network eurtisan \
  -e POSTGRES_USER="$USER_NAME" \
  -e POSTGRES_PASSWORD="$PASSWORD" \
  -e POSTGRES_DB="$DATABASE" \
  "$POSTGRES_IMAGE" >/dev/null

attempt=0
until docker exec "$CONTAINER" pg_isready -U "$USER_NAME" -d "$DATABASE" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "Fresh PostgreSQL database did not become ready" >&2
    docker logs "$CONTAINER" >&2
    exit 1
  fi
  sleep 1
done

DATABASE_URL="postgresql://${USER_NAME}:${PASSWORD}@${CONTAINER}:5432/${DATABASE}"
docker compose run --rm --no-deps -e DATABASE_URL="$DATABASE_URL" app bun run db:migrate

verified_tables="$(docker exec "$CONTAINER" psql -U "$USER_NAME" -d "$DATABASE" -v ON_ERROR_STOP=1 -tAc \
  "SELECT COUNT(*) FROM information_schema.tables WHERE (table_schema = 'public' AND table_name IN ('user', 'platform_order')) OR table_name = '__drizzle_migrations'")"
if [ "$verified_tables" != "3" ]; then
  echo "Fresh migration verification did not find the two critical tables and Drizzle journal" >&2
  exit 1
fi

echo "Full migration chain applied to a fresh isolated PostgreSQL database"
