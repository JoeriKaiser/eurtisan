#!/bin/bash
# Eurtisan deploy script
# Run on the VPS to pull latest code, build, migrate, and restart.
# Usage: ./deploy.sh [--skip-smoke-test] [--canary] [git-ref]
#   --skip-smoke-test — bypass post-deploy smoke tests (emergency manual use only)
#   --canary — run a single canary container before full rollout
#   git-ref — branch or tag to deploy (default: main)
#
# Set COMPOSE_FILE env var to override (default: docker-compose.prod.yml)

set -euo pipefail

APP_DIR="/opt/eurtisan"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

# Load environment variables from the Ansible-managed .env so the script can
# reach services and alert endpoints without duplicating configuration.
set -a
if [ -f "$APP_DIR/.env" ]; then
  source "$APP_DIR/.env"
fi
set +a

SKIP_SMOKE_TEST=false
if [ "${1:-}" = "--skip-smoke-test" ]; then
  SKIP_SMOKE_TEST=true
  shift
fi

CANARY=false
if [ "${1:-}" = "--canary" ]; then
  CANARY=true
  shift
fi

GIT_REF="${1:-main}"
# Docker image tags cannot contain '/' (e.g. feature/foo).
IMAGE_TAG="$(echo "$GIT_REF" | tr '/' '-')"
export IMAGE_TAG

PUBLIC_URL="${PUBLIC_URL:-http://localhost:3000}"
SMOKE_TEST_BASE="${SMOKE_TEST_BASE:-http://app:3000}"
DEPLOY_ALERT_WEBHOOK="${DEPLOY_ALERT_WEBHOOK:-${BACKUP_ALERT_WEBHOOK:-}}"
CANARY_PORT="${CANARY_PORT:-3001}"
CANARY_STABILIZE_SECONDS="${CANARY_STABILIZE_SECONDS:-300}"

cd "$APP_DIR"

send_alert() {
  local message="$1"
  if [ -n "$DEPLOY_ALERT_WEBHOOK" ]; then
    curl -fsSL -X POST -H "Content-Type: application/json" \
      -d "{\"text\":\"$message\"}" "$DEPLOY_ALERT_WEBHOOK" >/dev/null 2>&1 || true
  fi
}

poll_endpoint() {
  local path="$1"
  local max_attempts="${2:-24}"
  local delay="${3:-5}"

  for i in $(seq 1 "$max_attempts"); do
    if docker compose -f "$COMPOSE_FILE" exec -T app \
      curl -fsS "${SMOKE_TEST_BASE}${path}" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

run_smoke_tests() {
  echo "==> Running post-deploy smoke tests..."

  if ! poll_endpoint "/api/health/ready"; then
    echo "==> SMOKE TEST FAILED: /api/health/ready did not return 200 within timeout"
    return 1
  fi
  echo "    /api/health/ready OK"

  if ! poll_endpoint "/api/health/live"; then
    echo "==> SMOKE TEST FAILED: /api/health/live did not return 200 within timeout"
    return 1
  fi
  echo "    /api/health/live OK"

  if ! poll_endpoint "/api/health"; then
    echo "==> SMOKE TEST FAILED: /api/health did not return 200 within timeout"
    return 1
  fi
  echo "    /api/health OK"

  if ! poll_endpoint "/api/health/deps"; then
    echo "==> SMOKE TEST FAILED: /api/health/deps did not return 200 within timeout"
    return 1
  fi
  echo "    /api/health/deps OK"

  return 0
}

poll_canary_health() {
  local max_attempts=30
  local delay=2
  for i in $(seq 1 "$max_attempts"); do
    if curl -fsS "http://127.0.0.1:${CANARY_PORT}/api/health/ready" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

run_canary() {
  echo "==> Starting canary container on port ${CANARY_PORT}..."
  docker run -d --rm \
    --name eurtisan-app-canary \
    --network eurtisan \
    --network db-internal \
    --env-file "$APP_DIR/.env" \
    -e NODE_ENV=production \
    -e PORT="$CANARY_PORT" \
    -p "127.0.0.1:${CANARY_PORT}:${CANARY_PORT}" \
    "eurtisan-app:${IMAGE_TAG}" \
    bun --import ./dist/server/instrument.server.mjs ./dist/server/server-entry.mjs

  echo "==> Waiting for canary health..."
  if ! poll_canary_health; then
    echo "==> CANARY HEALTH CHECK FAILED"
    docker stop eurtisan-app-canary >/dev/null 2>&1 || true
    return 1
  fi

  echo "==> Canary healthy; observing for ${CANARY_STABILIZE_SECONDS}s..."
  local elapsed=0
  while [ "$elapsed" -lt "$CANARY_STABILIZE_SECONDS" ]; do
    sleep 30
    elapsed=$((elapsed + 30))
    if ! poll_canary_health; then
      echo "==> CANARY FAILED during stabilization at ${elapsed}s"
      docker stop eurtisan-app-canary >/dev/null 2>&1 || true
      return 1
    fi
  done

  echo "==> Canary stable; removing canary container before full rollout..."
  docker stop eurtisan-app-canary >/dev/null 2>&1 || true
  return 0
}

echo "==> Tagging current app image for rollback..."
CURRENT_CONTAINER=$(docker compose -f "$COMPOSE_FILE" ps -q app 2>/dev/null || true)
if [ -n "$CURRENT_CONTAINER" ]; then
  CURRENT_IMAGE=$(docker inspect --format='{{.Image}}' "$CURRENT_CONTAINER" 2>/dev/null || true)
  if [ -n "$CURRENT_IMAGE" ]; then
    docker tag "$CURRENT_IMAGE" eurtisan-app:rollback-before-deploy
    echo "    Tagged rollback image: ${CURRENT_IMAGE}"
  fi
fi

echo "==> Fetching code from origin..."
git fetch origin

echo "==> Checking out ${GIT_REF}..."
git checkout "${GIT_REF}"
git pull origin "${GIT_REF}"

echo "==> Building application image (tag: ${IMAGE_TAG})..."
docker compose -f "$COMPOSE_FILE" build app

echo "==> Running database migrations..."
if docker compose -f "$COMPOSE_FILE" run --rm app bun run db:migrate; then
  echo "==> Migration succeeded"

  if [ "$CANARY" = true ]; then
    if ! run_canary; then
      send_alert "🚨 Eurtisan canary FAILED on $(hostname) for ${GIT_REF}. Full rollout aborted."
      exit 1
    fi
  fi

  echo "==> Restarting services..."
  docker compose -f "$COMPOSE_FILE" up -d

  if [ "$SKIP_SMOKE_TEST" = false ]; then
    if ! run_smoke_tests; then
      echo "==> SMOKE TEST FAILED — rolling back to previous image"
      send_alert "🚨 Eurtisan deploy FAILED on $(hostname): smoke tests failed for ${GIT_REF}. Rolling back."

      echo "==> Ensuring old containers are running with rollback image..."
      IMAGE_TAG=rollback-before-deploy docker compose -f "$COMPOSE_FILE" up -d

      # Re-run smoke tests against the rollback image so we confirm the site is up.
      if run_smoke_tests; then
        echo "==> Rollback smoke tests passed"
      else
        echo "==> ROLLBACK SMOKE TESTS ALSO FAILED — manual intervention required"
        send_alert "🚨🚨 Eurtisan rollback ALSO failed on $(hostname) for ${GIT_REF}. Manual intervention required."
      fi
      exit 1
    fi
  else
    echo "==> Skipping smoke tests (--skip-smoke-test)"
  fi

  echo "==> Tagging deployed image as latest..."
  docker tag "eurtisan-app:${IMAGE_TAG}" eurtisan-app:latest
else
  echo "==> MIGRATION FAILED — rolling back to previous image"
  send_alert "🚨 Eurtisan deploy FAILED on $(hostname): database migration failed for ${GIT_REF}. Rolling back."

  echo "==> Ensuring old containers are running with rollback image..."
  IMAGE_TAG=rollback-before-deploy docker compose -f "$COMPOSE_FILE" up -d
  exit 1
fi

echo "==> Deploy complete: ${GIT_REF} (image: eurtisan-app:${IMAGE_TAG})"
send_alert "✅ Eurtisan deploy succeeded on $(hostname): ${GIT_REF} (image: eurtisan-app:${IMAGE_TAG})"
