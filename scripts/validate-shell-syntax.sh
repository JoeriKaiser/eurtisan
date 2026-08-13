#!/bin/bash
set -euo pipefail

BASH_IMAGE="bash:5.2.37@sha256:3bee76a96d86d5d2d5efc7c1c570e5a7c95db22348a26944e0e546fa174e3324"
PYTHON_IMAGE="python:3.12-slim@sha256:423ed6ab25b1921a477529254bfeeabf5855151dc2c3141699a1bfc852199fbf"
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
