#!/usr/bin/env bash
# Capture README demo PNGs and GIF (Linux + Xvfb). Run from repo root after pnpm build.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/docs/assets"
ARTIFACTS="/opt/cursor/artifacts"
DEMO_PDF="/tmp/airlock-demo.pdf"
DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":${DISPLAY_NUM}"

mkdir -p "$ASSETS" "$ARTIFACTS"
printf '%%PDF-1.4\n%% Airlock portfolio demo\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n%%EOF\n' >"$DEMO_PDF"

if ! pgrep -f "Xvfb :${DISPLAY_NUM}" >/dev/null 2>&1; then
  Xvfb ":${DISPLAY_NUM}" -screen 0 1280x800x24 -ac &
  sleep 1
fi

window_id() {
  xdotool search --name 'Airlock' 2>/dev/null | head -1
}

capture() {
  local out="$1"
  local wid
  wid="$(window_id)"
  if [[ -z "$wid" ]]; then
  echo "[capture] No Airlock window for $out" >&2
    return 1
  fi
  import -window "$wid" "$out"
  cp "$out" "$ARTIFACTS/$(basename "$out")"
  echo "[capture] $out"
}

start_app() {
  cd "$ROOT/packages/ui"
  ELECTRON_DISABLE_SANDBOX=1 pnpm start >/tmp/airlock-electron.log 2>&1 &
  APP_PID=$!
  for _ in $(seq 1 60); do
    if [[ -n "$(window_id)" ]]; then
      return 0
    fi
    sleep 1
  done
  echo "[capture] Electron window did not appear" >&2
  cat /tmp/airlock-electron.log | tail -20
  return 1
}

stop_app() {
  pkill -f "electron.*packages/ui" >/dev/null 2>&1 || true
  sleep 1
}

echo "[capture] First-run progress (bundled build)…"
stop_app
docker rmi airlock/sandbox:latest -f >/dev/null 2>&1 || true
start_app
sleep 3
capture "$ASSETS/first-run-progress.png" || true
# Wait for bundled build to finish (first-run auto-starts when image missing)
for _ in $(seq 1 120); do
  if docker image inspect airlock/sandbox:latest >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
sleep 2
capture "$ASSETS/cleanup-idle.png" || cp "$ASSETS/first-run-progress.png" "$ASSETS/cleanup-idle.png" 2>/dev/null || true

echo "[capture] Recording GIF for core flow…"
ffmpeg -y -f x11grab -video_size 1280x800 -i "${DISPLAY}" -t 0.1 "$ARTIFACTS/gif-prep.png" >/dev/null 2>&1 || true
ffmpeg -y -f x11grab -framerate 8 -video_size 960x600 -i "${DISPLAY}" -t 18 "$ARTIFACTS/airlock-demo-raw.mp4" &
FFMPEG_PID=$!

sleep 1
cd "$ROOT/packages/ui"
ELECTRON_DISABLE_SANDBOX=1 pnpm exec electron . "$DEMO_PDF" >/dev/null 2>&1 || \
  ELECTRON_DISABLE_SANDBOX=1 pnpm exec electron . -- "$DEMO_PDF" >/dev/null 2>&1 || true

cd "$ROOT/packages/ui"
ELECTRON_DISABLE_SANDBOX=1 pnpm exec electron . "$DEMO_PDF" >/tmp/airlock-second.log 2>&1 || true

for _ in $(seq 1 90); do
  WID="$(window_id)"
  if [[ -n "$WID" ]] && xdotool getwindowname "$WID" | grep -qi airlock; then
    if grep -q "Sealed" /tmp/airlock-second.log 2>/dev/null || true; then
      :
    fi
    # Active session shows destroy control in header
    break
  fi
  sleep 1
done
sleep 2
capture "$ASSETS/main-session.png" || true

WID="$(window_id)"
if [[ -n "$WID" ]]; then
  xdotool windowactivate --sync "$WID"
  # Header "Destroy workspace" (~top-right)
  xdotool mousemove --window "$WID" 1080 48 click 1
  sleep 2
  ANALYZE_Y=620
  xdotool mousemove --window "$WID" 640 "$ANALYZE_Y" click 1
  sleep 2
  if true; then
    sleep 2
    capture "$ASSETS/session-export.png" || true
    CLOSE="$(xdotool search --name 'Close' | head -1)"
    [[ -n "$CLOSE" ]] && xdotool click "$CLOSE" 2>/dev/null || xdotool key Escape
  fi
fi

wait "$FFMPEG_PID" 2>/dev/null || true
ffmpeg -y -i "$ARTIFACTS/airlock-demo-raw.mp4" -vf "scale=960:-1:flags=lanczos" -r 10 \
  "$ARTIFACTS/airlock-demo.gif" 2>/dev/null || \
  ffmpeg -y -i "$ARTIFACTS/airlock-demo-raw.mp4" -vf "fps=10,scale=960:-1" "$ARTIFACTS/airlock-demo.gif"
cp "$ARTIFACTS/airlock-demo.gif" "$ASSETS/airlock-demo.gif" 2>/dev/null || true

for f in first-run-progress.png main-session.png session-export.png cleanup-idle.png airlock-demo.gif; do
  [[ -f "$ASSETS/$f" ]] && cp "$ASSETS/$f" "$ARTIFACTS/$f" 2>/dev/null || true
done

ls -la "$ASSETS"
stop_app
