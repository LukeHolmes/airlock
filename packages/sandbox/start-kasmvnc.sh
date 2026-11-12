#!/bin/bash
# Start KasmVNC via Xvnc (non-interactive; avoids vncserver Perl prompts).
set -euo pipefail

export DISPLAY="${DISPLAY:-:1}"
export HOME="${HOME:-/home/airlock}"

VNC_PORT="${VNC_PORT:-6901}"
VNC_RESOLUTION="${VNC_RESOLUTION:-1920x1080}"
VNC_COL_DEPTH="${VNC_COL_DEPTH:-24}"
MAX_FRAME_RATE="${MAX_FRAME_RATE:-24}"
# Air-gapped sandboxes have no STUN egress; without this, Xvnc blocks on ICE and exits.
VNC_PUBLIC_IP="${VNC_PUBLIC_IP:-127.0.0.1}"

log() {
  printf '[kasmvnc-start] %s\n' "$*"
}

mkdir -p "${HOME}/.vnc"
touch "${HOME}/.vnc/.Xauthority"
export XAUTHORITY="${HOME}/.vnc/.Xauthority"

# Clean stale session state from prior supervisord restarts
vncserver -kill "${DISPLAY}" >/dev/null 2>&1 || true
pkill -f "Xvnc ${DISPLAY}" >/dev/null 2>&1 || true
rm -f "/tmp/.X11-unix/X${DISPLAY#:}" "/tmp/.X${DISPLAY#:}-lock" 2>/dev/null || true

log "Starting Xvnc on ${DISPLAY} port ${VNC_PORT} (publicIP=${VNC_PUBLIC_IP})..."
exec /usr/bin/Xvnc "${DISPLAY}" \
  -geometry "${VNC_RESOLUTION}" \
  -depth "${VNC_COL_DEPTH}" \
  -interface 0.0.0.0 \
  -WebsocketPort "${VNC_PORT}" \
  -publicIP "${VNC_PUBLIC_IP}" \
  -httpd /usr/share/kasmvnc/www \
  -disableBasicAuth \
  -SecurityTypes None
