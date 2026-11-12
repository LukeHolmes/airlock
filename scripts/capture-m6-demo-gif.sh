#!/usr/bin/env bash
# Printed checklist for manual demo GIF capture (no recording performed).
set -euo pipefail

cat <<'EOF'
M6 demo GIF — manual capture only
=================================
1. Start Airlock + Docker; confirm sandbox image.
2. Record screen (Peek/OBS/ScreenToGif).
3. Drop fixtures/m6-trick-kit/02-eicar.txt → show Nutrition Label indicators.
4. Drop 03-pdf-javascript-openaction.pdf → PDF/YARA rows.
5. Drop 06-qr-shortener.png → QR + URL flags.
6. Drop 11-extension-spoof.pdf-as-txt.txt → extension mismatch.
7. Stop recording; save as docs/assets/airlock-m6-demo.gif for release notes.

See docs/M6_DEMO_GIF_CAPTURE.md for full checklist.
EOF
