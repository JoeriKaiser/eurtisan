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

echo "==> Tagging current images for rollback..."
docker tag eurtisan-app:latest eurtisan-app:rollback-before-deploy 2>/dev/null || true
docker tag eurtisan-inventory-cleanup:latest eurtisan-inventory-cleanup:rollback-before-deploy 2>/dev/null || true
docker tag eurtisan-meilisearch-sync:latest eurtisan-meilisearch-sync:rollback-before-deploy 2>/dev/null || true

echo "==> Fetching code from origin..."
git fetch origin

echo "==> Checking out ${GIT_REF}..."
git checkout "${GIT_REF}"
git pull origin "${GIT_REF}"

echo "==> Building application images..."
docker compose -f "$COMPOSE_FILE" build app inventory-cleanup meilisearch-sync

echo "==> Running database migrations..."
if docker compose -f "$COMPOSE_FILE" run --rm app bun run db:migrate; then
	echo "==> Migration succeeded — restarting services..."
	docker compose -f "$COMPOSE_FILE" up -d
else
	echo "==> MIGRATION FAILED — rolling back to previous images"
	docker tag eurtisan-app:rollback-before-deploy eurtisan-app:latest 2>/dev/null || true
	docker tag eurtisan-inventory-cleanup:rollback-before-deploy eurtisan-inventory-cleanup:latest 2>/dev/null || true
	docker tag eurtisan-meilisearch-sync:rollback-before-deploy eurtisan-meilisearch-sync:latest 2>/dev/null || true

	echo "==> Ensuring old containers are running..."
	docker compose -f "$COMPOSE_FILE" up -d
	exit 1
fi

echo "==> Pruning unused Eurtisan images (label app=eurtisan)..."
docker image prune -f --filter "label=app=eurtisan"

echo "==> Deploy complete: ${GIT_REF}"
