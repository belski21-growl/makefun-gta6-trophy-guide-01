#!/usr/bin/env bash
# Run from the repository when local listening sockets and Chromium are permitted.
set -euo pipefail
cd "$(dirname "$0")/.."
browser=/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell
node serve.ts > /tmp/gta6-ledger-serve.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  if curl -sf http://localhost:8080/ | grep -q 'Leonida Ledger'; then break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then echo 'Local server failed; see /tmp/gta6-ledger-serve.log' >&2; exit 1; fi
  sleep 0.2
done
mkdir -p screenshots
names=(1-cover 2-roadmap 3-spoiler 4-guide)
views=('view=tracker&trophy=30' 'view=roadmap&kind=missable' 'view=tracker&kind=story&trophy=2' 'view=tracker&kind=missable&trophy=34')
for index in 0 1 2 3; do
  "$browser" --headless --no-sandbox --disable-dev-shm-usage \
    --screenshot="screenshots/${names[$index]}.png" --window-size=1280,800 \
    --hide-scrollbars --virtual-time-budget=2000 "http://localhost:8080/#${views[$index]}" \
    > /tmp/gta6-ledger-capture.log 2>&1
done
python3 - <<'PY'
from pathlib import Path
from PIL import Image
for path in sorted(Path('screenshots').glob('*.png')):
    with Image.open(path) as image:
        image.load()
        assert max(image.size) <= 1280 and min(image.size) >= 480
        assert path.stat().st_size <= 262144
        print(path.name, path.stat().st_size, *image.size)
PY
