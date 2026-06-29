#!/usr/bin/env bash
# Generate Airlock desktop installer icons from the master SVG.
#
# Prerequisites (any one path works):
#   • ImageMagick  (`convert` or `magick`)
#   • librsvg2-bin  (`rsvg-convert`) — preferred for SVG → PNG
#   • png2icons     (`npm i -g png2icons` or `npx png2icons`)
#
# Usage:
#   ./scripts/generate-icons.sh
#
# Outputs:
#   packages/ui/build/icons/icon.png   — 1024×1024 master raster
#   packages/ui/build/icons/icon.ico   — Windows multi-size
#   packages/ui/build/icons/icon.icns  — macOS icon set
#   packages/ui/public/favicon.png     — 32×32 Vite dev favicon

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_DIR="$ROOT/packages/ui/build/icons"
PUBLIC_DIR="$ROOT/packages/ui/public"
SVG="$ICON_DIR/icon.svg"
PNG="$ICON_DIR/icon.png"
ICO="$ICON_DIR/icon.ico"
ICNS="$ICON_DIR/icon.icns"
FAVICON="$PUBLIC_DIR/favicon.png"

if [[ ! -f "$SVG" ]]; then
  echo "error: missing master SVG at $SVG" >&2
  exit 1
fi

mkdir -p "$ICON_DIR" "$PUBLIC_DIR"

echo "→ Rendering 1024×1024 PNG from SVG…"
if command -v rsvg-convert >/dev/null 2>&1; then
  rsvg-convert -w 1024 -h 1024 "$SVG" -o "$PNG"
elif command -v magick >/dev/null 2>&1; then
  magick -background none -density 384 "$SVG" -resize 1024x1024 "$PNG"
elif command -v convert >/dev/null 2>&1; then
  convert -background none -density 384 "$SVG" -resize 1024x1024 "$PNG"
else
  echo "error: install rsvg-convert (librsvg2-bin) or ImageMagick to rasterize SVG" >&2
  exit 1
fi

build_ico_with_imagemagick() {
  local tool="$1"
  "$tool" "$PNG" \
    \( -clone 0 -resize 16x16 \) \
    \( -clone 0 -resize 32x32 \) \
    \( -clone 0 -resize 48x48 \) \
    \( -clone 0 -resize 64x64 \) \
    \( -clone 0 -resize 128x128 \) \
    \( -clone 0 -resize 256x256 \) \
    -delete 0 "$ICO"
}

echo "→ Building Windows .ico…"
if command -v png2icons >/dev/null 2>&1; then
  png2icons "$PNG" "$ICON_DIR/icon" -ico
elif npx --yes png2icons "$PNG" "$ICON_DIR/icon" -ico >/dev/null 2>&1; then
  :
elif command -v magick >/dev/null 2>&1; then
  build_ico_with_imagemagick magick
elif command -v convert >/dev/null 2>&1; then
  build_ico_with_imagemagick convert
else
  echo "error: install png2icons or ImageMagick to build .ico" >&2
  exit 1
fi

echo "→ Building macOS .icns…"
if command -v png2icons >/dev/null 2>&1; then
  png2icons "$PNG" "$ICON_DIR/icon" -icns
elif npx --yes png2icons "$PNG" "$ICON_DIR/icon" -icns >/dev/null 2>&1; then
  :
elif command -v iconutil >/dev/null 2>&1; then
  ICONSET="$ICON_DIR/icon.iconset"
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"
  RESIZE=convert
  command -v magick >/dev/null 2>&1 && RESIZE=magick
  for size in 16 32 128 256 512; do
    "$RESIZE" "$PNG" -resize "${size}x${size}" "$ICONSET/icon_${size}x${size}.png"
    double=$((size * 2))
    "$RESIZE" "$PNG" -resize "${double}x${double}" "$ICONSET/icon_${size}x${size}@2x.png"
  done
  iconutil -c icns "$ICONSET" -o "$ICNS"
  rm -rf "$ICONSET"
else
  echo "error: install png2icons (npm i -g png2icons) to build .icns on this platform" >&2
  exit 1
fi

echo "→ Writing Vite dev favicon (32×32)…"
if command -v magick >/dev/null 2>&1; then
  magick "$PNG" -resize 32x32 "$FAVICON"
elif command -v convert >/dev/null 2>&1; then
  convert "$PNG" -resize 32x32 "$FAVICON"
else
  cp "$PNG" "$FAVICON"
fi

echo "✓ Icons written to $ICON_DIR"
ls -la "$ICON_DIR"/icon.{png,ico,icns,svg} "$FAVICON"
