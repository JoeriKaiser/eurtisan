#!/bin/bash
set -euo pipefail

BASH_IMAGE="bash:5.2.37@sha256:3bee76a96d86d5d2d5efc7c1c570e5a7c95db22348a26944e0e546fa174e3324"
PYTHON_IMAGE="python:3.12-slim@sha256:423ed6ab25b1921a477529254bfeeabf5855151dc2c3141699a1bfc852199fbf"
RENDERED_BACKUP="$(mktemp)"
cleanup() {
  rm -f "$RENDERED_BACKUP"
}
trap cleanup EXIT INT TERM

docker run --rm -v "$PWD:/workspace:ro" "$PYTHON_IMAGE" python -c '
from pathlib import Path
import re
content = Path("/workspace/infrastructure/ansible/roles/eurtisan/templates/backup.sh.j2").read_text()
content = re.sub(r"\{\{[^}]+\}\}", "", content)
content = re.sub(r"\{%[^%]+%\}", "", content)
print(content, end="")
' >"$RENDERED_BACKUP"

docker run --rm \
  -v "$PWD:/workspace:ro" \
  -v "$RENDERED_BACKUP:/tmp/backup-rendered.sh:ro" \
  -w /workspace \
  "$BASH_IMAGE" \
  bash -c 'find scripts infrastructure/ansible/files -type f -name "*.sh" -print0 | xargs -0 -r bash -n && bash -n /tmp/backup-rendered.sh'

echo "Shell scripts and rendered backup template passed bash syntax validation"
