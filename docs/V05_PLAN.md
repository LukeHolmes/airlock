# Airlock v0.5 — From passive viewer to trustworthy inspector

**Positioning:** Privacy-first, **local** triage for security researchers, OSINT analysts, and journalists who must not exfiltrate source material. The long-term differentiator is **auditable, compliance-ready inspection** for regulated teams (GxP/pharma, legal, finance): structured findings, tamper-evident receipts, and change-control-friendly exports — aligned with CSV validation and documented inspection boundaries.

**UI language rule:** Never say “safe” or show a green tick. Use **“No known risk indicators found (static checks)”** and remind users that **isolation** is the real protection.

**Isolation invariant (all milestones):** Ephemeral containers, **network off by default**, `cap-drop: ALL`, seccomp, read-only input mounts, non-root user. No milestone weakens these defaults.

---

## Milestones (order)

### M0 — Hardening quick wins

| | |
|---|---|
| **Scope** | Per-container CPU/memory/PID limits; bounded tmpfs scratch paths; Electron renderer audit (context isolation, CSP, loopback-only VNC iframe); optional `runsc` when registered; README threat-boundary section; unit tests for Docker host config builder. |
| **Definition of done** | Merged PR on `main`; core tests + CI green; smoke harness still passes on amd64; docs state platform VM boundaries and gVisor opt-in. |
| **Effort** | **S** (~1 week) |

*Delivered in PR B (`feat/v0.5-m0-hardening`).*

---

### M1 — In-container static triage (“File Nutrition Label”)

| | |
|---|---|
| **Scope** | Non-root triage runner inside the **same offline** container: `exiftool`, `pdfid`/`pdf-parser`, `oletools` (`olevba`, `oleid`), ~30 curated **YARA** rules (macros, auto-exec, embedded executables, PDF `/JavaScript`, `/OpenAction`, `/Launch`, suspicious URI schemes). Stream **structured JSON** to a **side panel** in the UI (progress + findings). |
| **Definition of done** | PDF, Office, and HTML samples produce expected rule hits in CI fixtures; panel renders findings without claiming “safe”; triage timeout bounded; session export includes triage JSON; failure modes documented. |
| **Effort** | **L** (~3–4 weeks) |

**ClamAV — deferred / optional**

- Signature DB ~**300MB**, requires **network** for updates.
- Conflicts with **offline, ephemeral** containers unless we ship a **separate signed DB pack** + refresh channel (supply-chain and GxP change-control implications).
- **Risk:** Teams may ask for “AV green light”; document that static+YARA is intentional and ClamAV is not a release gate for v0.5.

---

### M2 — Hidden content X-ray

| | |
|---|---|
| **Scope** | Detect hidden / zero-size / white-on-white text (prompt-injection in CVs, contracts), invisible Unicode; **QR** decode in-container (`zbar`); URL extraction with **punycode** and homoglyph warnings surfaced in the side panel. |
| **Definition of done** | Fixture kit triggers each detector class; false-positive rate documented on benign corpus; findings merge into export schema vNext. |
| **Effort** | **L** (~3 weeks) |

---

### M3 — Tamper-evident inspection receipt

| | |
|---|---|
| **Scope** | Upgrade session export: **JSON + 1-page PDF** report with file SHA-256, magic vs extension, **container image digest**, triage findings, session start/end/duration, app version; **Ed25519** signature from a **locally generated key**; `airlock verify` CLI for integrity check. |
| **Definition of done** | Verify passes on exported bundle; tampered file fails verify; docs state **integrity, not identity** unless the user distributes their public key; key stored in OS keychain where available. |
| **Effort** | **M** (~2 weeks) |

---

### M4 — Safe export + scrubbed clipboard

| | |
|---|---|
| **Scope** | **Export clean PDF/text**: in-container pixel-flatten (`pdftoppm` → `img2pdf`, Dangerzone-style). Replace raw VNC clipboard with an explicit **plain-text copy drawer** that strips control chars and zero-width Unicode. |
| **Definition of done** | Exported PDF has no JavaScript layer in fixtures; clipboard drawer never copies HTML from guest; user acknowledges export is “best-effort flatten”. |
| **Effort** | **M** (~2 weeks) |

---

### M5 — Friction reduction

| | |
|---|---|
| **Scope** | Abstract **container runtime** (auto-detect Docker, Podman, OrbStack, Rancher Desktop, Colima/Lima); **“Open in Airlock”** context menu + `airlock://` handler; **SignPath Foundation** application for free OSS **Windows** signing. |
| **Definition of done** | Linux Docker path unchanged; second runtime passes smoke on one alternate engine; handlers documented; SignPath **submitted** (approval **outside our control**). |
| **Effort** | **XL** (~4–6 weeks, calendar-dependent on SignPath / Apple) |

**Paid / approval notes**

- **macOS notarisation** needs **$99/yr Apple Developer** — requires Luke’s explicit OK.
- **SignPath** acceptance not guaranteed; unsigned macOS/Windows remain fallback.

---

### M6 — Benign trick-file test kit + release

| | |
|---|---|
| **Scope** | Kit: EICAR string, benign macro doc, QR phishing sample, white-text PDF, extension spoof; **demo GIF**; **v0.5 release notes**; update clean-machine checklist. |
| **Definition of done** | Kit runs in CI (non-destructive); GIF captured on real GPU host; tagged release with GHCR sandbox + installers. |
| **Effort** | **S** (~1 week) |

---

## Explicitly deferred

| Item | Reason |
|------|--------|
| Bundled WSL2/Lima engine | **v0.6** — large install footprint; runtime abstraction (M5) first. |
| eBPF / strace behaviour recording | Extra capabilities conflict with **cap-drop ALL**; needs separate privileged observer design. |
| Fake-net sinkhole | Scope creep vs static triage; network default remains off. |
| Browser extension | Out of desktop trust boundary; different threat model. |
| Local LLM explainer | Future **opt-in, local-only** stage; not default (data residency). |
| Watch-folder | Automation risk; manual open preserves intent. |
| Visual diff | Niche; after M2/M3 foundations. |
| Team / cloud features | Conflicts with local-first positioning until receipts are proven. |

---

## Competitive landscape (modest, factual)

| Product | Gap Airlock fills |
|---------|-------------------|
| **Dangerzone** | Airlock adds **desktop session UX**, KasmVNC inspection, JSON/PDF **receipts**, and offline static triage — not only conversion to PDF. |
| **Windows Sandbox** | Disposable **VM**, not a documented **inspection workflow** or exportable compliance artefact; no cross-platform Linux focus. |
| **Qubes** | Strong isolation, **high operator burden**; Airlock targets **single-file triage** without full qube topology. |
| **Sandboxie-Plus** | App compatibility layer on **one OS**; not containerised Linux viewers + **GHCR** sandbox image. |
| **ANY.RUN / Joe Sandbox / Hybrid Analysis** | **Cloud** execution — data leaves the machine; Airlock stays **local**. |
| **VirusTotal** | Multi-engine **upload**; no interactive viewer or air-gapped default. |
| **CAPE / internal sandboxes** | Analyst-grade, **heavy ops**; Airlock is **lighter, privacy-first desktop** triage. |
| **Cloud browser isolation** (Island, etc.) | Enterprise **browser** proxy; not offline **file** nutrition labels or signed receipts. |

---

## v0.5 release criteria (summary)

1. M0 + M1 + M2 in `main` with CI and published multi-arch smoke green.
2. M3 receipt format stable; verify command documented.
3. M4 export path for at least PDF inputs.
4. M5 runtime abstraction **or** handlers shipped (SignPath may trail tag).
5. M6 kit + release notes; no “safe” language in UI copy audit.

---

_Last updated: Nov 2026 — planning approved; implementation via feature branches and PRs only._
