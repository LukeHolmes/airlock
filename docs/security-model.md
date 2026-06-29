# Security model

Airlock is built to open **untrusted** files and links without putting your main computer at risk. This page explains how that works in plain language.

---

## Isolation via containers

Each session runs inside its own **workspace** — a separate Docker container with its own memory, filesystem, and process space. What happens inside the workspace stays inside until you **destroy** it.

Your everyday files, apps, and settings on the host are not shared with the workspace except for the specific file you chose to open (and only as read-only — see below).

---

## Air-gapped by default

When you open a **file**, the workspace starts **air-gapped**: it has no route to the public internet. That limits what a malicious file can do — it cannot phone home, download more payload, or reach your local network without you explicitly enabling network access.

**URL sessions** require network access by design (you are asking to load a web page). Airlock makes you turn network on before a URL can be opened.

---

## Read-only constraints

Files you drop into Airlock are mounted **read-only** inside the workspace. The sandbox can display or run viewers against the file, but it cannot modify your original file on disk or write changes back to your folders.

---

## Ephemeral destruction

Workspaces are **disposable by design**:

- A new workspace is created for each session.
- When you click **Destroy workspace**, the container is stopped and removed.
- Memory, temporary files, and cache inside that workspace are discarded.
- No session state is kept for the next time you open Airlock.

If Airlock closes unexpectedly, it attempts to clean up any workspaces it created so nothing is left running in the background.

---

## No persistence (today)

Airlock does **not** save workspace contents, browsing history, or session files to disk after destruction. Analysis summaries shown after a session are held in memory for that app session only.

A future release may add optional persistent storage for artefacts you choose to keep. The default will remain: **sealed, used once, destroyed**.

---

## Layered hardening

Inside each workspace, Airlock applies additional restrictions familiar from high-isolation setups:

- Privileged operations are disabled inside the container.
- A strict security profile limits which system calls are allowed.
- The workspace runs as a non-root user.

Together, these layers mean even if content inside the workspace misbehaves, it faces a narrow, controlled environment that is torn down when you are done.

---

## What Airlock is not

Airlock is a **local containment tool** for opening risky content on your own machine. It is not a cloud antivirus service, not a VPN, and not a substitute for keeping your operating system and Docker updated.

Use it when you want a clear boundary: open something suspicious, inspect it, then **destroy** the workspace and move on.
