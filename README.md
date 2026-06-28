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

Airlock is **not zero-config yet**. Before your first session you need Docker running and the sandbox image built locally.

### 1. Install dependencies

```bash
pnpm install
```

### 2. Build the app

```bash
pnpm build
```

### 3. Build the sandbox image (required)

```bash
pnpm sandbox:build
```

This produces `airlock/sandbox:latest`. Airlock checks for this image at startup and blocks session creation until it exists. The in-app setup modal shows these commands if the image is missing.

Verify:

```bash
docker images airlock/sandbox:latest
```

### 4. Run Airlock

**Development (HMR + hot reload):**

```bash
pnpm dev
```

**Production-style run:**

```bash
cd packages/ui && pnpm start
```

Drop a PDF onto the window to open it in an isolated container. Click **Destroy workspace** when done.

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

## Status (v0.3.1)

> Functional for local development and manual testing. Not yet a polished end-user product.

**Working today**

- [x] Monorepo scaffold (`core`, `ui`, `sandbox`)
- [x] dockerode container lifecycle + seccomp hardening
- [x] Sandbox Dockerfile (KasmVNC + headless desktop)
- [x] Electron drag-and-drop + KasmVNC renderer
- [x] Garbage collection & crash trap hooks
- [x] Air-gapped network mode (default) + per-session network toggle
- [x] URL session support (network opt-in)
- [x] Session artefact capture + lightweight analysis
- [x] Desktop packaging (`pnpm package`)
- [x] Fast dev workflow (`pnpm dev`)
- [x] First-run readiness checks (Docker + sandbox image)
- [x] Drop validation with MIME sniff

**Still open**

- [ ] Zero-config install (bundled sandbox image in the installer)
- [ ] AppArmor enforcement
- [ ] Export / save session artefacts to disk
- [ ] Published sandbox image (e.g. GHCR) for skip-local-build installs
- [ ] MIME sniffing via dedicated library (current implementation uses inline magic-byte rules)

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
