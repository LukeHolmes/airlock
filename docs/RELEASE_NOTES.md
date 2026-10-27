## Airlock — beta

Installers are **unsigned**. Docker (Desktop or Engine) is required.

### Linux (AppImage)
```
chmod +x Airlock-*.AppImage
./Airlock-*.AppImage
```

### macOS (DMG, best-effort)
Gatekeeper will block the first launch. Right-click Airlock in Applications → Open → Open, or run
`xattr -dr com.apple.quarantine /Applications/Airlock.app`.

### Windows (NSIS, best-effort)
SmartScreen may show "Windows protected your PC". Click More info → Run anyway.

The sandbox image is published as `ghcr.io/lukeholmes/airlock-sandbox:<version>`.
See `docs/getting-started.md` for first-run setup.
