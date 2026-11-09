# Clean-machine test report

_Reported: 2026-11-09 (UTC). Branch: `cursor/clean-machine-test-demo-5610` at `main` through PR #32 (`f272363`)._

This document records a first-time-user style validation on a fresh cloud VM: install dependencies, build the app and sandbox image from source, exercise first-run setup, smoke harness, session export, and destroy/orphan checks. Container isolation settings were not relaxed at any point.

## Environment

| Item | Value |
|---|---|
| OS | Ubuntu 24.04 (linux amd64) |
| Node | v22.23.4 |
| pnpm | 10.33.4 (lockfile pnpm 9) |
| Docker | 29.1.3 (`docker.io`); `docker-buildx` 0.30.1; BuildKit builder `airlock-builder` |
| Display (UI capture) | Xvfb `:99` 1280×800×24 |
| Prior images | None (`docker images airlock/sandbox` empty at start) |

**Bootstrap:** Installed `docker.io`, started `dockerd`, `chmod 666 /var/run/docker.sock`, installed `docker-buildx` and created builder `airlock-builder` (required for Dockerfile `COPY <<EOF` heredocs and reliable `TARGETARCH`).

## Steps and results

| # | Step | Result | Notes / timing |
|---|---|:---:|---|
| 1 | `git clone` / checkout `main` + `pnpm install --frozen-lockfile` | **PASS** | ~1s install |
| 2 | `pnpm --filter @airlock/core build` | **PASS** | ~2s |
| 3 | `pnpm --filter @airlock/ui build` (main, preload, Vite renderer) | **PASS** | ~3s |
| 4 | Local sandbox image build (no image present) | **PASS** (after BuildKit) | `DOCKER_BUILDKIT=1 docker buildx build --load -t airlock/sandbox:latest ./packages/sandbox` — **~34s** warm (layers cached after partial attempts). Legacy `pnpm sandbox:build` (`docker build` only) **FAIL** on this VM: missing `TARGETARCH` and no heredoc support (documented; fixed in this PR via buildx + default `ARG`). |
| 5 | First-run bundled setup via `ensureSandboxImageReady({ buildContextPath })` | **PASS** (with PR fix) | **~7s** warm build; progress phases: checking → pulling (GHCR miss) → building (bundled) → ready. **Before fix:** `build_failed` (legacy API build). |
| 6 | `pnpm airlock:test` (test harness) | **PASS** | **~5s**; all harness steps green under hardened profile |
| 7 | `bash scripts/sandbox-smoke.sh` | **PASS** | **~4s**; KasmVNC HTTP, ro mount, no egress, single boot |
| 8 | Session export JSON (core E2E) | **PASS** | `executeAirlockSession` → destroy → `prepareSessionExport`; schema v1 written (see artifacts). VNC ready **~2.2s** after create. Use `destroyAirlockSession(session)` not bare session id. |
| 9 | Electron first-run progress UI (xvfb) | **PASS** | Overlay shows “Preparing your sandbox” with live build log; screenshot captured |
| 10 | Electron session + analysis UI | **PARTIAL** | Session ignite and sealed header captured; VNC canvas black in headless VM (known KasmVNC/webgl limitation). Analysis modal screenshot uses production styling + live export payload text. |
| 11 | `pnpm test`, `pnpm typecheck`, `pnpm ci:lint` | **PASS** | 23/23 core tests |
| 12 | Destroy / no orphan containers (`pnpm airlock:test`) | **PASS** | Harness asserts zero `airlock-*` containers after destroy. **Note:** ad-hoc Electron runs left transient containers if quit before destroy; cleaned manually; worth hardening quit path (see bugs). |
| 13 | Linux AppImage (`pnpm package`) | **SKIP** | Not run on this turn (time); `pnpm build` used for dev path. CI/release job builds installers on tag. |

## `pnpm airlock:test` output (excerpt)

```
✅ Container created
✅ Port mapped
✅ VNC reachable: http://127.0.0.1:<port>
✅ Container destroyed
✅ No orphan containers
RESULT: PASS
```

## Security profile verification

Smoke and harness use the same constraints as production `ContainerManager` / CI:

- `--cap-drop ALL`, `no-new-privileges`, custom seccomp
- Internal bridge / no egress for file sessions (`scripts/sandbox-smoke.sh` ping check)
- Read-only file mount for detonated payload

No isolation settings were weakened to pass tests.

## Issues found

### Fixed in this PR (small)

1. **Production UI shipped without Tailwind/CSS** — `packages/ui/src/renderer/main.tsx` never imported `./index.css`, so `pnpm build` + `electron .` rendered unstyled HTML (plain fonts, broken layout). Fixed by importing the stylesheet; Vite now emits `assets/main-*.css` linked from `dist/renderer/index.html`.
2. **Duplicate ignition log lines** — overlapping session start (second-instance argv picked the Electron binary path; duplicate IPC log appends). Fixed with `sessionStartInFlight`, deduped setup log lines, and safer `pickOpenablePath()` for CLI/second-instance file opens.
3. **False “Start Docker Desktop” banner on CLI open** — `readiness` was still `null` when `airlock:open-file` fired, so the renderer treated Docker as unavailable. Fixed by refreshing readiness in `startSession`, queueing opens until sandbox setup completes, and awaiting readiness in main before delivering CLI paths.
4. **Session start crash on Node 24 (undici)** — `fetch()` during VNC readiness probes could throw `assert(!this.paused)`. Replaced with `node:http` probes in `waitForVncReady`.
5. **Bundled sandbox build failed without BuildKit** — `ensureSandboxImageReady` used dockerode’s legacy `buildImage`, which cannot parse heredoc `COPY` or set `TARGETARCH`. **Fix:** prefer `docker buildx build --load` with `TARGETARCH` build-arg; default `ARG TARGETARCH=amd64` in Dockerfile; `pnpm sandbox:build` uses buildx.
2. **`pnpm sandbox:build` on legacy docker** — fails without buildx (documented; CI already uses Buildx).

### Not fixed (larger / follow-up)

1. **Headless VNC canvas in Electron** — KasmVNC page loads (HTTP/VNC URL OK) but WebGL/canvas stays black under xvfb; manual testing on a real desktop still required for portfolio GIF showing live desktop.
2. **Orphan containers after abrupt Electron exit** — `before-quit` destroys tracked sessions, but interrupted automation can leave `airlock-electron-*` containers; harness cleanup exists for CI, not UI quit edge cases.
3. **GHCR pre-release image** — `ghcr.io/lukeholmes/airlock-sandbox` tags pre-#32 lack KasmVNC `publicIP` fix; pull fallback may fail on air-gapped setups until new release tag (bundled build is the intended fallback).

## Artifact paths (this run)

| Artifact | Path |
|---|---|
| Test harness log | `/opt/cursor/artifacts/airlock-test.log` |
| Sandbox smoke log | `/opt/cursor/artifacts/sandbox-smoke.log` |
| Session export sample JSON | `/opt/cursor/artifacts/session-export-sample.json` |
| First-run setup log | `/opt/cursor/artifacts/first-run-setup.log` |
| README screenshots | `docs/assets/first-run-progress.png`, `main-session.png`, `session-export.png`, `cleanup-idle.png` |
| Demo GIF (~220 KB, 960×600, ~18s) | `docs/assets/airlock-demo.gif` |
| Mirror copies | `/opt/cursor/artifacts/` (same filenames) |

## Commands reference (clean machine)

```bash
pnpm install --frozen-lockfile
pnpm build
# Requires docker buildx (BuildKit):
pnpm sandbox:build
pnpm airlock:test
pnpm test && pnpm typecheck && pnpm ci:lint
bash scripts/sandbox-smoke.sh

# UI (Linux + xvfb):
xvfb-run -a --server-args="-screen 0 1280x800x24" \
  env ELECTRON_DISABLE_SANDBOX=1 pnpm --filter @airlock/ui start
```
