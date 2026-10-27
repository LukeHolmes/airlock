# Airlock MVP Plan (v0.4.0 — portfolio-ready beta)

_Last updated: 27 Oct 2026. Current version: 0.3.1, no tagged releases._

## MVP definition

Airlock v0.4.0 is "MVP" when:

1. CI is green on `main` (typecheck, lint/format, unit tests, Docker sandbox test).
2. The open PR queue is triaged (nothing stale or ambiguous).
3. A `v0.4.0` tag produces a published sandbox image on GHCR and **unsigned** installers (Linux AppImage at minimum; macOS DMG / Windows NSIS if the builds work) attached to a GitHub Release.
4. A first-time user sees a progress screen while the sandbox image is pulled or built.
5. A session's artefacts and analysis can be exported to disk (JSON).
6. A demo GIF and 3–4 screenshots exist in the README, and a portfolio card/project page exists on coldforge.tech.

Out of scope for MVP (post-MVP): code signing and notarisation, AppArmor enforcement, a dedicated MIME library, Podman support, auto-update.

## Phase 0 — CI green (effort: S, ~0.5–1 day)

Done in the `cleanup-mvp-plan` PR:
- `pnpm-lock.yaml` committed (generated with pnpm 9, matching CI) and removed from `.gitignore`. CI's `pnpm install --frozen-lockfile` was failing because no lockfile existed.
- Prettier run over 10 files that failed `format:check` (formatting only, no logic changes).
- Locally: `pnpm install --frozen-lockfile`, `typecheck`, `ci:lint`, `test` (13/13), and `build` all pass.

Still open:
- **Docker Sandbox Build Test** fails at "Test image with security profile". The job logs have expired (HTTP 410), so the cause isn't confirmed. Likely candidates:
  - KasmVNC isn't ready within the fixed `sleep 15`. Fix: poll the HTTP endpoint for up to about 60s.
  - The entrypoint or supervisord needs a capability that `--cap-drop ALL` removes, so the container exits.
  - The HTTP endpoint needs auth or TLS, so `curl -sf` fails.
  - Next step: re-run the job and read the `docker logs` output it prints.

**Acceptance:** all CI jobs pass on `main`, and the CI Summary job is green.

## Phase 1 — PR triage (effort: S, ~1–2 hours; Luke decides, nothing closed automatically)

| PR | Title | Recommendation | Reason |
|---|---|---|---|
| #6 | fix(sandbox): container boot contract | Close as superseded | Landed via "Merge PR #5 and #6" on main |
| #9 | feat(v0.2): network mode + URL sessions | Close as superseded | Same commit is on main |
| #10 | feat(v0.3): artefact capture + analysis hook | Close as superseded | Same commit is on main |
| #11 | feat: deterministic session analysis engine | Close as superseded | Same commit is on main |
| #15 | feat: validate dropped files with MIME sniff | Close as superseded | Branch merged into main ("Merge pull request #15") |
| #16 | docs: refresh README for v0.3.1 | Close as superseded | Branch merged into main |
| #18 | ci: publish sandbox image to GHCR on release tags | Close as superseded | Landed on main as commit "(PR #19)" |
| #19 | feat: bundle sandbox build context in installer | Close as superseded | Landed on main as commit "(PR #18)" |
| #20 | ci: publish sandbox image to GHCR (stacked) | Close as superseded | Duplicate of #18 / work on main |
| #23 | feat: smoke test harness + structured debug logging | **Rework, then merge** | Useful for MVP. Rebase onto main after this PR and get CI green |
| #24 | Podman-first runtime detection | **Rework post-MVP** (keep open as draft) | Changes runtime behaviour, so it's risky before the first release |

**Acceptance:** only #23 (in progress) and #24 (draft) remain open.

## Phase 2 — Release pipeline (effort: M, ~2–3 days)

- Add a `release.yml` workflow that runs on `v*` tags. It builds the installers with electron-builder (Linux AppImage required; macOS and Windows best-effort), leaves them unsigned, and uploads them to a GitHub Release. Check that the existing `publish-sandbox.yml` also fires on the tag.
- Bump the version to 0.4.0 in the root `package.json` and the package `package.json` files. Add a `CHANGELOG.md`.
- Write release notes that say the installers are unsigned and explain how to open them (Gatekeeper / SmartScreen).

**Acceptance:**
- Tagging `v0.4.0-rc.1` produces a Release with at least one installer, and `ghcr.io/lukeholmes/airlock-sandbox:0.4.0-rc.1` can be pulled.
- A fresh machine with Docker can install the app and open a PDF in the sandbox.

## Phase 3 — First-run progress screen (effort: S–M, ~1–2 days)

- Report pull/build progress from `ensureSandboxImageReady` to the renderer over IPC, using Docker pull progress events and build log lines.
- Show a progress UI with stages (checking Docker → pulling image → ready). Give each error a clear message and a retry button.

**Acceptance:**
- With no local image, launching the app shows progress and ends ready to drop a file.
- When Docker isn't running, the app shows a clear message and a retry button.

## Phase 4 — Session export (effort: S, ~1 day)

- Add an "Export session" button after analysis. It writes JSON with the session metadata, captured artefacts and the risk summary, and the user picks the path with a save dialog.
- Keep it opt-in, since nothing persists by default.

**Acceptance:** the exported file matches a documented schema, and a unit test covers the serialiser.

## Phase 5 — Demo assets and portfolio (effort: S, ~1 day)

- On a machine with Docker, record a 15–30s GIF: drop a PDF → it opens in the sandbox → close → container destroyed → analysis summary. Take 3–4 screenshots.
- Add them to the README.
- Add an Airlock card to coldforge.tech: a real screenshot, "open-source desktop app (v0.4 beta)", a GitHub link and a Releases link. Optionally add a short project page.

**Acceptance:** the README shows the demo, and the card is live on coldforge.tech.

## Total estimate

**Medium: about 6–9 focused days**, most of it in Phases 2 and 3.

## Risks

- **Docker CI test root cause unknown.** Fixing it could require changing the sandbox security profile, which has security implications. Fix the CI test, not the profile, unless the profile is actually wrong.
- **Cross-platform installers.** Building macOS DMGs needs a macOS runner, and unsigned apps hit Gatekeeper/SmartScreen warnings. Mitigation: ship Linux first and document the workarounds.
- **Docker dependency.** It's a barrier for portfolio viewers, so the demo GIF has to carry the story.
- **Inherited `_ref/` code from OpenClaw.** Large surface area with its own tests. Exclude it from builds and packaging (already done for packaging) and consider removing it.
- **Image size and pull time.** A KasmVNC desktop image is large, which affects the first run. The progress UI mitigates this, and image slimming is post-MVP.
- **Security claims.** Keep wording conservative ("isolated, disposable container") until AppArmor and an independent review are done.
