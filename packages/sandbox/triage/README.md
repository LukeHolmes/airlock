# In-container static triage (M1)

Offline tools baked into `airlock/sandbox` at **build time** (no runtime network):

| Tool | Role |
|------|------|
| ExifTool | Metadata JSON |
| `airlock-pdf-probe.py` | PDF `/JavaScript`, `/Launch`, `/OpenAction`, embeds |
| `airlock-office-probe.py` | oletools (`oleid`, `olevba`) for macros |
| YARA | Vendored `yara/airlock_rules.yar` (~30 rules, Airlock-authored) |
| `airlock-triage` | Orchestrator; writes `/tmp/airlock-triage.json` |
| `airlock-xray-probe.py` | Hidden text, QR (`zbar` + `imagemagick` for PNG decode), URL heuristics (no fetch) |

Schema **v2** adds optional `xray` while keeping v1 fields.

### X-ray false-positive notes

| Detector | Known benign noise |
|----------|---------------------|
| White-on-white | PDF producers using white fill for layout |
| Tiny font | Legal footnotes / watermarks |
| Punycode | Legitimate IDN domains (`xn--`) |
| URL shorteners | Marketing PDFs with `bit.ly` tracking links |

Host-side `@airlock/core` normalises raw JSON, derives deterministic risk level, and serves the nutrition-label panel.

## Failure modes

| Symptom | Behaviour |
|---------|-----------|
| Triage still running | UI shows spinner; host polls up to **120s** |
| Timeout | `TRIAGE_FAILED` log; panel shows error; session/VNC continue |
| Missing tool in image | Raw JSON `errors[]`; partial findings where tools succeeded |
| URL sessions | No in-container file triage (file mounts only) |
