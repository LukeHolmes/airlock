# Windows code signing (SignPath) — plan

Airlock has **applied for** free open-source code signing via the [SignPath Foundation](https://signpath.org/). Until approval, Windows installers built by CI remain **unsigned** (see README **Code signing policy**).

## Product metadata (electron-builder)

Keep these consistent for SignPath submissions:

| Field | Value | Location |
|-------|-------|----------|
| Product name | `Airlock` | Root `package.json` → `build.productName` |
| Application ID | `com.airlock.app` | `build.appId` |
| Executable | `airlock.exe` | `build.executableName` |
| Windows target | NSIS | `build.win.target` |

Optional explicit Windows file version (enable when tagging releases):

```json
"win": {
  "target": "nsis",
  "legalTrademarks": "Airlock",
  "fileVersion": "0.5.0.0",
  "productVersion": "0.5.0"
}
```

Version strings on each release must match the git tag / `RELEASE_NOTES.md` heading.

## Intended CI flow (not active)

1. **`release.yml`** `build` job (Windows) produces unsigned `dist/*.exe` (NSIS).
2. **SignPath job** (disabled today) uploads the artefact and opens a signing request via SignPath’s GitHub integration.
3. **Luke Holmes** approves the request in SignPath (manual gate per release).
4. Signed installer is attached to the GitHub Release (replacing or alongside the unsigned artefact until signing is routine).

### Enable later

In `.github/workflows/release.yml`, set `signpath-windows.if` to run only on `windows-latest` after `build`, and configure:

- SignPath GitHub App / `submit-signing-request` action (per SignPath docs)
- Repository secret placeholders (document names only here — **do not commit values**):
  - `SIGNPATH_API_TOKEN`
  - `SIGNPATH_ORGANIZATION_ID`
  - `SIGNPATH_PROJECT_SLUG`

The commented job in `release.yml` lists the intended steps. No secrets or live API calls until SignPath approves the project.

## Checklist for Luke (SignPath application)

- [ ] Open-source licence: Apache-2.0 (repository root `LICENSE`)
- [ ] README **Code signing policy** and uninstall instructions (SignPath terms)
- [ ] Privacy statement in README (no background network except user-initiated actions)
- [ ] Committers / reviewers / approvers named in README
- [ ] CI produces reproducible NSIS artefact on `v*` tags
- [ ] SignPath GitHub integration connected to `LukeHolmes/airlock` after acceptance

## References

- [SignPath Open Source signing](https://signpath.org/open-source)
- [SignPath terms](https://signpath.org/terms)
- [Code signing policy](../README.md#code-signing-policy)
