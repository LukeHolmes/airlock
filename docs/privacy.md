# Privacy

Airlock is **local-first**. Your files and sessions stay on your computer.

---

## Nothing is uploaded externally

Airlock does not send your files, URLs, session contents, or analysis results to Airlock’s servers or any third-party cloud. There is no “upload for scanning” step.

Network use inside a workspace (when you enable it for URL sessions) is between **your machine**, Docker, and the sites you choose to visit — not routed through Airlock infrastructure.

---

## Analysis results stay on your machine

After you **destroy** a workspace, you can run **Analyze session**. That summary is generated locally from session metadata and logs captured during the session. Results appear in the app only and are kept **in memory** for the current Airlock session — they are not written to disk or transmitted elsewhere in the current version.

---

## No tracking or telemetry

Airlock does not include analytics, usage tracking, or crash reporting to external services. The app does not profile how you use it.

---

## What stays on your computer

| Data | Where it lives |
|---|---|
| Files you open | Your original file on disk (unchanged, read-only inside the workspace) |
| Docker sandbox image | Stored by Docker after one-time setup (~1–2 GB) |
| Session logs for analysis | In memory during the app session; not persisted after quit (today) |

Docker itself may cache images and logs according to your Docker settings. That is outside Airlock’s control.

---

## Future: optional persistence (v0.4+)

A planned update may let you **opt in** to saving session artefacts (logs, exports) to a folder you choose. That will be explicit and off by default. The core model will remain: workspaces are **ephemeral** and **destroyed** unless you decide to keep something.

---

## Open source

Airlock’s source code is public. You can review what the app does on [GitHub](https://github.com/LukeHolmes/airlock) and run it yourself if you prefer.
