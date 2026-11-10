#!/usr/bin/env bash
# Capture styled README assets from production Electron build (not Vite dev).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/docs/assets"
ARTIFACTS="/opt/cursor/artifacts"
DEMO_PDF="/tmp/airlock-demo.pdf"
DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":${DISPLAY_NUM}"

mkdir -p "$ASSETS" "$ARTIFACTS"
printf '%%PDF-1.4\n%% Airlock portfolio demo\n' >"$DEMO_PDF"

pgrep -f "Xvfb :${DISPLAY_NUM}" >/dev/null || Xvfb ":${DISPLAY_NUM}" -screen 0 1400x900x24 -ac &
sleep 1

window_id() {
  xdotool search --classname 'airlock' 2>/dev/null | head -1 || xdotool search --name 'Airlock' 2>/dev/null | head -1
}

capture_win() {
  local out="$1"
  local wid
  wid="$(window_id)"
  [[ -n "$wid" ]] || { echo "no window for $out" >&2; return 1; }
  import -window "$wid" "$out"
  cp "$out" "$ARTIFACTS/$(basename "$out")"
  echo "captured $out"
}

stop_electron() {
  pkill -f 'electron.*packages/ui' 2>/dev/null || true
  pkill -f 'electron /agent/repos/airlock/packages/ui' 2>/dev/null || true
  sleep 1
}

start_electron() {
  cd "$ROOT/packages/ui"
  unset VITE_DEV_SERVER_URL
  export AIRLOCK_HEADLESS_GL=1
  export ELECTRON_DISABLE_SANDBOX=1
  pnpm start >>/tmp/airlock-cap.log 2>&1 &
  for _ in $(seq 1 60); do
    [[ -n "$(window_id)" ]] && return 0
    sleep 1
  done
  return 1
}

echo "== first-run progress =="
stop_electron
docker rmi airlock/sandbox:latest -f >/dev/null 2>&1 || true
start_electron
sleep 4
capture_win "$ASSETS/first-run-progress.png" || true
for _ in $(seq 1 180); do
  docker image inspect airlock/sandbox:latest >/dev/null 2>&1 && break
  sleep 1
done
sleep 2
capture_win "$ASSETS/cleanup-idle.png"

echo "== session flow + gif =="
ffmpeg -y -f x11grab -framerate 8 -video_size 1280x800 -i "${DISPLAY}" -t 22 /tmp/airlock-demo-raw.mp4 >/dev/null 2>&1 &
FFPID=$!
cd "$ROOT/packages/ui"
ELECTRON_DISABLE_SANDBOX=1 AIRLOCK_HEADLESS_GL=1 pnpm exec electron . "$DEMO_PDF" >>/tmp/airlock-cap2.log 2>&1 || true
for _ in $(seq 1 45); do
  docker ps --format '{{.Names}}' | grep -q '^airlock-' && break
  sleep 1
done
sleep 18
capture_win "$ASSETS/main-session.png"
W="$(window_id)"
[[ -n "$W" ]] && xdotool mousemove --window "$W" 1180 52 click 1
sleep 6
[[ -n "$W" ]] && xdotool mousemove --window "$W" 640 780 click 1
sleep 4
capture_win "$ASSETS/session-export.png"
wait "$FFPID" 2>/dev/null || true
ffmpeg -y -i /tmp/airlock-demo-raw.mp4 -vf "fps=8,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse" -loop 0 "$ASSETS/airlock-demo.gif" 2>/dev/null
cp "$ASSETS/airlock-demo.gif" "$ARTIFACTS/airlock-demo.gif"
for f in *.png airlock-demo.gif; do cp "$ASSETS/$f" "$ARTIFACTS/$f" 2>/dev/null || true; done
stop_electron
ls -la "$ASSETS"
