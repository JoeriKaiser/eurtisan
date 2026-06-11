.PHONY: up down stop logs dev build preview start install lint format check test test-related shell auth-secret db-generate db-migrate db-push db-studio init db-seed meili-setup FORCE

# Docker Compose lifecycle
up:
	touch .env.garage
	docker compose up -d
	sh scripts/garage-init.sh

down:
	docker compose down

stop:
	docker compose stop

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

E2E_DATABASE_URL ?= postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test

db-migrate-e2e: up
	docker compose exec -e DATABASE_URL=$(E2E_DATABASE_URL) app bun run db:migrate

db-seed-e2e: db-migrate-e2e
	docker compose exec -e DATABASE_URL=$(E2E_DATABASE_URL) app bun run db:seed -- --clear --force

test: up
	docker compose exec app bun run test $(filter-out test,$(MAKECMDGOALS))

test-related: up
	docker compose exec app bunx vitest related $(filter-out test-related,$(MAKECMDGOALS)) --run

e2e-install: up
	docker compose exec app bunx playwright install --with-deps chromium

e2e: up db-seed-e2e
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d app --force-recreate
	docker compose exec app bun -e "const start = Date.now(); while (Date.now() - start < 30000) { try { if ((await fetch('http://localhost:3000/signin')).ok) { console.log('Server is ready!'); process.exit(0); } } catch {} await new Promise(r => setTimeout(r, 500)); } console.error('Server not ready!'); process.exit(1);"
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml exec -e E2E_DATABASE_URL=$(E2E_DATABASE_URL) app bunx playwright test; \
		e2e_exit=$$?; \
		docker compose up -d app --force-recreate; \
		exit $$e2e_exit

e2e-ui:
	@echo "Playwright UI mode requires a display server (X11/Wayland) and cannot run inside a headless Docker container."
	@echo ""
	@echo "Run it on your host machine after installing dependencies:"
	@echo "  npx playwright install"
	@echo "  npx playwright test --ui"
	@echo ""
	@echo "Alternatively, run the tests headless in Docker and view the report:"
	@echo "  make e2e"
	@echo "  make e2e-report"

e2e-report: up
	@if [ ! -f e2e/report/index.html ]; then echo "No report found. Run 'make e2e' first."; exit 1; fi
	docker compose run --rm -p 9323:9323 app bun run e2e/serve-report.ts

# Auth
auth-secret: up
	docker compose exec app bunx @better-auth/cli secret

# Init
init:
	docker compose up -d --build
	docker compose run --rm app bun install
	docker compose up -d
	docker compose exec app bun run i18n:compile
	docker compose exec app bun run db:migrate
	docker compose exec app bun run db:seed -- --clear --force

# Database
db-generate: up
	docker compose exec app bun run db:generate

db-migrate: up
	docker compose exec app bun run db:migrate

db-push: up
	docker compose exec app bun run db:push

db-seed: up
	docker compose exec app bun run src/db/seed.ts --clear --force

# Staging / Production seed — idempotent, additive only. Safe to re-run.
db-staging-seed: up
	docker compose exec app bun run src/db/seed-staging.ts

db-studio:
	docker compose run --rm -p 4983:4983 app bun run db:studio

# Meilisearch
meili-setup: up
	docker compose exec app bun run src/lib/meili-setup.ts

# ── Infrastructure ───────────────────────────────────────────────────────
infra-setup-staging:
	ansible-playbook -i infrastructure/ansible/inventory/staging.yml infrastructure/ansible/playbook.yml -e @infrastructure/ansible/secrets.yml --vault-password-file infrastructure/ansible/.vault_pass

infra-setup-production:
	ansible-playbook -i infrastructure/ansible/inventory/production.yml infrastructure/ansible/playbook.yml -e @infrastructure/ansible/secrets.yml --vault-password-file infrastructure/ansible/.vault_pass

# Copy example inventory files before first use
infra-init:
	cp infrastructure/ansible/inventory/staging.example.yml infrastructure/ansible/inventory/staging.yml
	cp infrastructure/ansible/inventory/production.example.yml infrastructure/ansible/inventory/production.yml

# Generate production secrets (run locally, copy output to secrets.yml)
infra-secrets:
	@echo "postgres_password: $$(openssl rand -base64 32 | tr '+/' '-_')"
	@echo "better_auth_secret: $$(openssl rand -base64 32 | tr '+/' '-_')"
	@echo "meilisearch_api_key: $$(openssl rand -base64 32 | tr '+/' '-_')"

# Catch-all rule to allow passing arbitrary arguments (like file paths) to test/other commands without Make complaining
%: FORCE
	@:

FORCE:

