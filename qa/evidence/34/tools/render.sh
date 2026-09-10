#!/usr/bin/env bash
# usage: qa/evidence/34/tools/render.sh   (from the repo root)
# Regenerates the #34 evidence: the palette SVG, its PNG (rsvg-convert, like concept sheets 02 / 04), the
# deuteranopia / protanopia simulations of that PNG (Viénot 1999 matrices applied in linear RGB via
# ImageMagick) and the CIEDE2000 separability tables the doc quotes.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DIR=qa/evidence/34
python3 "$DIR/tools/player-palettes.py" "$DIR/player-palettes.svg"
rsvg-convert -w 1920 -h 1000 "$DIR/player-palettes.svg" -o "$DIR/player-palettes.png"
DEUTAN="0.29275 0.70725 0 0.29275 0.70725 0 -0.02234 0.02234 1"
PROTAN="0.11238 0.88762 0 0.11238 0.88762 0 0.00401 -0.00401 1"
magick "$DIR/player-palettes.png" -colorspace RGB -color-matrix "$DEUTAN" -colorspace sRGB "$DIR/player-palettes-deutan.png"
magick "$DIR/player-palettes.png" -colorspace RGB -color-matrix "$PROTAN" -colorspace sRGB "$DIR/player-palettes-protan.png"
python3 "$DIR/tools/colour_separability.py" "$DIR/palette-separability.md"
pnpm prettier --write "$DIR/palette-separability.md" >/dev/null
