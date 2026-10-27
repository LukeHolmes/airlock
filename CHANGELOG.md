# Changelog

## 0.4.0 — unreleased

Portfolio-ready beta.

- CI green on `main`: lockfile committed, Prettier fixes, Docker sandbox test loads the image and polls KasmVNC readiness (#25, #26).
- Release workflow: `v*` tags build unsigned installers (Linux AppImage required; macOS DMG and Windows NSIS best-effort) and attach them to a GitHub Release. The sandbox image is published to GHCR by `publish-sandbox.yml` on the same tag.
- Installers use the app icons in `packages/ui/build/icons`.
- Versions bumped to 0.4.0.

## 0.3.1

- Bundled sandbox build context in installer, GHCR publish workflow, end-user setup docs, MIME-sniffed drops, README refresh.

## 0.3.0

- Artefact capture and deterministic session analysis.

## 0.2.0

- Network mode control and URL sessions.
