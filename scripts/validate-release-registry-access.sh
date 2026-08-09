#!/usr/bin/env bash
set -euo pipefail

REGISTRY_IMAGE="registry:3.0.0@sha256:6c5666b861f3505b116bb9aa9b25175e71210414bd010d92035ff64018f9457e"
NGINX_IMAGE="nginx:1.28.2-alpine@sha256:5b4900b042ccfa8b0a73df622c3a60f2322faeb2be800cbee5aa7b44d241649e"
PUSH_USER="controller-user-01"
PUSH_PASSWORD="controller-secret-01"
PULL_USER="target-reader-001"
PULL_PASSWORD="target-secret-001"
SUFFIX="$$"
NETWORK="eurtisan-registry-access-test-$SUFFIX"
BACKEND="eurtisan-registry-backend-test-$SUFFIX"
PROXY="eurtisan-registry-proxy-test-$SUFFIX"
TEMP_DIR="$(mktemp -d)"

cleanup() {
  docker rm -f "$PROXY" "$BACKEND" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

command -v curl >/dev/null
command -v openssl >/dev/null

mkdir -p "$TEMP_DIR/auth"
printf '%s:%s\n' "$PUSH_USER" "$(openssl passwd -apr1 "$PUSH_PASSWORD")" \
  >"$TEMP_DIR/auth/registry-push.htpasswd"
printf '%s:%s\n' "$PUSH_USER" "$(openssl passwd -apr1 "$PUSH_PASSWORD")" \
  >"$TEMP_DIR/auth/registry-users.htpasswd"
printf '%s:%s\n' "$PULL_USER" "$(openssl passwd -apr1 "$PULL_PASSWORD")" \
  >>"$TEMP_DIR/auth/registry-users.htpasswd"
chmod 755 "$TEMP_DIR/auth"
chmod 644 "$TEMP_DIR/auth/"*.htpasswd
cp infrastructure/ansible/roles/eurtisan/templates/release-registry-nginx.conf.j2 \
  "$TEMP_DIR/nginx.conf"

docker network create "$NETWORK" >/dev/null
docker run -d --name "$BACKEND" --network "$NETWORK" --network-alias registry \
  "$REGISTRY_IMAGE" >/dev/null
docker run -d --name "$PROXY" --network "$NETWORK" -p 127.0.0.1::8080 \
  -v "$TEMP_DIR/nginx.conf:/etc/nginx/nginx.conf:ro" \
  -v "$TEMP_DIR/auth:/etc/nginx/auth:ro" \
  "$NGINX_IMAGE" >/dev/null

PORT="$(docker port "$PROXY" 8080/tcp | awk -F: 'NR == 1 { print $NF }')"
test -n "$PORT"
BASE_URL="http://127.0.0.1:$PORT"

for _ in $(seq 1 30); do
  if curl -fsS "$BASE_URL/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
curl -fsS "$BASE_URL/healthz" >/dev/null

request_status() {
  curl -sS -o /dev/null -w '%{http_code}' "$@"
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

echo "Self-hosted registry authentication and pull-only ACL are valid"
