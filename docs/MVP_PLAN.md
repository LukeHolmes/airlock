# Airlock MVP Plan (v0.4.0 — portfolio-ready beta)

_Last updated: 9 Nov 2026. Current version: 0.4.0; `v0.4.0-rc.1` pre-release published._

## MVP definition

Airlock v0.4.0 is "MVP" when:

1. CI is green on `main` (typecheck, lint/format, unit tests, Docker sandbox test).
2. The open PR queue is triaged (nothing stale or ambiguous).
3. A `v0.4.0` tag produces a published sandbox image on GHCR and **unsigned** installers (Linux AppImage at minimum; macOS DMG / Windows NSIS if the builds work) attached to a GitHub Release.
4. A first-time user sees a progress screen while the sandbox image is pulled or built.
5. A session's artefacts and analysis can be exported to disk (JSON).
6. A demo GIF and 3–4 screenshots exist in the README, and a portfolio card/project page exists on coldforge.tech.

Out of scope for MVP (post-MVP): code signing and notarisation, AppArmor enforcement, a dedicated MIME library, Podman support, auto-update.

## Phase 0 — CI green (effort: S) — **Done**

- `pnpm-lock.yaml` committed; CI `pnpm install --frozen-lockfile` passes.
- `typecheck`, `ci:lint`, `test`, and `build` pass on `main`.
- Docker sandbox CI job passes on `main`.

**Acceptance:** all CI jobs pass on `main` — met.

## Phase 1 — PR triage (effort: S) — **Done**

Open PRs after triage: **#23** (smoke test harness) and **#24** (Podman runtime detection, draft/post-MVP).

**Acceptance:** only #23 and #24 remain open — met.

## Phase 2 — Release pipeline (effort: M) — **Mostly done**

**Done:**
- `release.yml` on `v*` tags; unsigned installers via electron-builder.
- Version bumped to **0.4.0**; `CHANGELOG.md` added.
- **`v0.4.0-rc.1`** pre-release (28 Oct 2026): unsigned AppImage, macOS DMG, Windows NSIS on the GitHub Release.
- GHCR sandbox image published (e.g. `ghcr.io/lukeholmes/airlock-sandbox:0.4.0-rc.1`).

**Still to do:**
- Clean-machine install test (fresh Docker + install app + open a file in sandbox).
- Final **`v0.4.0`** tag and release (after validation).

**Acceptance:** RC met partial acceptance; final tag and clean-machine test remain.

## Phase 3 — First-run progress screen (effort: S–M) — **In progress (PRs)**

- Report pull/build progress from `ensureSandboxImageReady` to the renderer over IPC.
- Progress UI with stages and retry on errors.

**Acceptance:** not yet met on `main`; work tracked in open PRs.

## Phase 4 — Session export (effort: S) — **In progress (PRs)**

- "Export session" after analysis; JSON with metadata, artefacts, and risk summary; native save dialog; opt-in only.

**Acceptance:** implemented in session-export PR; pending merge.

## Phase 5 — Demo assets and portfolio (effort: S, ~1 day)

- Record demo GIF and screenshots; README and coldforge.tech card.

**Acceptance:** not yet met.

## Total estimate

**Medium: about 6–9 focused days**, most of it in Phases 2 and 3.

## Risks

- **Cross-platform installers.** Unsigned apps hit Gatekeeper/SmartScreen warnings. Mitigation: ship Linux first and document workarounds.
- **Docker dependency.** Demo GIF carries the story for portfolio viewers.
- **Inherited `_ref/` code from OpenClaw.** Excluded from builds and packaging; consider removing post-MVP.
- **Image size and pull time.** First-run progress UI mitigates; slimming is post-MVP.
- **Security claims.** Keep wording conservative until AppArmor and independent review.
