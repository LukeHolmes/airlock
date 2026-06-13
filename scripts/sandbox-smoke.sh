#!/usr/bin/env bash
# Smoke test: file mount → container boot → KasmVNC HTTP → destroy
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${AIRLOCK_SANDBOX_IMAGE:-airlock/sandbox:latest}"
NETWORK="${AIRLOCK_TEST_NETWORK:-airlock-smoke-test}"
CONTAINER="airlock-smoke-$$"
TEST_PDF="$(mktemp /tmp/airlock-test-XXXXXX.pdf)"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f "$TEST_PDF"
}
trap cleanup EXIT

printf '%%PDF-1.4\n%% Airlock smoke test\n' >"$TEST_PDF"

echo "[smoke] Ensuring sandbox image exists..."
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "[smoke] Building $IMAGE..."
  docker build -t "$IMAGE" "$ROOT/packages/sandbox"
fi

echo "[smoke] Ensuring bridge network $NETWORK..."
if docker network inspect "$NETWORK" --format '{{.Internal}}' 2>/dev/null | grep -q true; then
  echo "[smoke] Recreating network (internal networks cannot publish ports)..."
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
fi
docker network inspect "$NETWORK" >/dev/null 2>&1 || \
  docker network create "$NETWORK"

echo "[smoke] Starting container..."
docker run -d --name "$CONTAINER" \
  --network "$NETWORK" \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  -p "127.0.0.1:0:6901" \
  -v "$TEST_PDF:/home/airlock/workspace/input/target.pdf:ro" \
  -e TARGET_FILE=/home/airlock/workspace/input/target.pdf \
  -e TARGET_URL= \
  -e DISPLAY=:1 \
  "$IMAGE" >/dev/null

sleep 2
MAPPED_PORT=$(docker port "$CONTAINER" 6901 2>/dev/null | head -1 | awk -F: '{print $NF}')
if [[ -z "$MAPPED_PORT" ]]; then
  echo "[smoke] FAIL: no host port mapped for 6901"
  docker logs "$CONTAINER" || true
  exit 1
fi

echo "[smoke] Waiting for KasmVNC on 127.0.0.1:${MAPPED_PORT}..."
for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${MAPPED_PORT}/" >/dev/null; then
    echo "[smoke] KasmVNC HTTP OK"
    break
  fi
  sleep 1
done

if ! curl -sf "http://127.0.0.1:${MAPPED_PORT}/" >/dev/null; then
  echo "[smoke] FAIL: KasmVNC not reachable"
  docker logs "$CONTAINER" || true
  exit 1
fi

if docker exec "$CONTAINER" test -f /home/airlock/workspace/input/target.pdf; then
  echo "[smoke] File mount OK"
else
  echo "[smoke] FAIL: mounted PDF missing in container"
  docker exec "$CONTAINER" ls -la /home/airlock/workspace/input/ || true
  exit 1
fi

if docker exec "$CONTAINER" ping -c 1 -W 1 8.8.8.8 >/dev/null 2>&1; then
  echo "[smoke] WARN: container has external network access (egress policy is v0.2.0)"
else
  echo "[smoke] Network isolation OK"
fi

XVNC_COUNT=$(docker logs "$CONTAINER" 2>&1 | grep -c "Starting Xvnc" || true)
if [[ "$XVNC_COUNT" -gt 1 ]]; then
  echo "[smoke] WARN: possible double-boot (xvnc starts=$XVNC_COUNT)"
else
  echo "[smoke] Single boot sequence OK"
fi

echo "[smoke] All checks passed"
