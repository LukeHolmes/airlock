# M6 — Benign trick-file test kit

Harmless, **deterministic** files under `fixtures/m6-trick-kit/` exercise static triage and X-ray probes. Nothing is downloaded at test time; binaries are generated in-repo via `scripts/generate-m6-trick-kit.py` (optional `qrencode` + `exiftool` on the host improve QR/EXIF fixtures).

CI runs them through `scripts/sandbox-triage-ci.sh` and validates JSON with `scripts/assert-m6-trick-kit.py` against `fixtures/m6-trick-kit/manifest.json`.

**UI rule:** Nutrition labels use **“No known risk indicators found (static checks)”** — never “safe”.

## Fixture → expected nutrition-label signal

| File | Detection exercised | Expected signal (deterministic) |
|------|---------------------|--------------------------------|
| `01-benign-minimal.pdf` | Control | No EICAR YARA hit |
| `02-eicar.txt` | EICAR string | YARA `airlock_eicar_test_string` |
| `03-pdf-javascript-openaction.pdf` | PDF active content markers | PDF probe JS/OpenAction and/or PDF YARA rules |
| `04-invisible-unicode.txt` | Zero-width Unicode | X-ray `invisible_unicode` |
| `05-href-mismatch.html` | Phishing-style link text | URL flag `href_display_mismatch` |
| `06-qr-shortener.png` | QR + shortener | QR decode + `url_shortener` |
| `07-qr-ip-literal.png` | QR + IP literal | QR decode + `ip_literal` |
| `08-qr-punycode.png` | QR + punycode IDN | QR decode + `punycode` |
| `09-macro-harmless.docm` | Macro / AutoOpen | Office macro hints and/or macro YARA |
| `10-white-text.pdf` | Hidden PDF text heuristic | X-ray `white_on_white` |
| `11-extension-spoof.pdf-as-txt.txt` | Extension vs magic | Extension mismatch (PDF bytes, `.txt` name) |
| `12-polyglot-pdf-pe.txt` | Embedded PE marker | YARA `airlock_embedded_pe` |
| `13-exif-metadata.jpg` | Image metadata | `image/*` MIME + XMP URL hints in X-ray (EXIF when `exiftool` is on PATH in image) |
| `14-office-hidden.docx` | Office hidden text | X-ray `vanish` / `white_on_white` / `tiny_font` |

Regenerate fixtures:

```bash
python3 scripts/generate-m6-trick-kit.py
```

## Demo GIF (human capture only)

Airlock does **not** ship a fabricated demo GIF. Use `docs/M6_DEMO_GIF_CAPTURE.md` on a machine with a real display and Docker.
