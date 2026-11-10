#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/docs/assets"
ARTIFACTS="/opt/cursor/artifacts"
PDF="/tmp/airlock-portfolio-demo.pdf"
DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":${DISPLAY_NUM}"

printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 400 200]/Parent 2 0 R/Contents 4 0 R>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 72 100 Td (Airlock demo) Tj ET\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF\n' >"$PDF"

pgrep -f "Xvfb :${DISPLAY_NUM}" >/dev/null || Xvfb ":${DISPLAY_NUM}" -screen 0 1400x900x24 -ac &
sleep 1
docker image inspect airlock/sandbox:latest >/dev/null

stop_all() {
  pkill -f 'electron.*packages/ui' 2>/dev/null || true
  sleep 1
}

window_id() {
  xdotool search --classname 'airlock' 2>/dev/null | head -1 || xdotool search --name 'Airlock' 2>/dev/null | head -1
}

stop_all
cd "$ROOT/packages/ui"
unset VITE_DEV_SERVER_URL
export ELECTRON_DISABLE_SANDBOX=1

LOG=/tmp/airlock-cap-main.log
: >"$LOG"

pnpm start >>"$LOG" 2>&1 &
sleep 14

ffmpeg -y -f x11grab -framerate 8 -video_size 1280x800 -i "${DISPLAY}" -t 22 /tmp/airlock-gif-raw.mp4 2>/dev/null &
FF=$!

pnpm exec electron . -- "$PDF" >>"$LOG" 2>&1 &

for _ in $(seq 1 90); do
  grep -q 'Container session registered' "$LOG" 2>/dev/null && break
  sleep 1
done
sleep 16

W="$(window_id)"
import -window "$W" "$ASSETS/main-session.png"

wait "$FF" 2>/dev/null || true
ffmpeg -y -i /tmp/airlock-gif-raw.mp4 -vf "fps=8,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse" -loop 0 "$ASSETS/airlock-demo.gif" 2>/dev/null

cp "$ASSETS/main-session.png" "$ASSETS/airlock-demo.gif" "$ARTIFACTS/"
stop_all
grep -c 'Container session registered' "$LOG" || true
ls -lh "$ASSETS/main-session.png" "$ASSETS/airlock-demo.gif"
