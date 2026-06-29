# Airlock 🔒

Local-first, disposable sandboxed workspace. Electron + Docker + KasmVNC.

Drop a file in. It opens in an isolated container. The container dies when you're done. Nothing persists. Nothing escapes.

Airlock is a hard fork of the OpenClaw monorepo architecture, entirely gutted of its AI/LLM components and rebuilt as a strict, deterministic, security-first local execution bus.

**Current version:** `0.3.1`

---

## What It Does

You drag a file — a PDF, a `.docx`, an HTML attachment, a suspicious installer — onto Airlock. It spins up an ephemeral Docker container with a minimal headless desktop (KasmVNC), opens the file inside it using an appropriate sandboxed application (Chromium, Evince, LibreOffice), and streams the visual output back to your screen via a WebSocket VNC feed.

When you close the session, the container is forcibly killed and removed. No trace. No persistence. No network by default.

You can also open URLs in a sandboxed Chromium instance when network access is explicitly enabled for that session.

After a session ends, Airlock can run a lightweight deterministic analysis over captured session artefacts (logs, metadata) and surface a risk summary in the UI.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│                  Electron Shell                  │
│         packages/ui  (React + KasmVNC viewer)    │
│                                                  │
│  [ Drag & Drop Zone ]   [ VNC Canvas Stream ]    │
└────────────────────┬────────────────────────────┘
                     │ IPC
┌────────────────────▼────────────────────────────┐
│              Core Orchestrator                   │
│         packages/core  (Node.js + dockerode)     │
│                                                  │
│  [ Session lifecycle ]  [ Artefact capture ]     │
│  [ Drop validation ]    [ GC / crash traps ]     │
└────────────────────┬────────────────────────────┘
                     │ Docker socket
┌────────────────────▼────────────────────────────┐
│             Sandbox Environment                  │
│      packages/sandbox  (Docker + KasmVNC)        │
│                                                  │
│  [ Headless X11 ]  [ KasmVNC stream :6901 ]      │
│  [ Chromium / Evince / LibreOffice ]             │
│  [ Air-gapped by default ] [ Read-only mounts ]  │
└─────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
airlock/
├── packages/
│   ├── ui/                 # Electron + React frontend
│   │   └── src/
│   │       ├── main/       # Electron main process, IPC, readiness checks
│   │       ├── preload/    # contextBridge API
│   │       └── renderer/   # React UI, drag-drop, VNC viewer
│   │
│   ├── core/               # Node.js orchestrator
│   │   └── src/
│   │       ├── docker/     # ContainerManager, seccomp, network, image probe
│   │       ├── session/    # execute/destroy session, artefacts, logging
│   │       ├── analysis/   # Lightweight post-session analysis
│   │       └── validation/ # Drop validation + MIME sniff
│   │
│   └── sandbox/            # Docker image definition
│       ├── Dockerfile
│       └── entrypoint.sh
│
├── scripts/                # Smoke tests and core resolution helpers
├── package.json
└── README.md
```

---

## Core Principles

### 1. Ephemeral by Default
Every container is created fresh and destroyed on session end. No volumes persist between sessions. No state is written to the host outside of explicitly opted-in export paths.

### 2. Air-Gapped by Default
File sessions attach to an internal Docker bridge (`airlock-isolated`) with no external egress. Network access is a deliberate, per-session opt-in.

### 3. Violent Garbage Collection
If the Electron main process crashes, exits, or is force-quit, crash traps issue `docker kill` + `docker rm` against all containers spawned in that session.

### 4. Read-Only File Mounts
Dropped files are mounted into the container as `:ro`. The sandbox can render the file but cannot modify it or write derivatives back to the host without an explicit export action.

### 5. Minimal Attack Surface
Capabilities are dropped (`--cap-drop ALL`). A custom seccomp profile is applied. No privilege escalation. No host PID or network namespace sharing.

---

## Security Hardening Profile

| Control | Value |
|---|---|
| Network | Internal bridge (`airlock-isolated`) for file sessions; bridge egress only when opted in |
| Capabilities | All dropped (`--cap-drop ALL`) |
| Seccomp | Custom profile (Dangerzone-derived) |
| AppArmor | Planned — not fully enforced yet |
| Mount | `:ro` read-only for input files |
| Privilege | No new privileges (`--security-opt no-new-privileges`) |
| PID namespace | Host isolated |
| User | Non-root inside container |
| Drop validation | Magic-byte MIME sniff; extension spoofing rejected before session start |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron |
| UI Framework | React + TypeScript + Tailwind |
| Orchestrator | Node.js + dockerode |
| Container Runtime | Docker (local daemon) |
| Remote Desktop | KasmVNC |
| Display Server | Xvfb (headless X11) |
| Package Manager | pnpm workspaces |
| Build | TypeScript + Vite |

---

## Prerequisites

- **Docker Desktop** (macOS/Windows) or **Docker Engine** (Linux) — running before you start a session
- **Node.js** >= 20
- **pnpm** >= 9

---

## First-Run Setup

Airlock requires **Docker Desktop** (or Docker Engine on Linux). The sandbox image is provisioned automatically when possible:

1. **GHCR pull** — `ghcr.io/lukeholmes/airlock-sandbox:<version>` (after first release tag is published)
2. **Bundled build fallback** — packaged apps include the sandbox Dockerfile in `resources/sandbox/`
3. **Manual dev build** — `pnpm sandbox:build` for local development

On first launch, use **Re-check** in the app or call setup via the `ENSURE_SANDBOX_IMAGE` IPC path. Auto-setup on startup (progress UI) is planned for v0.4.

### Developers

```bash
pnpm install
pnpm build
pnpm sandbox:build    # or rely on ENSURE_SANDBOX_IMAGE / GHCR pull
pnpm dev              # HMR dev workflow
```

---

## Common Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev workflow — Vite HMR, `tsc` watch, electronmon |
| `pnpm build` | Build core + UI |
| `pnpm package` | Build desktop installer (DMG / NSIS / AppImage) via electron-builder |
| `pnpm sandbox:build` | Build `airlock/sandbox:latest` Docker image |
| `pnpm sandbox:smoke` | Smoke-test the sandbox image |
| `pnpm core:smoke` | Integration smoke test via ContainerManager (requires sandbox image) |
| `pnpm test` | Core unit tests (`validateDrop`, etc.) |
| `pnpm typecheck` | TypeScript check across packages |
| `pnpm lint` | ESLint |

---

## Usage

### File sessions (default)
1. Drop a file onto the window (or use **File → Open**).
2. Airlock validates the file (size, MIME sniff, extension consistency) before starting a container.
3. The file is mounted read-only and opened in Evince, Chromium, or another sandboxed viewer.
4. Click **Destroy workspace** when finished.

### URL sessions (network required)
1. Enable the **Network** toggle in the UI.
2. Enter an `http://` or `https://` URL and submit.
3. The container runs with bridge network access so Chromium can reach the URL.

### Post-session analysis
After destroying a workspace, click **Analyze session** to run the lightweight deterministic analysis engine over captured session logs and metadata.

---

## Status (v0.3.1+)

> Core sandbox loop works end-to-end. Packaging and zero-config infrastructure landed; polish and v0.4 features in progress.

**Working today**

- [x] Monorepo scaffold (`core`, `ui`, `sandbox`)
- [x] dockerode container lifecycle + seccomp hardening
- [x] Sandbox Dockerfile (KasmVNC + headless desktop)
- [x] Electron drag-and-drop + KasmVNC renderer
- [x] Garbage collection & crash trap hooks
- [x] Air-gapped network mode (default) + per-session network toggle
- [x] URL session support (network opt-in)
- [x] Session artefact capture + lightweight analysis (in-memory)
- [x] Desktop packaging (`pnpm package`) + bundled sandbox build context
- [x] Fast dev workflow (`pnpm dev`)
- [x] First-run readiness checks (Docker + sandbox image)
- [x] Drop validation with MIME sniff
- [x] Sandbox image resolution (`ensureSandboxImageReady` — pull / build)
- [x] GHCR publish workflow (on `v*` tags)

**In progress / v0.4**

- [ ] Auto-setup UX on first launch (progress UI)
- [ ] App icon for installers
- [ ] End-user setup docs (`docs/`)
- [ ] Persistent artefact storage + export

**Still open**

- [ ] AppArmor enforcement
- [ ] Code signing / notarization
- [ ] MIME sniffing via dedicated library

---

## Reference Architecture Sources

Airlock's design draws from four open-source reference implementations:

- **OpenClaw** — Electron shell and IPC patterns (AI components removed)
- **KasmVNC** — Containerised headless X11 + VNC stream pipeline
- **Dockerode** — Node.js Docker daemon bindings and container lifecycle patterns
- **Dangerzone** — Container security hardening profiles, seccomp policies, and isolation primitives

---

## Licence

MIT
