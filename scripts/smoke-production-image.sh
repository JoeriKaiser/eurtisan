#!/bin/sh
set -eu

IMAGE_NAME="${PRODUCTION_SMOKE_IMAGE:-eurtisan-app:config-smoke}"
PUBLIC_ORIGIN="${PRODUCTION_SMOKE_ORIGIN:-https://build-smoke.eurtisan.test}"
RELEASE_VERSION="${PRODUCTION_SMOKE_VERSION:-$(git rev-parse HEAD)}"
SEARCH_VALUE="searchrestrictedbuildvalue000000000001"
SERVER_ENV_FILE="$(mktemp)"
APP_CONTAINER=""
cleanup() {
  if [ -n "$APP_CONTAINER" ]; then
    docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
  fi
  rm -f "$SERVER_ENV_FILE"
}
trap cleanup EXIT INT TERM

build_image() {
  docker build -f Dockerfile.prod -t "$IMAGE_NAME" \
    --build-arg PUBLIC_ANALYTICS_CONSENT_REQUIRED=true \
    --build-arg PUBLIC_APP_ENV=production \
    --build-arg PUBLIC_APP_VERSION="$RELEASE_VERSION" \
    --build-arg PUBLIC_FARO_COLLECTOR_URL=/collect \
    --build-arg PUBLIC_FARO_ENABLED=true \
    --build-arg PUBLIC_FARO_APP_NAME=eurtisan \
    --build-arg PUBLIC_FARO_SAMPLE_RATE=0.1 \
    --build-arg PUBLIC_IMGPROXY_BASE_URL="$PUBLIC_ORIGIN/uploads" \
    --build-arg PUBLIC_MEILISEARCH_HOST="$PUBLIC_ORIGIN/meilisearch" \
    --build-arg PUBLIC_MEILISEARCH_VALUE="$SEARCH_VALUE" \
    --build-arg PUBLIC_SITE_URL="$PUBLIC_ORIGIN" \
    --build-arg PUBLIC_S3_BUCKET=eurtisan-build-smoke \
    --build-arg PUBLIC_UMAMI_ENABLED=false \
    --build-arg PUBLIC_UMAMI_HOST_URL= \
    --build-arg PUBLIC_UMAMI_SCRIPT_INTEGRITY= \
    --build-arg PUBLIC_UMAMI_SCRIPT_URL= \
    --build-arg PUBLIC_UMAMI_WEBSITE_ID= \
    .
}

if [ "${VERIFY_MISSING_PUBLIC_CONFIG:-true}" = "true" ]; then
  failure_log="$(mktemp)"
  if docker build -f Dockerfile.prod -t "$IMAGE_NAME-missing" . >"$failure_log" 2>&1; then
    echo "Production image unexpectedly built without public configuration" >&2
    rm -f "$failure_log"
    exit 1
  fi
  if ! grep -q 'VITE_PUBLIC_URL' "$failure_log"; then
    echo "Missing-config build failed without naming VITE_PUBLIC_URL" >&2
    rm -f "$failure_log"
    exit 1
  fi
  rm -f "$failure_log"
fi

build_image

docker run --rm \
  -e VITE_ANALYTICS_CONSENT_REQUIRED=true \
  -e VITE_APP_ENV=production \
  -e VITE_APP_VERSION="$RELEASE_VERSION" \
  -e VITE_FARO_COLLECTOR_URL=/collect \
  -e VITE_FARO_ENABLED=true \
  -e VITE_FARO_APP_NAME=eurtisan \
  -e VITE_FARO_SAMPLE_RATE=0.1 \
  -e VITE_IMGPROXY_BASE_URL="$PUBLIC_ORIGIN/uploads" \
  -e VITE_MEILISEARCH_HOST="$PUBLIC_ORIGIN/meilisearch" \
  -e VITE_MEILISEARCH_SEARCH_KEY="$SEARCH_VALUE" \
  -e VITE_PUBLIC_URL="$PUBLIC_ORIGIN" \
  -e VITE_S3_BUCKET=eurtisan-build-smoke \
  -e VITE_UMAMI_ENABLED=false \
  -e CLIENT_SMOKE_FORBIDDEN_MARKERS=serveronlymarkeralpha,serveronlymarkerbeta \
  "$IMAGE_NAME" bun run smoke:client-config

cat >"$SERVER_ENV_FILE" <<EOF
NODE_ENV=production
APP_ENV=production
PUBLIC_URL=$PUBLIC_ORIGIN
BETTER_AUTH_URL=$PUBLIC_ORIGIN
BETTER_AUTH_SECRET=syntheticauthvalue000000000000000001
DATABASE_URL=postgresql://eurtisan:syntheticpassword@db:5432/eurtisan
DATABASE_ENCRYPTION_KEY=$(printf '0123456789abcdef0123456789abcdef' | base64 | tr -d '\n')
MEILISEARCH_ENABLED=true
MEILISEARCH_HOST=http://meilisearch:7700
MEILISEARCH_API_KEY=syntheticmeilimastervalue0000001
MEILI_MASTER_KEY=syntheticmeilimastervalue0000001
S3_STORAGE_ENABLED=true
S3_ENDPOINT=https://s3.fr-par.scw.cloud
S3_PUBLIC_ENDPOINT=https://s3.fr-par.scw.cloud
S3_REGION=fr-par
S3_BUCKET=eurtisan-build-smoke
S3_ACCESS_KEY_ID=syntheticstorageaccess0001
S3_SECRET_ACCESS_KEY=syntheticstoragesecretvalue000001
IMGPROXY_ENABLED=true
IMGPROXY_BASE_URL=$PUBLIC_ORIGIN/uploads
IMGPROXY_HEALTH_URL=http://imgproxy:8080/health
IMGPROXY_KEY=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
IMGPROXY_SALT=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
MOLLIE_PAYMENTS_ENABLED=true
MOLLIE_CONNECT_ENABLED=true
MOLLIE_API_KEY=live_$(printf '%030d' 0)
MOLLIE_CLIENT_ID=syntheticmollieapplication0001
MOLLIE_CLIENT_SECRET=syntheticmolliesecretvalue000001
MOLLIE_TEST_MODE=false
MOCK_PAYMENTS_ENABLED=false
MOCK_PAYOUTS_ENABLED=false
FINANCIAL_TOTALS_RECONCILIATION_INTERVAL_MS=21600000
FINANCIAL_TOTALS_RECONCILIATION_BATCH_SIZE=500
SENDCLOUD_ENABLED=true
SENDCLOUD_PUBLIC_KEY=syntheticsendcloudpublic0001
SENDCLOUD_SECRET_KEY=syntheticsendcloudsecret000001
SENDCLOUD_WEBHOOK_SECRET=syntheticsendcloudwebhook000001
SENDCLOUD_FORCE_UNSTAMPED_LETTER=false
EMAIL_DELIVERY_PROVIDER=brevo
BREVO_API_KEY=syntheticbrevoapikeyvalue00000001
BREVO_WEBHOOK_TOKEN=wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww
EMAIL_SMTP_PORT=587
EMAIL_FROM_ADDRESS=noreply@eurtisan.test
EMAIL_REPLY_TO_ADDRESS=support@eurtisan.test
METRICS_TOKEN=syntheticmetricsvalue000000000001
ENABLE_VIES_VALIDATION=false
PLATFORM_VAT_LIABLE=true
FARO_ENABLED=true
UMAMI_ENABLED=false
VITE_ANALYTICS_CONSENT_REQUIRED=true
VITE_APP_ENV=production
VITE_APP_VERSION=$RELEASE_VERSION
VITE_FARO_COLLECTOR_URL=/collect
VITE_FARO_ENABLED=true
VITE_FARO_APP_NAME=eurtisan
VITE_FARO_SAMPLE_RATE=0.1
VITE_IMGPROXY_BASE_URL=$PUBLIC_ORIGIN/uploads
VITE_MEILISEARCH_HOST=$PUBLIC_ORIGIN/meilisearch
VITE_MEILISEARCH_SEARCH_KEY=$SEARCH_VALUE
VITE_PUBLIC_URL=$PUBLIC_ORIGIN
VITE_S3_BUCKET=eurtisan-build-smoke
VITE_UMAMI_ENABLED=false
EOF

docker run --rm --env-file "$SERVER_ENV_FILE" -e VALIDATE_ENV_ONLY=true "$IMAGE_NAME"
docker run --rm --env-file "$SERVER_ENV_FILE" "$IMAGE_NAME" bun run validate:server-env
docker run --rm --env-file "$SERVER_ENV_FILE" \
  -e BREVO_API_KEY= \
  -e EMAIL_SMTP_HOST=mailpit \
  "$IMAGE_NAME" \
  bun -e "await import('#/lib/env.server'); const { BrevoEmailProvider } = await import('./src/integrations/email/brevo-email-provider.ts'); new BrevoEmailProvider({ mock: true })"

APP_CONTAINER="$(docker run -d --env-file "$SERVER_ENV_FILE" "$IMAGE_NAME")"
health_body=""
health_ready=false
for _attempt in $(seq 1 30); do
  if health_body="$(
    docker exec "$APP_CONTAINER" bun -e \
      "const response = await fetch('http://127.0.0.1:3000/api/health/live'); if (!response.ok) process.exit(1); process.stdout.write(await response.text())" \
      2>/dev/null
  )" && [ "$health_body" = '{"status":"ok"}' ]; then
    health_ready=true
    break
  fi
  sleep 1
done
if [ "$health_ready" != "true" ]; then
  echo "Production server did not return a valid liveness response: $health_body" >&2
  docker logs "$APP_CONTAINER" >&2
  exit 1
fi
docker exec "$APP_CONTAINER" bun -e '
  const response = await fetch("http://127.0.0.1:3000/terms", {
    headers: { "x-forwarded-proto": "https" },
  })
  if (!response.ok) throw new Error(`Production HTML route returned HTTP ${response.status}`)
  const requiredHeaders = [
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "permissions-policy",
  ]
  const missingHeaders = requiredHeaders.filter((name) => !response.headers.get(name))
  if (missingHeaders.length > 0) throw new Error(`Missing production headers: ${missingHeaders.join(", ")}`)
  const csp = response.headers.get("content-security-policy")
  const nonce = csp?.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1]
  const html = await response.text()
  if (!nonce) throw new Error("Production CSP does not contain a nonce")
  if (!html.includes(`nonce="${nonce}"`)) throw new Error("Production HTML nonce does not match CSP")
'
docker rm -f "$APP_CONTAINER" >/dev/null
APP_CONTAINER=""

docker run --rm --env-file "$SERVER_ENV_FILE" -e VALIDATE_ENV_ONLY=true "$IMAGE_NAME" sh -c '
  set -eu
  for job in \
    job:inventory-cleanup \
    job:session-cleanup \
    job:cart-cleanup \
    job:verification-cleanup \
    job:meilisearch-sync \
    job:audit-log-cleanup \
    job:sendcloud-reconciliation \
    job:mollie-payment-reconciliation \
    job:payout-reconciliation \
    job:payout-reconciliation-log-cleanup \
    job:email-outbox-worker \
    job:email-suppression-cleanup \
    job:email-retention-cleanup \
    job:financial-totals-reconciliation \
    job:sendcloud-retention-cleanup
  do
    bun run "$job"
  done
'
