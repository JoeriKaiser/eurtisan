#!/bin/sh
set -eu

# Compose requires service-level env_file paths to exist even when config is
# validated with explicit shell values and --no-env-resolution. Real workflows
# provide ignored files; clean CI checkouts do not.
created_env_files=""
ensure_env_file() {
  if [ ! -e "$1" ]; then
    : >"$1"
    created_env_files="$created_env_files $1"
  fi
}
ensure_env_file .env
ensure_env_file .env.garage

cleanup() {
  for env_file in $created_env_files; do
    rm -f "$env_file"
  done
}
trap cleanup EXIT HUP INT TERM

validate() {
  compose_file="$1"
  app_environment="$2"
  origin="https://${app_environment}.compose.invalid"

  env \
    CADDY_DOMAIN="${app_environment}.compose.invalid" \
    GRAFANA_ADMIN_IPS="0.0.0.0/32" \
    IMAGE_TAG="000000000000" \
    POSTGRES_USER="eurtisan" \
    POSTGRES_PASSWORD="compose-validation-password" \
    POSTGRES_DB="eurtisan" \
    MEILI_MASTER_KEY="compose-validation-master-key" \
    S3_ENDPOINT="https://s3.compose.invalid" \
    S3_REGION="fr-par" \
    S3_ACCESS_KEY_ID="compose-validation-access-key" \
    S3_SECRET_ACCESS_KEY="compose-validation-secret-key" \
    IMGPROXY_KEY="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
    IMGPROXY_SALT="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" \
    VITE_ANALYTICS_CONSENT_REQUIRED="true" \
    VITE_APP_ENV="$app_environment" \
    VITE_APP_VERSION="0000000000000000000000000000000000000000" \
    VITE_FARO_COLLECTOR_URL="/collect" \
    VITE_FARO_ENABLED="true" \
    VITE_FARO_APP_NAME="eurtisan" \
    VITE_FARO_SAMPLE_RATE="0.1" \
    VITE_IMGPROXY_BASE_URL="$origin/uploads" \
    VITE_MEILISEARCH_HOST="$origin/meilisearch" \
    VITE_MEILISEARCH_SEARCH_KEY="compose-validation-search-key" \
    VITE_PUBLIC_URL="$origin" \
    VITE_S3_BUCKET="eurtisan-compose-validation" \
    VITE_UMAMI_ENABLED="false" \
    docker compose -f "$compose_file" config --no-env-resolution --quiet
}

if grep -q '^        condition: unless-stopped$' docker-compose.prod.yml docker-compose.staging.yml; then
  echo "deploy.restart_policy condition=unless-stopped is invalid with max_attempts; use on-failure" >&2
  exit 1
fi

if grep -q 'IMGPROXY_S3_\(ACCESS_KEY_ID\|SECRET_ACCESS_KEY\)' docker-compose.prod.yml docker-compose.staging.yml; then
  echo "imgproxy uses the AWS SDK credential names, not IMGPROXY_S3_* credential names" >&2
  exit 1
fi
for compose_file in docker-compose.prod.yml docker-compose.staging.yml; do
  grep -q 'AWS_ACCESS_KEY_ID:' "$compose_file"
  grep -q 'AWS_SECRET_ACCESS_KEY:' "$compose_file"
  grep -q 'IMGPROXY_S3_ENDPOINT_USE_PATH_STYLE:' "$compose_file"
done

validate docker-compose.prod.yml production
validate docker-compose.staging.yml staging
env \
  REGISTRY_HTTP_SECRET=compose-validation-registry-secret \
  RELEASE_REGISTRY_DATA_PATH=/tmp/eurtisan-registry-validation \
  docker compose \
    -f infrastructure/ansible/roles/eurtisan/files/release-registry-compose.yml \
    config --quiet
docker compose -f docker-compose.yml -f docker-compose.ci.yml config --quiet
bash scripts/validate-release-registry-access.sh

echo "Production, staging, registry, and CI Compose configuration is valid"
