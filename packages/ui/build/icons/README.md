# Airlock application icons

Production icon assets for desktop installers (DMG, NSIS, AppImage) and the Electron window.

## Source

| File | Purpose |
|---|---|
| `icon.svg` | Master vector (512×512 viewBox). Edit this first. |
| `icon.png` | 1024×1024 raster export for Linux / electron-builder default |
| `icon.ico` | Windows multi-size icon for NSIS |
| `icon.icns` | macOS icon set for DMG |

Design tokens (Airlock Design System):

- Background: `#08090B` (obsidian)
- Accent: `#3DE8D4` (ice cyan)
- Flat geometric hatch ring, seal seam, diamond aperture — readable at 16×16

## Regenerating binaries

From the repo root:

```bash
./scripts/generate-icons.sh
```

### Prerequisites

Any of the following tool chains work:

**Recommended (cross-platform `.icns` + `.ico`):**

```bash
npm i -g png2icons   # or: npx png2icons
```

**SVG → PNG:**

```bash
# Debian/Ubuntu
sudo apt install librsvg2-bin    # rsvg-convert

# or ImageMagick
sudo apt install imagemagick
```

**Manual one-liners**

```bash
# PNG from SVG
rsvg-convert -w 1024 -h 1024 packages/ui/build/icons/icon.svg \
  -o packages/ui/build/icons/icon.png

# Windows .ico (ImageMagick)
convert packages/ui/build/icons/icon.png \
  \( -clone 0 -resize 16x16 \) \
  \( -clone 0 -resize 32x32 \) \
  \( -clone 0 -resize 48x48 \) \
  \( -clone 0 -resize 64x64 \) \
  \( -clone 0 -resize 128x128 \) \
  \( -clone 0 -resize 256x256 \) \
  -delete 0 packages/ui/build/icons/icon.ico

# macOS .icns (png2icons — works on Linux/macOS/Windows)
png2icons packages/ui/build/icons/icon.png packages/ui/build/icons/icon -icns
png2icons packages/ui/build/icons/icon.png packages/ui/build/icons/icon -ico
```

On macOS you can also build `.icns` with `iconutil` after generating an `.iconset` folder (see `scripts/generate-icons.sh`).

## Wiring

- **electron-builder:** root `package.json` → `build.icon` and per-OS overrides
- **BrowserWindow:** `packages/ui/src/main/index.ts` → dev uses `build/icons/icon.png`; packaged uses `process.resourcesPath/icons/icon.png`
- **Vite dev favicon:** `packages/ui/public/favicon.png` (32×32), linked from `src/renderer/index.html`

After changing the SVG, rerun `./scripts/generate-icons.sh` and commit the updated binaries.
