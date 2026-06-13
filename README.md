# airlock
Local-first, disposable sandboxed workspace. Electron + Docker + KasmVNC
# Airlock 🔒

A local-first, disposable sandboxed workspace. Drop a file in. It opens in an isolated container. The container dies when you're done. Nothing persists. Nothing escapes.

Airlock is a hard fork of the OpenClaw monorepo architecture, entirely gutted of its AI/LLM components and rebuilt as a strict, deterministic, security-first local execution bus.

---

## What It Does

You drag a file — a PDF, a `.docx`, an HTML attachment, a suspicious installer — onto Airlock. It spins up an ephemeral Docker container with a minimal headless desktop (KasmVNC), opens the file inside it using an appropriate sandboxed application (Chromium, Evince, LibreOffice), and streams the visual output back to your local screen via a WebSocket canvas feed.

When you close the session, the container is forcibly killed and removed. No trace. No persistence. No network by default.

---

## Architecture

────────────────────────────────────────────────┐
│                  Electron Shell                  │
│         packages/ui  (React + Canvas)            │
│                                                  │
│  [ Drag & Drop Zone ]   [ VNC Canvas Stream ]    │
└────────────────────┬────────────────────────────┘
│ IPC / WebSocket
┌────────────────────▼────────────────────────────┐
│              Core Orchestrator                   │
│         packages/core  (Node.js + dockerode)     │
│                                                  │
│  [ Container Lifecycle ]  [ Message Bus ]        │
│  [ Volume Mount Manager ] [ GC / Crash Traps ]   │
└────────────────────┬────────────────────────────┘
│ Docker Socket
┌────────────────────▼────────────────────────────┐
│             Sandbox Environment                  │
│      packages/sandbox  (Docker + KasmVNC)        │
│                                                  │
│  [ Headless X11 ]  [ KasmVNC Stream :6901 ]      │
│  [ Chromium / Evince / LibreOffice ]             │
│  [ No network bridge ] [ Read-only mounts ]      │
└─────────────────────────────────────────────────┘

---

## Monorepo Structure
airlock/
├── packages/
│   ├── ui/               # Electron + React frontend
│   │   ├── src/
│   │   │   ├── main/     # Electron main process
│   │   │   └── renderer/ # React UI, canvas stream, drag-drop
│   │   └── package.json
│   │
│   ├── core/             # Node.js orchestrator
│   │   ├── src/
│   │   │   ├── bus/      # Deterministic local message bus
│   │   │   ├── docker/   # dockerode container lifecycle
│   │   │   └── gc/       # Garbage collection & crash traps
│   │   └── package.json
│   │
│   └── sandbox/          # Docker image definition
│       ├── Dockerfile
│       ├── entrypoint.sh
│       └── package.json
│
├── pnpm-workspace.yaml
├── package.json
└── README.md

---

## Core Principles

### 1. Ephemeral by Default
Every container is created fresh and destroyed on session end. No volumes persist between sessions. No state is written to the host outside of explicitly opted-in export paths.

### 2. Air-Gapped by Default
VNC file sessions attach to an internal Docker bridge (`airlock-isolated`) with no external egress. Network access to the internet is a deliberate, per-session opt-in — not the default (v0.2.0).

### 3. Violent Garbage Collection
If the Electron main process crashes, exits, or is force-quit, an `unhandledRejection` / `beforeExit` trap fires and issues a synchronous `docker kill` + `docker rm` against all containers spawned in that session. Orphaned zombie containers are treated as a critical failure mode.

### 4. Read-Only File Mounts
Dropped files are mounted into the container as `:ro` (read-only). The sandbox can render and display the file but cannot modify it, exfiltrate it over a network, or write derivatives back to the host without an explicit export action.

### 5. Minimal Attack Surface
The sandbox image is built on Alpine/Ubuntu minimal. Capabilities are dropped to the absolute minimum required to run a headless X11 display. A custom seccomp profile is applied. No privilege escalation. No host PID namespace. No host network namespace.

---

## Security Hardening Profile

| Control | Value |
|---|---|
| Network | Internal bridge (`airlock-isolated`) for VNC sessions; no external egress |
| Capabilities | All dropped (`--cap-drop ALL`) |
| Seccomp | Custom profile (Dangerzone-derived) |
| AppArmor | Enforced where available |
| Mount | `:ro` read-only for input files |
| Privilege | No new privileges (`--security-opt no-new-privileges`) |
| PID namespace | Host isolated |
| User | Non-root inside container |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron |
| UI Framework | React + TypeScript |
| Orchestrator | Node.js + dockerode |
| Container Runtime | Docker (local daemon) |
| Remote Desktop | KasmVNC |
| Display Server | Xvfb (headless X11) |
| Package Manager | pnpm workspaces |
| Build | TypeScript + esbuild |

---

## Reference Architecture Sources

Airlock's design draws from four open-source reference implementations:

- **OpenClaw** — Electron shell, Canvas API bridge, and WebSocket message bus (AI components removed)
- **KasmVNC** — Containerised headless X11 + VNC stream pipeline
- **Dockerode** — Node.js Docker daemon bindings and container lifecycle patterns
- **Dangerzone** — Container security hardening profiles, seccomp policies, and isolation primitives

---

## Status

> 🚧 **Early development.** Core architecture being established.

- [ ] Monorepo scaffold
- [ ] Core message bus (stripped OpenClaw gateway)
- [ ] dockerode container lifecycle manager
- [ ] Sandbox Dockerfile (KasmVNC + Alpine)
- [ ] Electron drag-and-drop + canvas renderer
- [ ] Garbage collection & crash trap hooks
- [ ] Seccomp / AppArmor hardening profiles
- [ ] Air-gapped mode toggle
- [ ] Export / save session artefacts

---

## Prerequisites

- Docker Desktop (or Docker Engine on Linux)
- Node.js >= 20
- pnpm >= 9

---

## Licence

MIT
