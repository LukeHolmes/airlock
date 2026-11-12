#!/usr/bin/env bash
# Offline static triage smoke (CI) — runs inside built sandbox image, no network.
set -euo pipefail

IMAGE="${1:-airlock/sandbox:test}"
FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

# Benign minimal PDF
printf '%%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj trailer<</Root 1 0 R>>\n' \
  >"$FIXTURE_DIR/benign.pdf"

# EICAR-style test string (harmless)
printf 'X5O!P%%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*\n' \
  >"$FIXTURE_DIR/eicar.txt"

# PDF with /JavaScript marker (benign decoy content)
printf '%%PDF-1.4\n/JavaScript /OpenAction test\n' >"$FIXTURE_DIR/js-marker.pdf"

for f in benign.pdf eicar.txt js-marker.pdf; do
  echo "Triage: $f"
  docker run --rm \
    --network none \
    --cap-drop ALL \
    --entrypoint /usr/local/bin/airlock-triage \
    -v "$FIXTURE_DIR/$f:/input/target:ro" \
    "$IMAGE" \
    /input/target >"$FIXTURE_DIR/out-$f.json"
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d.get('version')==1; print('ok', len(d.get('yara',[])), 'yara hits')" \
    "$FIXTURE_DIR/out-$f.json"
done

export FIXTURE_DIR
python3 <<'PY'
import json, pathlib, os
fix = pathlib.Path(os.environ["FIXTURE_DIR"])
d = json.load(open(fix / "out-eicar.txt.json"))
rules = {h["rule"] for h in d.get("yara", [])}
assert "airlock_eicar_test_string" in rules, rules
d2 = json.load(open(fix / "out-js-marker.pdf.json"))
js = bool(d2.get("pdf", {}).get("javascript"))
yara_js = any("javascript" in h.get("rule", "").lower() for h in d2.get("yara", []))
assert js or yara_js, d2
print("✓ Triage fixture expectations met")
PY
