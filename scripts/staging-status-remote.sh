#!/usr/bin/env bash
set -euo pipefail

echo "=== Release metadata (non-secret) ==="
grep -E '^(NODE_ENV|IMAGE_REPOSITORY|IMAGE_TAG|IMAGE_DIGEST|VITE_APP_VERSION|SENDCLOUD_FORCE_UNSTAMPED_LETTER|SENDCLOUD_UNSTAMPED_LETTER_OPTION_CODE)=' /opt/eurtisan/.env || true

echo ""
echo "=== App and worker container images ==="
docker inspect --format '{{.Name}} status={{.State.Status}} image={{.Config.Image}} id={{.Image}}' \
  eurtisan-app-staging eurtisan-worker-staging 2>/dev/null || true

echo ""
echo "=== Host memory and swap ==="
free -m
swapon --show

echo ""
echo "=== Eurtisan container stats ==="
mapfile -t eurtisan_containers < <(docker ps --filter 'name=eurtisan-' --format '{{.Names}}')
if [ "${#eurtisan_containers[@]}" -gt 0 ]; then
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' "${eurtisan_containers[@]}"
else
  echo "No running eurtisan-* containers found"
fi

echo ""
echo "=== Mailpit message count ==="
docker exec eurtisan-mailpit-staging wget -qO- http://localhost:8025/api/v1/messages 2>/dev/null \
  | grep -oE '"total":[0-9]+' | head -n 1 || echo "Mailpit unavailable"

echo ""
echo "=== Recent app/worker error logs (last 100 lines, filtered) ==="
for container in eurtisan-app-staging eurtisan-worker-staging; do
  echo "--- ${container} ---"
  docker logs --tail 100 "${container}" 2>&1 | grep -iE '"level":"error"|error|fatal' | tail -n 5 || echo "(none)"
done
