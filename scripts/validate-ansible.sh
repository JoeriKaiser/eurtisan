#!/bin/bash
set -euo pipefail

ANSIBLE_IMAGE="${ANSIBLE_VALIDATION_IMAGE:-python:3.12-slim@sha256:423ed6ab25b1921a477529254bfeeabf5855151dc2c3141699a1bfc852199fbf}"
TEMP_DIR="$(mktemp -d)"
LOG_FILE="$TEMP_DIR/ansible.log"
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

write_vars() {
  local output="$1"
  local mollie_key="$2"
  cat >"$output" <<EOF
postgres_password: ci-validation-postgres-password
better_auth_secret: ci-validation-auth-secret-value-0001
database_encryption_key: MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=
meilisearch_api_key: ci-validation-meili-master-key
meilisearch_search_key: ci-validation-meili-search-key
s3_access_key_id: GKaaaaaaaaaaaaaaaaaaaaaaaa
s3_secret_access_key: dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd
garage_rpc_secret: eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee
garage_admin_token: ci-validation-garage-admin-token-0001
imgproxy_key: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
imgproxy_salt: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
mollie_api_key: $mollie_key
mollie_client_id: ci-validation-mollie-client-id
mollie_client_secret: ci-validation-mollie-client-secret
sendcloud_public_key: ci-validation-sendcloud-public
sendcloud_secret_key: ci-validation-sendcloud-secret
sendcloud_webhook_secret: ci-validation-sendcloud-webhook
metrics_token: ci-validation-metrics-token
grafana_admin_password: ci-validation-grafana-password
brevo_api_key: ci-validation-brevo-api-key
brevo_webhook_token: cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
s3_bucket: ci-validation-uploads
alertmanager_webhook_url: https://alerts.invalid/ci-validation
EOF
  chmod 600 "$output"
}

write_vars "$TEMP_DIR/staging.yml" "test_ci_validation_mollie_key_0001"
write_vars "$TEMP_DIR/production.yml" "live_ci_validation_mollie_key_0001"

set +e
docker run --rm \
  -e ANSIBLE_DEPRECATION_WARNINGS=True \
  -v "$PWD:/workspace:ro" \
  -v "$TEMP_DIR:/validation:ro" \
  -w /workspace \
  "$ANSIBLE_IMAGE" \
  sh -c "PIP_ROOT_USER_ACTION=ignore pip install --disable-pip-version-check --quiet ansible==14.1.0 && \
    ansible-playbook -i infrastructure/ansible/inventory/staging.example.yml infrastructure/ansible/playbook.yml --syntax-check && \
    ansible-playbook -i infrastructure/ansible/inventory/production.example.yml infrastructure/ansible/playbook.yml --syntax-check && \
    ansible-playbook -i infrastructure/ansible/inventory/staging.example.yml infrastructure/ansible/preflight.yml -e @/validation/staging.yml && \
    ansible-playbook -i infrastructure/ansible/inventory/production.example.yml infrastructure/ansible/preflight.yml -e @/validation/production.yml" \
  2>&1 | tee "$LOG_FILE"
command_status=${PIPESTATUS[0]}
set -e

if [[ "$command_status" -ne 0 ]]; then
  exit "$command_status"
fi

if grep -Eq '^\[(WARNING|DEPRECATION WARNING)\]:' "$LOG_FILE"; then
  echo "Ansible emitted a warning; infrastructure validation must remain warning-free" >&2
  exit 1
fi

echo "Ansible syntax, preflight, and template validation passed without warnings"
