#!/bin/sh
set -eu

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

validate docker-compose.prod.yml production
validate docker-compose.staging.yml staging

echo "Production and staging Compose configuration is valid"
