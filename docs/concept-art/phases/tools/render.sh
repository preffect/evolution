#!/usr/bin/env bash
# Regenerate every phase concept sheet (ticket #782): each script writes its SVG, rsvg-convert renders the PNG.
# usage: docs/concept-art/phases/tools/render.sh [sheet-name ...]   (default: all)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$(dirname "$here")"
sheets=("$@")
if [ ${#sheets[@]} -eq 0 ]; then
  sheets=()
  for script in "$here"/*.py; do
    name="$(basename "$script" .py)"
    [ "$name" = phase_art ] || sheets+=("$name")
  done
fi
for name in "${sheets[@]}"; do
  svg="$out/${name//_/-}.svg"
  (cd "$here" && python3 -B "$name.py" "$svg")
  rsvg-convert -w 1920 -h 1080 "$svg" -o "${svg%.svg}.png"
  echo "rendered ${svg%.svg}.png"
done
