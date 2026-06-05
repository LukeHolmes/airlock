# AGENTS.md

Guidance for cloud agents working in the Airlock monorepo.

## Cursor Cloud specific instructions

Airlock is a **pnpm monorepo** (Electron + React UI, Node/dockerode orchestrator, Alpine/KasmVNC sandbox image). Standard commands live in the root `package.json` and `.github/workflows/ci.yml`.

### Services

| Service | Notes |
|---------|--------|
| **Docker daemon** | Required for `@airlock/core` and sandbox builds. Cloud VMs need Docker installed with `fuse-overlayfs` storage driver and `dockerd` running (see VM bootstrap below). Ensure the agent user can access `/var/run/docker.sock`. |
| **Vite dev server** (`@airlock/ui`, port **5173**) | Serves the React renderer. `pnpm --filter @airlock/ui dev` currently fails because `vite.config.ts` uses `require('tailwindcss')`, which Vite 8 cannot resolve when bundling the config. Workaround: run Vite with a minimal ESM config that omits PostCSS (UI loads; Tailwind classes may be missing). |
| **Electron** (`@airlock/ui start`) | Needs a display (`DISPLAY` or `xvfb-run`). Point at Vite with `VITE_DEV_SERVER_URL=http://localhost:5173`. Prebuilt `dist/main` and `dist/preload` exist; a full `pnpm --filter @airlock/ui build` fails today due to `rootDir` / shared IPC types in `tsconfig.main.json`. |
| **Sandbox image** (`airlock/sandbox:latest`) | Built via `pnpm ci:docker` or `pnpm --filter @airlock/sandbox build`. **Currently fails** on Alpine 3.21: packages `obconf`, `lxappearance`, and `notification-daemon` are missing from the index. |

### VM Docker bootstrap (one-time per pod)

If `docker info` fails, the daemon is not running or the socket is inaccessible:

```bash
sudo dockerd > /tmp/dockerd.log 2>&1 &
sudo chmod 666 /var/run/docker.sock   # or: sudo usermod -aG docker $USER && newgrp docker
```

Docker CE on this VM uses `/etc/docker/daemon.json` with `"storage-driver": "fuse-overlayfs"` and legacy iptables.

### Build order

1. `pnpm --filter @airlock/core build` — required before Electron main imports `@airlock/core` declarations.
2. UI main/preload/renderer — blocked by existing TS config issues (see above).

### Validation commands (match CI)

```bash
pnpm typecheck          # @airlock/core only
pnpm ci:lint            # ESLint + Prettier
pnpm ci:docker          # sandbox image build (currently fails on Dockerfile apk packages)
pnpm --filter @airlock/core build
```

### Dev demo (browser mock mode)

Terminal 1 — Vite (workaround config):

```bash
pnpm exec vite --config /tmp/airlock-vite.config.ts
```

Terminal 2 — optional Electron:

```bash
xvfb-run -a env VITE_DEV_SERVER_URL=http://localhost:5173 pnpm --filter @airlock/ui start
```

Browser-only at `http://localhost:5173` shows the drag-and-drop UI with **IPC mock mode** (expected without Electron).

### dockerode smoke test

From `packages/core` (after Docker daemon + socket access):

```bash
node --input-type=module -e "import Docker from 'dockerode'; const d=new Docker(); console.log(await d.info());"
```

### Gotchas

- `pnpm-lock.yaml` is gitignored; use `pnpm install` (not `--frozen-lockfile`) locally unless a lockfile is added to the repo.
- `pnpm approve-builds` is interactive — do not run in cloud agents. Native deps (`ssh2`, etc.) may skip postinstall scripts; core typecheck still passes.
- Root `pnpm dev` starts Vite + a core no-op; it does **not** start Electron or Docker.
- Sandbox containers use `NetworkMode: none`; URL detonation and VNC port publishing are not fully wired yet.
