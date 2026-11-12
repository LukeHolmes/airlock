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
| **Scope** | Abstract **container runtime** (auto-detect Docker, Podman, OrbStack, Rancher Desktop, Colima/Lima) with **refuse-if-hardening-unsupported**; **“Open in Airlock”** context menu + `airlock://` handler with **single-instance handoff**. |
| **Definition of done** | Linux Docker path unchanged; alternate engine smoke on one non-Docker socket; handlers documented; Windows/macOS installers remain **unsigned** until a future signing/notarisation milestone. |
| **Effort** | **L** (~3–4 weeks) |

**Paid / approval notes**

- **macOS notarisation** needs **$99/yr Apple Developer** — requires Luke’s explicit OK (deferred).
- **Windows code signing** deferred; unsigned installers are expected for v0.5 tags.

---

### M6 — Benign trick-file test kit + release

| | |
|---|---|
| **Scope** | In-repo **M6 trick-file kit** (`fixtures/m6-trick-kit/`, generator + manifest, CI assertions); documented **demo GIF capture** for Luke on a real host (not shipped by agents). |
| **Definition of done** | Kit runs in CI via `sandbox-triage-ci.sh` + `assert-m6-trick-kit.py`; `docs/M6_TRICK_KIT.md` maps fixtures to signals; GIF checklist in `docs/M6_DEMO_GIF_CAPTURE.md`. |
| **Effort** | **S** (~1 week) |

---

### M7 (first v0.6 feature) — Opt-in local AI explainer

| | |
|---|---|
| **Scope** | Optional **plain-English summary** of deterministic triage output on the **host** (never inside the sandbox or sandbox image). |
| **Definition of done** | Settings toggle (default off); pinned GGUF **on-demand download** with **SHA-256** verify; summary UI labelled **“AI summary (not validated)”**; **signed receipt excludes** AI text; threat model documents one-time model download; AI **never decides risk**. |
| **Effort** | **L** (~3 weeks, after M1–M3 foundations) |

**Architecture**

- The **AI never runs inside the sandbox container.** The container runs only deterministic tools and emits **structured JSON findings**.
- Inference runs on the **host** via **node-llama-cpp** inside an **Electron `utilityProcess`** — **not** the main process, **not** the renderer. A native crash or OOM in the model worker must not take down the desktop shell; enforce a **memory cap** and **inference timeout** with hard kill of the utility process.
- **Explicitly reject** the Transformers.js / WebGPU-in-renderer route: it would require `wasm-unsafe-eval` in the renderer **CSP** and would loosen the sandboxed renderer posture established in **M0**.
- Model: small quantised **GGUF** (~**1.5B**, **Q4_K_M**). Default target **Qwen2.5-1.5B-Instruct** (**Apache-2.0**). Alternative **Phi-3 / 3.5-mini** (**MIT**). **Llama 3.2** uses the **Llama Community Licence** (not OSI-approved) — document if offered, **not the default**.

**Opt-in and supply chain**

- **Off by default.** User enables in settings and triggers a **one-time download** (pinned version + **SHA-256** verification). The model is **not** baked into the sandbox image.
- Model stored under app **`userData`**; runs **fully offline** after download.
- The **one-time download** is called out in the **threat model** (network use is user-initiated, not session-default).

**Prompt-injection defence**

- Triage JSON can contain **attacker-controlled strings** (macro source, metadata, URLs, hidden text). Feed the model only a **reduced, allow-listed view**: enums, booleans, counts, rule IDs, **truncated and escaped** indicator names — **never** raw document text, macro bodies, or metadata values.
- Constrain generation with a **JSON-schema grammar** (node-llama-cpp); render through a **fixed template**. **Reject** model output that mentions entities or URLs **not present** in the allow-listed input indicators.

**When inference runs**

- **Do not call the model** when deterministic risk is **`none`** — show the fixed string **`No known risk indicators found (static checks)`** instead.
- **Risk level** is decided by **deterministic rules only** — never by the model.
- **Post-filter:** model output must never contain the word **`safe`** (case-insensitive); drop or replace offending summaries.

**Risk, UI, and signed receipt (GxP / Part 11 / Annex 11)**

- UI: separate **“AI summary (not validated)”** panel — never conflated with signed findings.
- **Signed inspection receipt (M3):** contains raw deterministic findings only; AI text is **excluded** from the JCS-signed payload (`reserved.aiSummaryExcluded` remains true).

**Reproducibility (GxP)**

- Inference settings: **temperature 0**, **fixed seed** where the backend supports it.
- Persist alongside the summary (outside the signature): **model ID**, **model SHA-256**, **prompt template hash**, **node-llama-cpp / engine version**.

**Hardware**

- **CPU** inference by default.
- **GPU** optional via node-llama-cpp backends (**Metal**, **Vulkan**, **CUDA** when present). **No CUDA binaries bundled by default** — keep installer size down; CUDA is opt-in/download if ever offered.
- Graceful CPU fallback; **no hard GPU requirement**.

---

## Explicitly deferred

| Item | Reason |
|------|--------|
| Bundled WSL2/Lima engine | **v0.6** — large install footprint; runtime abstraction (M5) first. |
| eBPF / strace behaviour recording | Extra capabilities conflict with **cap-drop ALL**; needs separate privileged observer design. |
| Fake-net sinkhole | Scope creep vs static triage; network default remains off. |
| Browser extension | Out of desktop trust boundary; different threat model. |
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
4. M5 runtime abstraction **or** handlers shipped.
5. M6 kit + release notes; no “safe” language in UI copy audit.

---

_Last updated: Nov 2026 — planning approved; implementation via feature branches and PRs only._
