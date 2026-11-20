#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
browser=/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell
[[ -x "$browser" ]] || { printf '%s\n' 'Capture browser is not executable.' >&2; exit 1; }
node serve.ts >&2 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true' EXIT
ready=0
for ((attempt=0; attempt<30; attempt++)); do
  kill -0 "$server_pid" 2>/dev/null || { printf '%s\n' 'Capture server exited.' >&2; exit 1; }
  if curl --silent --fail --max-time 1 http://localhost:8080/ | grep 'Leonida Ledger' >/dev/null; then
    ready=1
    break
  fi
  sleep 0.2
done
if [[ "$ready" != 1 ]]; then
  printf '%s\n' 'Server did not become ready.' >&2
  exit 1
fi
mkdir -p screenshots
names=('1-cover' '2-roadmap' '3-spoiler' '4-guide')
views=('view=tracker&trophy=28' 'view=roadmap&kind=missable' 'view=tracker&kind=story&trophy=2' 'view=tracker&kind=missable&trophy=28')
python3 - "${views[@]}" <<'PY'
import json
import sys
with open('shots.json') as source:
    shots = json.load(source)
assert [shot['path'] for shot in shots] == ['/#' + view for view in sys.argv[1:]]
assert [shot['file'] for shot in shots] == [name + '.png' for name in ('1-cover', '2-roadmap', '3-spoiler', '4-guide')]
assert all(shot['viewport'] == {'width': 1280, 'height': 800} for shot in shots)
PY
for i in "${!names[@]}"; do
  "$browser" --headless --no-sandbox --disable-dev-shm-usage \
    --screenshot="screenshots/${names[$i]}.png" --window-size=1280,800 \
    --hide-scrollbars --virtual-time-budget=2000 "http://localhost:8080/#${views[$i]}"
done
python3 - <<'PY'
from pathlib import Path
from PIL import Image
for name in ('1-cover', '2-roadmap', '3-spoiler', '4-guide'):
    path = Path('screenshots') / (name + '.png')
    size = path.stat().st_size
    with Image.open(path) as image:
        assert image.format == 'PNG', path
        image.verify()
        dimensions = image.size
        assert dimensions == (1280, 800), (path, dimensions)
        assert max(dimensions) <= 1280 and min(dimensions) >= 480
        assert size <= 262144, (path, size)
    print(f'{path.name}: {size} bytes · {dimensions[0]}×{dimensions[1]}')
PY
