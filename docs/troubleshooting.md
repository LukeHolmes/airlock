# Troubleshooting

Common setup and first-run issues. Each section lists what you see, why it happens, and how to fix it.

---

## Docker is not running

**Symptom**  
Airlock shows a banner: *Docker Desktop is required* (or sessions fail immediately). The drop zone may be disabled.

**Cause**  
Docker is not installed, not started, or the Docker daemon is not reachable.

**Resolution**

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if you have not already.
2. Open Docker Desktop and wait until it reports **Running** (menu bar icon on Mac, system tray on Windows).
3. On Linux, confirm `docker info` works in a terminal.
4. Return to Airlock and click **Re-check**.

---

## Sandbox image is missing

**Symptom**  
Banner says the sandbox is not set up. **Set up sandbox** is offered in the setup window.

**Cause**  
The Airlock workspace image (`airlock/sandbox:latest`) is not on your machine yet. This is normal on first launch.

**Resolution**

1. Ensure Docker is running.
2. Click **Set up sandbox** in the setup window (or **Set up** on the banner).
3. Wait for the download or build to finish.
4. Click **Re-check** if the banner does not clear automatically.

---

## Sandbox download failed (network)

**Symptom**  
Setup fails with a message about pull or download errors. You may be offline or behind a restrictive firewall.

**Cause**  
Airlock could not download the sandbox image from the registry (usually requires internet access).

**Resolution**

1. Check your internet connection.
2. Ensure Docker can reach the internet (corporate proxies may block registry access).
3. Click **Try again** in the setup window.
4. If you remain offline, Airlock can **build the sandbox from files bundled with the app** — keep Docker running and retry setup. This works without a registry download but takes longer and needs ~2 GB free disk space.

---

## Offline fallback (local build)

**Symptom**  
Download fails repeatedly; you have no or limited internet.

**Cause**  
Registry pull is unavailable. Packaged Airlock includes sandbox build files for this situation.

**Resolution**

1. Confirm Docker is running.
2. Click **Set up sandbox** again. Airlock will attempt a local build after pull fails.
3. Allow several minutes — building from bundled files is slower than downloading.
4. Ensure you have enough disk space (see below).

---

## Not enough disk space

**Symptom**  
Setup fails partway through, or Docker reports no space left on device.

**Cause**  
The sandbox image needs roughly **1–2 GB** of free space for download or build, plus Docker’s own overhead.

**Resolution**

1. Free disk space on the drive where Docker stores images (often your main system drive).
2. In Docker Desktop: **Settings → Resources** (or prune unused images: `docker system prune`).
3. Retry **Set up sandbox**.

---

## Wrong CPU architecture

**Symptom**  
Setup or session start fails with architecture or platform errors (e.g. `exec format error`, wrong platform).

**Cause**  
The sandbox image does not match your computer’s CPU (e.g. ARM vs x86).

**Resolution**

1. Install the Airlock build meant for your platform (Apple Silicon vs Intel Mac, 64-bit Windows/Linux).
2. In Docker Desktop, check that the default platform matches your machine.
3. Download the latest Airlock release — images are published for common architectures.
4. If the problem persists, open an issue on the [Airlock GitHub repository](https://github.com/LukeHolmes/airlock/issues) with your OS and CPU type.

---

## Session will not start after setup

**Symptom**  
Setup reported success but dropping a file still fails.

**Cause**  
Readiness state may be stale, or Docker restarted.

**Resolution**

1. Click **Re-check** on the banner.
2. Restart Docker Desktop, then Airlock.
3. See [Getting started](getting-started.md) to confirm both Docker and sandbox show as ready.

---

## Still stuck?

- Re-read [Getting started](getting-started.md) for the full first-run flow.
- Review [Security model](security-model.md) if you want to understand what Airlock is doing under the hood.
- Report a bug with your OS version and the exact error message on [GitHub Issues](https://github.com/LukeHolmes/airlock/issues).
