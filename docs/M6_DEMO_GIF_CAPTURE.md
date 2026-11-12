# M6 demo GIF capture checklist (Luke — real host)

Record a short **non-destructive** walkthrough for release notes. No cloud agent screenshots; run locally on a GPU/display-capable machine.

## Prerequisites

- Packaged Airlock build or `pnpm electron:dev` with sandbox image ready (`airlock/sandbox:latest`).
- Docker / compatible engine running.
- Screen recorder (Peek, ScreenToGif, OBS, etc.) at ~1280×720, 15–20 fps.

## Script (≈60–90 s)

1. Launch Airlock; show idle **Drop a file** screen (no “safe” wording).
2. Drop **`fixtures/m6-trick-kit/02-eicar.txt`** — open Nutrition Label; point at YARA / indicators (not “safe”).
3. Drop **`fixtures/m6-trick-kit/03-pdf-javascript-openaction.pdf`** — show PDF / YARA rows.
4. Drop **`fixtures/m6-trick-kit/06-qr-shortener.png`** — show QR + URL flags in X-ray.
5. Drop **`fixtures/m6-trick-kit/11-extension-spoof.pdf-as-txt.txt`** — show extension mismatch.
6. End on destroyed session / empty drop zone.

## Capture helper

```bash
# From repo root — optional timer cues only (does not record).
bash scripts/capture-m6-demo-gif.sh
```

Save output as `docs/assets/airlock-m6-demo.gif` (git-ignored or attached to release notes manually).

## Post-check

- [ ] No network-enabled URL session unless you intend to show URL mode.
- [ ] No real malware; only `fixtures/m6-trick-kit/*`.
- [ ] Caption: static checks only; isolation is the protection.
