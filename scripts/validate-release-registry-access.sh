#!/usr/bin/env bash
set -euo pipefail

REGISTRY_IMAGE="registry:3.0.0@sha256:6c5666b861f3505b116bb9aa9b25175e71210414bd010d92035ff64018f9457e"
PUSH_USER="controller-user-01"
PUSH_PASSWORD="controller-secret-01"
PULL_USER="target-reader-001"
PULL_PASSWORD="target-secret-001"
SUFFIX="$$"
PROJECT="eurtisan-registry-access-test-$SUFFIX"
TEMP_DIR="$(mktemp -d)"
CREATED_COOLIFY_NETWORK=false
COMPOSE=(docker compose -p "$PROJECT" -f "$TEMP_DIR/docker-compose.yml")

cleanup() {
  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  docker rm -f eurtisan-release-registry-proxy eurtisan-release-registry >/dev/null 2>&1 || true
  if [[ "$CREATED_COOLIFY_NETWORK" == true ]]; then
    docker network rm coolify >/dev/null 2>&1 || true
  fi
  if [[ -d "$TEMP_DIR/data" ]]; then
    docker run --rm -v "$TEMP_DIR/data:/data" "$REGISTRY_IMAGE" \
      sh -c 'rm -rf /data/*' >/dev/null 2>&1 || true
  fi
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

command -v openssl >/dev/null

mkdir -p "$TEMP_DIR/auth" "$TEMP_DIR/data"
printf '%s:%s\n' "$PUSH_USER" "$(openssl passwd -apr1 "$PUSH_PASSWORD")" \
  >"$TEMP_DIR/auth/registry-push.htpasswd"
printf '%s:%s\n' "$PUSH_USER" "$(openssl passwd -apr1 "$PUSH_PASSWORD")" \
  >"$TEMP_DIR/auth/registry-users.htpasswd"
printf '%s:%s\n' "$PULL_USER" "$(openssl passwd -apr1 "$PULL_PASSWORD")" \
  >>"$TEMP_DIR/auth/registry-users.htpasswd"
chmod 755 "$TEMP_DIR/auth"
chmod 644 "$TEMP_DIR/auth/"*.htpasswd
cp infrastructure/ansible/roles/eurtisan/files/release-registry-compose.yml \
  "$TEMP_DIR/docker-compose.yml"
cp infrastructure/ansible/roles/eurtisan/templates/release-registry-nginx.conf.j2 \
  "$TEMP_DIR/nginx.conf"
cat >"$TEMP_DIR/.env" <<EOF
REGISTRY_HTTP_SECRET=registry-access-test-http-secret-0001
RELEASE_REGISTRY_DATA_PATH=$TEMP_DIR/data
EOF

if ! docker network inspect coolify >/dev/null 2>&1; then
  docker network create coolify >/dev/null
  CREATED_COOLIFY_NETWORK=true
fi

"${COMPOSE[@]}" up -d --wait
BASE_URL="http://eurtisan-release-registry-proxy:8080"

request_status() {
  docker run --rm --network coolify curlimages/curl:8.12.1 -sS -o /dev/null -w '%{http_code}' "$@"
}

unauthenticated_get="$(request_status "$BASE_URL/v2/")"
pull_get="$(request_status -u "$PULL_USER:$PULL_PASSWORD" "$BASE_URL/v2/")"
pull_post="$(request_status -u "$PULL_USER:$PULL_PASSWORD" -X POST \
  "$BASE_URL/v2/eurtisan/access-probe/blobs/uploads/")"
push_post="$(request_status -u "$PUSH_USER:$PUSH_PASSWORD" -X POST \
  "$BASE_URL/v2/eurtisan/access-probe/blobs/uploads/")"

test "$unauthenticated_get" = 401
test "$pull_get" = 200
test "$pull_post" = 401
test "$push_post" = 202

echo "Self-hosted registry health, authentication, and pull-only ACL are valid"
