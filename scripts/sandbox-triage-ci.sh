#!/usr/bin/env bash
# Offline static triage smoke (CI) — runs inside built sandbox image, no network.
set -euo pipefail

IMAGE="${1:-airlock/sandbox:test}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KIT_DIR="$REPO_ROOT/fixtures/m6-trick-kit"
MANIFEST="$KIT_DIR/manifest.json"
OUT_DIR="$(mktemp -d)"
trap 'rm -rf "$OUT_DIR"' EXIT

if [ ! -f "$MANIFEST" ]; then
  echo "✗ Missing $MANIFEST — run scripts/generate-m6-trick-kit.py"
  exit 1
fi

run_triage() {
  local name="$1"
  local host_path="$2"
  echo "Triage: $name"
  docker run --rm \
    --network none \
    --cap-drop ALL \
    --entrypoint /usr/local/bin/airlock-triage \
    -v "$host_path:/input/${name}:ro" \
    "$IMAGE" \
    "/input/${name}" >"$OUT_DIR/out-${name}.json"
}

while IFS= read -r file; do
  [ -n "$file" ] || continue
  if [ ! -f "$KIT_DIR/$file" ]; then
    echo "✗ Fixture missing: $KIT_DIR/$file"
    exit 1
  fi
  run_triage "$file" "$KIT_DIR/$file"
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d.get('version',1)>=1; print('ok', sys.argv[2])" \
    "$OUT_DIR/out-${file}.json" "$file"
done < <(python3 -c "import json; print('\n'.join(x['file'] for x in json.load(open('$MANIFEST'))['fixtures']))")

python3 "$(dirname "$0")/assert-m6-trick-kit.py" "$MANIFEST" "$OUT_DIR"

echo "Preparing one-page PDF for flatten smoke"
WORK="$OUT_DIR/work"
mkdir -p "$WORK"
python3 - "$WORK/one.png" <<'PY'
import struct, zlib, sys
path = sys.argv[1]
w = h = 8
raw = b"".join(b"\x00" + (b"\xff\xff\xff" * w) for _ in range(h))
compressed = zlib.compress(raw, 9)

def chunk(tag, data):
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
open(path, "wb").write(png)
PY
chmod -R a+rw "$WORK"
docker run --rm --user 0:0 --entrypoint img2pdf \
  -v "$WORK:/work:rw" \
  "$IMAGE" \
  /work/one.png -o /work/one-page.pdf

echo "Flatten: one-page.pdf (pixel rebuild)"
docker run --rm \
  --user 0:0 \
  --network none \
  --cap-drop ALL \
  --entrypoint sh \
  -v "$WORK/one-page.pdf:/input/target.pdf:ro" \
  "$IMAGE" \
  -c '/usr/local/bin/airlock-flatten-pdf /input/target.pdf /tmp/flattened-one-page.pdf && cat /tmp/flattened-one-page.pdf' \
  >"$WORK/flattened-one-page.pdf"

if grep -qi javascript "$WORK/flattened-one-page.pdf"; then
  echo "✗ Flattened PDF still contains JavaScript marker string"
  exit 1
fi
echo "✓ Flattened PDF fixture has no /JavaScript byte marker"

echo "Plain text: one-page.pdf (pdftotext in-container)"
docker run --rm --network none --cap-drop ALL --user 0:0 --entrypoint sh \
  -v "$WORK/one-page.pdf:/input/target.pdf:ro" \
  "$IMAGE" \
  -c '/usr/local/bin/airlock-extract-plaintext /input/target.pdf /tmp/plain.txt && cat /tmp/plain.txt' \
  >"$WORK/benign-plain.txt"
if [ ! -s "$WORK/benign-plain.txt" ]; then
  echo "✗ Plain-text extract produced empty output"
  exit 1
fi
echo "✓ Plain-text extract smoke passed"
