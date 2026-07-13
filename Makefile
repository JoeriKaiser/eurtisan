.PHONY: up down stop logs dev build preview start install lint format format-fix check bundle-check test test-related test-accessibility shell auth-secret db-generate db-check db-migrate db-migrate-fresh db-push db-studio i18n-compile init db-seed meili-setup promtool-check audit-production production-image-smoke compose-check ci-workflow-check shell-syntax ansible-check ansible-syntax ansible-preflight-staging ansible-preflight-production staging-smoke staging-evidence-create staging-evidence-validate staging-evidence-final load-staging FORCE

# Docker Compose lifecycle
up:
	touch .env.garage
	docker compose up -d
	sh scripts/garage-init.sh

# Start services only if they are not already running. Avoids recreating a container
# that was started with a different compose override (e.g. docker-compose.e2e.yml).
ensure-up:
	touch .env.garage
	docker compose up -d --no-recreate
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
	docker compose run --rm app bun install --frozen-lockfile

# Development server (starts the app container with hot reload)
dev: up

# Build & Production
build: up
	docker compose exec -T \
	  -e EURTISAN_PUBLIC_ENV_ONLY=true \
	  -e VITE_ANALYTICS_CONSENT_REQUIRED=true \
	  -e VITE_APP_ENV=production \
	  -e VITE_APP_VERSION=0000000000000000000000000000000000000000 \
	  -e VITE_FARO_COLLECTOR_URL=/collect \
	  -e VITE_FARO_ENABLED=true \
	  -e VITE_FARO_APP_NAME=eurtisan \
	  -e VITE_FARO_SAMPLE_RATE=0.1 \
	  -e VITE_IMGPROXY_BASE_URL=https://build-smoke.eurtisan.test/uploads \
	  -e VITE_MEILISEARCH_HOST=https://build-smoke.eurtisan.test/meilisearch \
	  -e VITE_MEILISEARCH_SEARCH_KEY=searchrestrictedbuildvalue000000000001 \
	  -e VITE_PUBLIC_URL=https://build-smoke.eurtisan.test \
	  -e VITE_S3_BUCKET=eurtisan-build-smoke \
	  -e VITE_UMAMI_ENABLED=false \
	  -e VITE_UMAMI_HOST_URL= \
	  -e VITE_UMAMI_SCRIPT_INTEGRITY= \
	  -e VITE_UMAMI_SCRIPT_URL= \
	  -e VITE_UMAMI_WEBSITE_ID= \
	  app bun run build

bundle-check: ensure-up
	docker compose exec -T app bun run bundle:check

preview: up
	docker compose exec app bun run preview

start: up
	docker compose exec app bun run start

production-image-smoke:
	sh scripts/smoke-production-image.sh

# Tooling
lint: ensure-up
	docker compose exec -T app bun run lint

format: ensure-up
	docker compose exec -T app bun run format

format-fix: ensure-up
	docker compose exec -T app bun run format:fix

check: ensure-up
	docker compose exec -T app bun run check

# Fail on production dependency advisories of moderate severity or higher.
audit-production: ensure-up
	docker compose exec -T app bun audit --production --audit-level=moderate

i18n-compile: ensure-up
	docker compose exec -T app bun run i18n:compile

# Observability & alerting validation
PROMETHEUS_IMAGE ?= prom/prometheus:v2.55.0@sha256:378f4e03703557d1c6419e6caccf922f96e6d88a530f7431d66a4c4f4b1000fe

promtool-check:
	docker run --rm -v "$(PWD)/infra/observability/prometheus/rules:/rules:ro" \
	  --entrypoint promtool \
	  $(PROMETHEUS_IMAGE) \
	  check rules \
	  /rules/app-health.yml \
	  /rules/backup-failure.yml \
	  /rules/checkout-failures.yml \
	  /rules/database-connectivity.yml \
	  /rules/dependency-health.yml \
	  /rules/disk-space.yml \
	  /rules/email-alerts.yml \
	  /rules/financial-reconciliation.yml \
	  /rules/job-errors.yml \
	  /rules/meilisearch-health.yml \
	  /rules/payment-webhook-errors.yml \
	  /rules/payout-stale-pending.yml

# Backup validation (rendered templates; requires ansible to render Jinja)
backup-dry-run:
	@echo "Backup script is an Ansible Jinja template. Render it with:"
	@echo "  ansible-playbook -i infrastructure/ansible/inventory/staging.example.yml infrastructure/ansible/playbook.yml --syntax-check"

SMOKE_TEST_BASE ?= http://localhost:3000
SMOKE_TEST_TIMEOUT_SECONDS ?= 120

deploy-smoke-test: up
	@echo "Running deploy-style smoke tests against $(SMOKE_TEST_BASE)..."
	@i=0; \
	while [ $$i -lt $(SMOKE_TEST_TIMEOUT_SECONDS) ]; do \
	  if curl -fsS "$(SMOKE_TEST_BASE)/api/health/ready" >/dev/null 2>&1; then \
	    echo "ready OK"; break; \
	  fi; \
	  i=$$((i + 1)); sleep 1; \
	done; \
	if [ $$i -eq $(SMOKE_TEST_TIMEOUT_SECONDS) ]; then echo "ready FAILED"; exit 1; fi
	curl -fsS "$(SMOKE_TEST_BASE)/api/health/live" >/dev/null && echo "live OK" || (echo "live FAILED"; exit 1)
	curl -fsS "$(SMOKE_TEST_BASE)/api/health" >/dev/null && echo "health OK" || (echo "health FAILED"; exit 1)
	curl -fsS "$(SMOKE_TEST_BASE)/api/health/deps" >/dev/null && echo "deps OK" || (echo "deps FAILED"; exit 1)

# Local observability stack
obs-up:
	docker compose -f infra/observability/docker-compose.observability.yml --env-file .env.local up -d

obs-down:
	docker compose -f infra/observability/docker-compose.observability.yml --env-file .env.local down

obs-logs:
	docker compose -f infra/observability/docker-compose.observability.yml --env-file .env.local logs -f

obs-status:
	@echo "Grafana:      http://127.0.0.1:3001"
	@echo "Prometheus:   http://127.0.0.1:9090"
	@echo "Alertmanager: http://127.0.0.1:9093"
	@echo "Loki:         http://127.0.0.1:3100"
	@echo "Tempo:        http://127.0.0.1:3200"

# Testing

E2E_DATABASE_URL ?= postgresql://eurtisan:eurtisan@db-test:5432/eurtisan_test

# Ensure the isolated E2E database is up before migrating/seeding.
# Using the e2e compose overlay for these commands guarantees the correct
# DATABASE_URL, E2E_TEST flag, and other e2e-only env vars are in scope.
db-migrate-e2e: up
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d db-test
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm app bun run db:migrate

db-seed-e2e: db-migrate-e2e
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml run --rm app bun run db:seed -- --clear --force
	docker compose run --rm app bun run scripts/setup-garage-cors.ts
	@rm -f e2e/.auth/*.json

# Bun/JSC heap cap for the test runner. The full browser project needs a large
# heap because Vitest keeps Vite transforms in memory across ~40 test files.
BUN_JSC_FORCE_RAM_SIZE ?= 30000000000

test: ensure-up
	@if [ -z "$(filter-out test,$(MAKECMDGOALS))" ]; then \
		unit_exit=0; browser_exit=0; \
		docker compose exec -T -e BUN_JSC_forceRAMSize=$(BUN_JSC_FORCE_RAM_SIZE) app bun run test -- --project unit || unit_exit=$$?; \
		docker compose exec -T -e BUN_JSC_forceRAMSize=$(BUN_JSC_FORCE_RAM_SIZE) app bun run test -- --project browser || browser_exit=$$?; \
		exit $$((unit_exit || browser_exit)); \
	else \
		docker compose exec -T -e BUN_JSC_forceRAMSize=$(BUN_JSC_FORCE_RAM_SIZE) app bun run test $(filter-out test,$(MAKECMDGOALS)); \
	fi

test-related: ensure-up
	docker compose exec app bunx vitest related $(filter-out test-related,$(MAKECMDGOALS)) --run

# Focused rendered accessibility scans and static theme/reflow contracts.
test-accessibility: ensure-up
	docker compose exec -T -e BUN_JSC_forceRAMSize=$(BUN_JSC_FORCE_RAM_SIZE) app bun run test -- \
	  src/lib/accessibility/contrast.test.ts \
	  src/components/ui/accessibility.test.tsx \
	  src/components/ui/primitives/accessibility.test.tsx \
	  src/components/admin/DataTable.test.tsx \
	  src/components/admin/DataTablePagination.test.tsx \
	  src/route-components/signin.test.tsx \
	  src/components/ProductDetail.test.tsx \
	  src/components/CartPage.test.tsx \
	  src/components/CheckoutPage.test.tsx \
	  src/components/DisputeThreadPage.test.tsx

e2e-install: up
	docker compose exec app bunx playwright install --with-deps chromium

E2E_READY_TIMEOUT_SECONDS ?= 120

e2e: up db-seed-e2e
	@docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d app --force-recreate
	@echo "Waiting for app to be ready (max $(E2E_READY_TIMEOUT_SECONDS)s)..."
	@i=0; \
	while [ $$i -lt $(E2E_READY_TIMEOUT_SECONDS) ]; do \
		if docker compose -f docker-compose.yml -f docker-compose.e2e.yml exec -T app bun -e "fetch('http://localhost:3000/api/health/ready').then(r => { if (!r.ok) process.exit(1); process.exit(0); }).catch(() => process.exit(1))" >/dev/null 2>&1; then \
			echo "App is ready"; \
			break; \
		fi; \
		i=$$((i + 1)); \
		sleep 1; \
	done; \
	if [ $$i -eq $(E2E_READY_TIMEOUT_SECONDS) ]; then \
		echo "App did not become ready within $(E2E_READY_TIMEOUT_SECONDS)s"; \
		docker compose up -d app --force-recreate; \
		exit 1; \
	fi
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

# Playwright Agent CLI (for browser automation by AI coding agents)
playwright-cli: up
	docker compose exec app bunx playwright-cli $(if $(CMD),$(CMD),$(filter-out playwright-cli,$(MAKECMDGOALS)))

# Retrieve the last sent email from Mailpit as JSON
email-last: up
	docker compose exec app bun run scripts/mailpit-helper.ts last

# Retrieve extracted links from the last sent email
email-links: up
	docker compose exec app bun run scripts/mailpit-helper.ts links

# Check local Meilisearch indexing stats
meili-status: up
	docker compose exec app bun -e "fetch('http://meilisearch:7700/stats', { headers: { Authorization: 'Bearer meilisearch-api-key' } }).then(r => r.json()).then(console.log)"


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
	docker compose exec -T app bun run db:generate

db-check: ensure-up
	docker compose exec -T app bun run db:check

db-migrate: up
	docker compose exec -T app bun run db:migrate

db-migrate-fresh: ensure-up
	sh scripts/validate-fresh-migrations.sh

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

# ── Release and infrastructure validation ───────────────────────────────
ACTIONLINT_IMAGE ?= rhysd/actionlint:1.7.7@sha256:887a259a5a534f3c4f36cb02dca341673c6089431057242cdc931e9f133147e9

compose-check:
	sh scripts/validate-compose-config.sh

ci-workflow-check:
	docker run --rm -v "$(PWD):/repo:ro" -w /repo $(ACTIONLINT_IMAGE)

shell-syntax:
	bash scripts/validate-shell-syntax.sh

ansible-check:
	bash scripts/validate-ansible.sh

# ── Authorized staging qualification ─────────────────────────────────────
staging-smoke: ensure-up
	@test -n "$(STAGING_BASE_URL)" || (echo "STAGING_BASE_URL is required"; exit 1)
	@test -n "$(EXPECTED_RELEASE)" || (echo "EXPECTED_RELEASE is required"; exit 1)
	docker compose exec -T app bun run staging:qualification smoke --base-url "$(STAGING_BASE_URL)" --expected-release "$(EXPECTED_RELEASE)"

staging-evidence-create: ensure-up
	@test -n "$(QUALIFICATION_EVIDENCE)" || (echo "QUALIFICATION_EVIDENCE is required"; exit 1)
	docker compose exec -T app bun run staging:qualification create --output "$(QUALIFICATION_EVIDENCE)" --qualification-id "$(QUALIFICATION_ID)" --eu-region "$(QUALIFICATION_REGION)" --git-sha "$(QUALIFICATION_GIT_SHA)" --image-repository "$(QUALIFICATION_IMAGE_REPOSITORY)" --image-digest "$(QUALIFICATION_IMAGE_DIGEST)" --public-config-digest "$(QUALIFICATION_PUBLIC_CONFIG_DIGEST)"

staging-evidence-validate: ensure-up
	@test -n "$(QUALIFICATION_EVIDENCE)" || (echo "QUALIFICATION_EVIDENCE is required"; exit 1)
	docker compose exec -T app bun run staging:qualification validate --evidence "$(QUALIFICATION_EVIDENCE)" --final false

staging-evidence-final: ensure-up
	@test -n "$(QUALIFICATION_EVIDENCE)" || (echo "QUALIFICATION_EVIDENCE is required"; exit 1)
	docker compose exec -T app bun run staging:qualification validate --evidence "$(QUALIFICATION_EVIDENCE)" --final true

K6_IMAGE ?= grafana/k6:1.1.0@sha256:aa8202f377550cee0c8bad295bbe8d2d4d4cf88d15c98383e9ecc53c56882308
load-staging:
	@test "$(STAGING_LOAD_AUTHORIZED)" = "I_HAVE_OWNER_AUTHORIZATION" || (echo "Set STAGING_LOAD_AUTHORIZED=I_HAVE_OWNER_AUTHORIZATION after approval"; exit 1)
	@test -n "$(STAGING_BASE_URL)" || (echo "STAGING_BASE_URL is required"; exit 1)
	docker run --rm -e BASE_URL="$(STAGING_BASE_URL)" -v "$(PWD)/load-tests:/scripts:ro" $(K6_IMAGE) run /scripts/homepage.js
	docker run --rm -e BASE_URL="$(STAGING_BASE_URL)" -v "$(PWD)/load-tests:/scripts:ro" $(K6_IMAGE) run /scripts/search.js

# ── Owner-supplied Ansible validation/deployment ─────────────────────────
ANSIBLE_PREFLIGHT_VARS ?=
ANSIBLE_VALIDATION_IMAGE ?= python:3.12-slim@sha256:423ed6ab25b1921a477529254bfeeabf5855151dc2c3141699a1bfc852199fbf
ANSIBLE_VALIDATION_SETUP = PIP_ROOT_USER_ACTION=ignore pip install --disable-pip-version-check --quiet ansible==14.1.0

ansible-syntax:
	docker run --rm -v "$(PWD):/workspace:ro" -w /workspace $(ANSIBLE_VALIDATION_IMAGE) sh -c "$(ANSIBLE_VALIDATION_SETUP) && ansible-playbook -i infrastructure/ansible/inventory/staging.example.yml infrastructure/ansible/playbook.yml --syntax-check && ansible-playbook -i infrastructure/ansible/inventory/production.example.yml infrastructure/ansible/playbook.yml --syntax-check"

ansible-preflight-staging:
	@test -n "$(ANSIBLE_PREFLIGHT_VARS)" || (echo "ANSIBLE_PREFLIGHT_VARS is required"; exit 1)
	docker run --rm -v "$(PWD):/workspace:ro" -v "$(ANSIBLE_PREFLIGHT_VARS):/tmp/preflight-vars.yml:ro" -w /workspace $(ANSIBLE_VALIDATION_IMAGE) sh -c "$(ANSIBLE_VALIDATION_SETUP) && ansible-playbook -i infrastructure/ansible/inventory/staging.example.yml infrastructure/ansible/preflight.yml -e @/tmp/preflight-vars.yml"

ansible-preflight-production:
	@test -n "$(ANSIBLE_PREFLIGHT_VARS)" || (echo "ANSIBLE_PREFLIGHT_VARS is required"; exit 1)
	docker run --rm -v "$(PWD):/workspace:ro" -v "$(ANSIBLE_PREFLIGHT_VARS):/tmp/preflight-vars.yml:ro" -w /workspace $(ANSIBLE_VALIDATION_IMAGE) sh -c "$(ANSIBLE_VALIDATION_SETUP) && ansible-playbook -i infrastructure/ansible/inventory/production.example.yml infrastructure/ansible/preflight.yml -e @/tmp/preflight-vars.yml"

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
	@echo "better_auth_secret: $$(openssl rand -base64 32)"
	@echo "database_encryption_key: $$(openssl rand -base64 32)"
	@echo "meilisearch_api_key: $$(openssl rand -base64 32 | tr '+/' '-_')"
	@echo "imgproxy_key: $$(openssl rand -hex 32)"
	@echo "imgproxy_salt: $$(openssl rand -hex 32)"
	@echo "metrics_token: $$(openssl rand -base64 32 | tr '+/' '-_')"

# Catch-all rule to allow passing arbitrary arguments (like file paths) to test/other commands without Make complaining
%: FORCE
	@:

FORCE:
