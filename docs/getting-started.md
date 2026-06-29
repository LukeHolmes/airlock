# Getting started with Airlock

Airlock opens suspicious files and untrusted links inside a **sealed, disposable workspace** on your computer. Nothing leaves your machine. When you finish, you **destroy** the workspace and it is gone.

This guide walks you through installation and your first session.

---

## What you need

1. **Docker Desktop** (or Docker Engine on Linux) — Airlock uses Docker to run isolated workspaces.
2. **Airlock** — download the installer for your system from the [releases page](https://github.com/LukeHolmes/airlock/releases).

---

## Step 1 — Install Docker

Airlock requires Docker to be installed and running before you can open a workspace.

### macOS

1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop/).
2. Open the installer and follow the prompts.
3. Launch Docker Desktop from Applications. Wait until the menu bar icon shows Docker is running.

### Windows

1. Download [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/).
2. Run the installer. Enable WSL 2 if prompted (recommended).
3. Start Docker Desktop from the Start menu. Wait until the system tray icon shows Docker is running.

### Linux

1. Install Docker Engine using your distribution’s package manager. See [Docker’s Linux install guide](https://docs.docker.com/engine/install/).
2. Add your user to the `docker` group so Airlock can talk to Docker without `sudo`.
3. Confirm Docker is running: `docker info` should succeed in a terminal.

---

## Step 2 — Install Airlock

1. Go to the [Airlock releases page](https://github.com/LukeHolmes/airlock/releases).
2. Download the installer for your platform:
   - **macOS** — `.dmg`
   - **Windows** — `.exe` (NSIS installer)
   - **Linux** — `.AppImage`
3. Run the installer and open Airlock.

---

## Step 3 — First launch

When you open Airlock for the first time, it checks two things:

| Check | What it means |
|---|---|
| **Docker** | Is Docker installed and running? |
| **Sandbox** | Is the Airlock workspace image ready on your machine? |

If Docker is missing or not running, Airlock shows a banner at the top. Install or start Docker, then click **Re-check**.

If Docker is fine but the sandbox is not set up yet, Airlock prompts you for a **one-time setup**.

---

## Step 4 — One-time sandbox setup

The sandbox is a sealed environment where files and URLs are opened. It is delivered as a Docker image (~1–2 GB download on first setup).

1. When prompted, click **Set up sandbox**.
2. Airlock downloads the image from the internet (or builds it from files bundled with the app if you are offline).
3. Setup usually takes a few minutes depending on your connection. Keep Docker running and leave Airlock open.
4. When setup completes, the banner disappears and the drop zone becomes active.

You only need to do this once per machine (unless you remove the image or reinstall Docker).

---

## Step 5 — Your first session

### Open a file (air-gapped — recommended)

1. Drag a file onto the **Drop a file to detonate** zone, or use **File → Open**.
2. The file opens inside a **sealed, air-gapped** workspace. Network access is off by default.
3. Interact with the file in the viewer (PDF, document, web page, etc.).
4. When finished, click **Destroy workspace**. The container is removed. Nothing persists.

### Open a URL (network required)

1. Turn **Network access** to **ON** in the main window.
2. Paste an `http://` or `https://` URL and click **Detonate**.
3. The page loads in a sandboxed browser inside the workspace.
4. Click **Destroy workspace** when done.

---

## How destruction works

Every workspace is **ephemeral**:

- Created fresh when you start a session.
- **Destroyed** when you click **Destroy workspace** or close the session.
- No files, cache, or browsing history are kept on your computer after destruction.
- Your original file on disk is never modified — it is mounted read-only inside the workspace.

Think of it as a disposable clean room: use it, then throw it away.

---

## After a session

When a workspace is destroyed, you can click **Analyze session** for a short risk summary based on what happened inside that session. Results are shown in the app only — they are not sent anywhere.

---

## Need help?

See [Troubleshooting](troubleshooting.md) for common setup issues (Docker not running, download failed, disk space, and more).

For how isolation works, read [Security model](security-model.md).  
For what Airlock does with your data, read [Privacy](privacy.md).
