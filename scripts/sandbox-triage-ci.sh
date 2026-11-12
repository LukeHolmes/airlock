#!/usr/bin/env bash
# Offline static triage smoke (CI) — runs inside built sandbox image, no network.
set -euo pipefail

IMAGE="${1:-airlock/sandbox:test}"
FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

run_triage() {
  local name="$1"
  local host_path="$2"
  echo "Triage: $name"
  docker run --rm \
    --network none \
    --cap-drop ALL \
    --entrypoint /usr/local/bin/airlock-triage \
    -v "$host_path:/input/target:ro" \
    "$IMAGE" \
    /input/target >"$FIXTURE_DIR/out-${name}.json"
}

# Benign minimal PDF
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj trailer<</Root 1 0 R>>\n' \
  >"$FIXTURE_DIR/benign.pdf"

# EICAR-style test string (harmless)
printf 'X5O!P%%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n' \
  >"$FIXTURE_DIR/eicar.txt"

# PDF with /JavaScript marker (benign decoy content)
printf '%%PDF-1.4\n/JavaScript /OpenAction test\n' >"$FIXTURE_DIR/js-marker.pdf"

# Invisible Unicode (prompt-injection style)
python3 -c "open('$FIXTURE_DIR/hidden.txt','w',encoding='utf-8').write('visible\u200bhidden')"

# Display vs href mismatch
printf '%s\n' '<a href="http://paypa1-verify.example/login">PayPal Security</a>' >"$FIXTURE_DIR/mismatch.html"

# QR PNG with shortener payload (assembled at test time from pinned base64; decode only, no fetch)
QR_B64="$(cat "$(dirname "$0")/fixtures/qr-bitly.b64")"
python3 -c "import base64,pathlib,sys; pathlib.Path(sys.argv[1]).write_bytes(base64.b64decode(sys.argv[2]))" \
  "$FIXTURE_DIR/qr.png" "$QR_B64"

python3 "$(dirname "$0")/generate-macro-docm.py" "$FIXTURE_DIR/harmless.docm"

for f in benign.pdf eicar.txt js-marker.pdf hidden.txt mismatch.html qr.png harmless.docm; do
  run_triage "$f" "$FIXTURE_DIR/$f"
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d.get('version',1)>=1; print('ok', sys.argv[2], 'xray' if d.get('xray') else '-', len(d.get('yara',[])), 'yara')" \
    "$FIXTURE_DIR/out-${f}.json" "$f"
done

export FIXTURE_DIR
python3 <<'PY'
import json
import os
import pathlib

fix = pathlib.Path(os.environ["FIXTURE_DIR"])

d = json.load(open(fix / "out-eicar.txt.json"))
rules = {h["rule"] for h in d.get("yara", [])}
assert "airlock_eicar_test_string" in rules, rules

d2 = json.load(open(fix / "out-js-marker.pdf.json"))
js = bool(d2.get("pdf", {}).get("javascript"))
yara_js = any("javascript" in h.get("rule", "").lower() for h in d2.get("yara", []))
assert js or yara_js, d2

hidden = json.load(open(fix / "out-hidden.txt.json"))
assert (hidden.get("xray") or {}).get("invisible_unicode"), hidden

mismatch = json.load(open(fix / "out-mismatch.html.json"))
urls = (mismatch.get("xray") or {}).get("urls") or []
assert any("href_display_mismatch" in u.get("flags", []) for u in urls), mismatch

qr = json.load(open(fix / "out-qr.png.json"))
assert (qr.get("xray") or {}).get("qr_codes"), qr

macro = json.load(open(fix / "out-harmless.docm.json"))
office = macro.get("office") or {}
assert office.get("macros") or office.get("auto_exec") or any(
    "auto" in h.get("rule", "").lower() for h in macro.get("yara", [])
), macro

print("✓ Triage + X-ray fixture expectations met")
PY

echo "Preparing one-page PDF for flatten smoke"
python3 - "$FIXTURE_DIR/one.png" <<'PY'
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
chmod -R a+rw "$FIXTURE_DIR"
docker run --rm --user 0:0 --entrypoint img2pdf \
  -v "$FIXTURE_DIR:/work:rw" \
  "$IMAGE" \
  /work/one.png -o /work/one-page.pdf

echo "Flatten: one-page.pdf (pixel rebuild)"
docker run --rm \
  --user 0:0 \
  --network none \
  --cap-drop ALL \
  --entrypoint sh \
  -v "$FIXTURE_DIR/one-page.pdf:/input/target.pdf:ro" \
  "$IMAGE" \
  -c '/usr/local/bin/airlock-flatten-pdf /input/target.pdf /tmp/flattened-one-page.pdf && cat /tmp/flattened-one-page.pdf' \
  >"$FIXTURE_DIR/flattened-one-page.pdf"

if grep -qi javascript "$FIXTURE_DIR/flattened-one-page.pdf"; then
  echo "✗ Flattened PDF still contains JavaScript marker string"
  exit 1
fi
echo "✓ Flattened PDF fixture has no /JavaScript byte marker"
