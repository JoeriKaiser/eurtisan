#!/bin/bash
# Eurtisan deploy script
# Run on the VPS to pull latest code, build, migrate, and restart.
# Usage: ./deploy.sh [git-ref]
#   git-ref — branch or tag to deploy (default: main)
#
# Set COMPOSE_FILE env var to override (default: docker-compose.prod.yml)

set -euo pipefail

APP_DIR="/opt/eurtisan"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
GIT_REF="${1:-main}"

cd "$APP_DIR"

echo "==> Fetching code from origin..."
git fetch origin

echo "==> Checking out ${GIT_REF}..."
git checkout "${GIT_REF}"
git pull origin "${GIT_REF}"

echo "==> Building application image..."
docker compose -f "$COMPOSE_FILE" build app

echo "==> Running database migrations..."
docker compose -f "$COMPOSE_FILE" run --rm app bun run db:migrate

echo "==> Restarting services..."
docker compose -f "$COMPOSE_FILE" up -d

echo "==> Pruning old Docker images..."
docker system prune -f

echo "==> Deploy complete: ${GIT_REF}"
