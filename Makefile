.PHONY: up down logs dev build preview start install lint format check test shell auth-secret db-generate db-migrate db-push db-studio

# Docker Compose lifecycle
up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

shell:
	docker compose exec app sh

# Dependencies (works even if app isn't running; populates the node_modules volume)
install:
	docker compose run --rm app bun install

# Development server (starts the app container with hot reload)
dev: up

# Build & Production
build: up
	docker compose exec app bun run build

preview: up
	docker compose exec app bun run preview

start: up
	docker compose exec app bun run start

# Tooling
lint: up
	docker compose exec app bun run lint

format: up
	docker compose exec app bun run format

check: up
	docker compose exec app bun run check

# Testing
test: up
	docker compose exec app bun run test

# Auth
auth-secret: up
	docker compose exec app bunx @better-auth/cli secret

# Database
db-generate: up
	docker compose exec app bun run db:generate

db-migrate: up
	docker compose exec app bun run db:migrate

db-push: up
	docker compose exec app bun run db:push

db-studio:
	docker compose run --rm -p 4983:4983 app bun run db:studio
