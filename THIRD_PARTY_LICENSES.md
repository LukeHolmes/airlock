# Third-party components

Airlock (this repository) is licensed under **Apache-2.0** (see [LICENSE](LICENSE)).
This file lists notable third-party software **bundled with the desktop app**, **linked at build time**,
or **installed inside the sandbox image** (`packages/sandbox/Dockerfile`).

## Desktop / Node (Electron app)

| Component | Where used | License | Notes |
|-----------|------------|---------|-------|
| Electron | `@airlock/ui` packaged app | MIT | Runtime shell; see electron/electron `LICENSE`. |
| React / react-dom | UI renderer | MIT | |
| Dockerode | `@airlock/core` | Apache-2.0 | Docker Engine API client. |
| `ws` | `@airlock/core` | MIT | WebSocket client (VNC proxy path). |
| framer-motion, lucide-react, tailwindcss, vite, typescript, vitest, etc. | UI dev/build | Per-package (mostly MIT) | See root `pnpm-lock.yaml` and each package's `LICENSE`; not all reproduced here. |

## Sandbox image (Alpine 3.21)

Components are installed via `apk` / `pip` in `packages/sandbox/Dockerfile` unless noted.

| Component | License (expected) | Notes |
|-----------|-------------------|-------|
| Alpine Linux base | Mixed GPL/LGPL/MIT (per package) | **Unverified per-binary** in this doc; see Alpine package indexes. |
| KasmVNC server (v1.4.1, pinned commit) | **GPL-2.0** (Kasm) | Runs **inside the sandbox image only**; separate from the Electron app (copyleft scoped to container). |
| Xvfb, Openbox, supervisord, Chromium, NSS stack | Mixed OSS | Chromium: BSD/LGPL/MPL (Google); see Chromium credits. |
| Evince, poppler-utils | GPL-2.0+ / GPL-3.0+ | Document viewer and PDF utilities. |
| LibreOffice (writer/calc/impress) | MPL-2.0 (with LGPL/GPL components) | |
| perl-image-exiftool (ExifTool) | GPL-1.0+ or Artistic-2.0 | |
| yara | BSD-3-Clause (upstream YARA) | |
| zbar | LGPL-2.1 | |
| ImageMagick | Apache-2.0 | |
| python3, jq, curl, fonts, X11 libs | Mixed | Standard Alpine build deps. |
| oletools 0.60.2 (pip) | BSD-2-Clause | Office macro analysis. |
| img2pdf 0.5.1 (pip) | LGPL-3.0 | PDF flatten pipeline. |

## Airlock-authored image content

| Artifact | License | Notes |
|----------|---------|-------|
| `triage/yara/airlock_rules.yar` | Airlock project (MIT-style header in file) | Vendored YARA rules; not third-party rule packs. |
| `triage/airlock-*` scripts | Apache-2.0 (same as repo) | Shell/Python triage helpers. |
| Chromium policy `airlock.json` | Apache-2.0 | Managed policies only. |

## Seccomp profile

| Source | License | Notes |
|--------|---------|-------|
| Moby `profiles/seccomp/default.json` v27.4.0 | Apache-2.0 | Upstream basis; vendored as `packages/core/src/docker/seccomp/moby-default.v27.4.0.json`. |
| `airlock.profile.json` | Apache-2.0 | Airlock-hardened effective profile (`packages/core/src/docker/seccomp/PROFILE.md`). |

## Design credit (no bundled code)

See README for the design-credit line (no corresponding third-party source bundle).

## Could not fully confirm here

- **Per-package Alpine `.apk` license metadata** for every transitive runtime library in the image (recommend `apk info -e -d` inside a built image for audit).
- **KasmVNC `.apk` license file** text at the pinned S3 artifact (project states GPL-2.0; artifact not re-read in CI).
- **Exact LibreOffice/Chromium SPDX** for the Alpine 3.21 builds without inspecting installed `/usr/share/licenses` in the image.
