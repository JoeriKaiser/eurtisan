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
# Docker image tags cannot contain '/' (e.g. feature/foo).
IMAGE_TAG="$(echo "$GIT_REF" | tr '/' '-')"
export IMAGE_TAG

cd "$APP_DIR"

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
  echo "==> Migration succeeded — restarting services..."
  docker compose -f "$COMPOSE_FILE" up -d

  echo "==> Tagging deployed image as latest..."
  docker tag "eurtisan-app:${IMAGE_TAG}" eurtisan-app:latest
else
  echo "==> MIGRATION FAILED — rolling back to previous image"

  echo "==> Ensuring old containers are running with rollback image..."
  IMAGE_TAG=rollback-before-deploy docker compose -f "$COMPOSE_FILE" up -d
  exit 1
fi

echo "==> Deploy complete: ${GIT_REF} (image: eurtisan-app:${IMAGE_TAG})"
