# Airlock v0.4.0

Portable, disposable sandboxes for opening untrusted files and URLs. This release hardens first-run setup, fixes production UI styling, and documents a clean-machine validation path on Linux.

Installers are **unsigned**. Docker (Desktop or Engine) is required for sessions.

## Highlights

### Session export (JSON)

After you destroy a workspace, use **Analyze Session** and **Export session** to save a versioned JSON document with session metadata, artefact paths, and deterministic analysis output from `@airlock/core`.

### First-run sandbox setup

On first launch, a full-screen progress overlay walks through: check Docker → pull or build `airlock/sandbox` → ready. Live setup log lines stream from Docker/build output; **Retry** and setup-guide links are available if something fails.

### KasmVNC on air-gapped containers

Sandbox image KasmVNC config sets `network.udp.publicIP` to `127.0.0.1` so the web client answers on the published localhost port under Airlock’s isolated (no egress) container profile.

### Production UI styling

The renderer now imports Tailwind/CSS in the production bundle (`import './index.css'`). Packaged Electron builds load compiled styles; dev-only Vite mode is no longer required for a styled UI.

### Reliability fixes

- **False “Start Docker Desktop” banner:** CLI/second-instance file opens before readiness finished could show a Docker error when Docker was fine. Sessions now refresh readiness, queue opens until setup completes, and main waits before delivering CLI paths.
- **Node 24 session crash:** VNC readiness probes use `node:http` instead of `fetch`/undici to avoid main-process crashes during container start.
- **Active session layout:** The sealed workspace panel stretches under the header instead of collapsing to a thin strip when the VNC iframe has no intrinsic height.

### Documentation & demo assets

- [`docs/CLEAN_MACHINE_TEST.md`](CLEAN_MACHINE_TEST.md) — fresh VM steps, timings, and pass/fail checklist.
- README screenshots/GIF for first-run, idle, and post-destroy/analyze states (active desktop capture deferred until a GPU host is available).

## Install

### Linux (AppImage)

```bash
chmod +x Airlock-*.AppImage
./Airlock-*.AppImage
```

### macOS (DMG, best-effort)

Gatekeeper blocks unsigned apps. Right-click **Airlock** in Applications → **Open** → **Open**, or:

```bash
xattr -dr com.apple.quarantine /Applications/Airlock.app
```

### Windows (NSIS, best-effort)

SmartScreen may show “Windows protected your PC”. Choose **More info** → **Run anyway**.

## Sandbox image (GHCR)

Published as:

```text
ghcr.io/lukeholmes/airlock-sandbox:0.4.0
ghcr.io/lukeholmes/airlock-sandbox:latest
```

First-run can still pull or build from bundled files if the registry is unreachable. See [`docs/getting-started.md`](getting-started.md) for setup.

## Known limitations

- **Unsigned desktop binaries** — macOS/Windows require the steps above for first launch.
- **Orphan containers** — If Electron exits abruptly mid-session, a running `airlock-*` container may remain until you destroy it from the UI or `docker rm`. Quit via **Destroy workspace** when possible.
- **Headless VNC capture** — Portfolio/desktop GIFs of live KasmVNC need a machine with a working GPU stack; xvfb-only hosts show an empty iframe.
- **Multi-arch sandbox image** — Publish pipelines must build arm64 with the correct `TARGETARCH` (and preferably a native arm64 runner); QEMU cross-build with a pinned `amd64` arg installs the wrong KasmVNC APK.

## Validation

On a clean Linux host with Docker:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @airlock/core build
pnpm airlock:test    # core harness
pnpm ci:lint
```

See [`docs/CLEAN_MACHINE_TEST.md`](CLEAN_MACHINE_TEST.md) for the full clean-machine procedure.
