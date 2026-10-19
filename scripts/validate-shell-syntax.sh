#!/bin/bash
set -euo pipefail

BASH_IMAGE="bash:5.3.20@sha256:61962062d969cb46dfc2bad061d36342406fa485f64f246aa7e95693ca07df1f"
PYTHON_IMAGE="python:3.13-slim@sha256:70729b46c69b4f1e97c4822c1af3df53a1476cf5ddc6c087c0c10bc3a5678c2f"
RENDERED_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$RENDERED_DIR"
}
trap cleanup EXIT INT TERM

for template in backup.sh pgbackrest-backup.sh backup-status.sh; do
  docker run --rm -v "$PWD:/workspace:ro" "$PYTHON_IMAGE" python -c '
from pathlib import Path
import re
import sys
name = sys.argv[1]
content = Path(f"/workspace/infrastructure/ansible/roles/eurtisan/templates/{name}.j2").read_text()
content = re.sub(r"\{\{[^}]+\}\}", "", content)
content = re.sub(r"\{%[^%]+%\}", "", content)
print(content, end="")
' "$template" >"$RENDERED_DIR/$template"
done

docker run --rm \
  -v "$PWD:/workspace:ro" \
  -v "$RENDERED_DIR:/tmp/rendered:ro" \
  -w /workspace \
  "$BASH_IMAGE" \
  bash -c 'find scripts infrastructure/ansible/files -type f -name "*.sh" -print0 | xargs -0 -r bash -n && find /tmp/rendered -type f -print0 | xargs -0 -r bash -n'

echo "Shell scripts and rendered backup templates passed bash syntax validation"
