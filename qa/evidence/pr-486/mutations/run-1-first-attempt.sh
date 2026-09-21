#!/usr/bin/env bash
# Break each guard and confirm it goes red. Reverts after every mutation.
set -uo pipefail
ROOT=/workspace/.worktrees/gd/364-action-scenes
cd "$ROOT"

EXTENT=packages/client/src/app/game/render/cells/cell-draw-extent.ts
SHAPE=packages/client/src/app/game/render/cells/shape-terms.ts
SCENE=packages/client/src/app/game/render/preview/scenes/cell-scene.ts

EXTENT_SPEC=packages/client/src/app/game/render/cells/cell-draw-extent.spec.ts
FRAMING_SPEC=packages/client/src/app/game/render/preview/preview-framing.spec.ts

run() { # <label> <spec path>
  echo "### RUN $1 on $2"
  ./validate.sh test --scope "$2" 2>&1 | grep -E "✓ |×|✗|FAIL|Test Files|Tests |AssertionError|reached|looser|past the" | head -30
  echo "### END $1"
}

revert() { git checkout -- "$EXTENT" "$SHAPE" "$SCENE"; }

echo "===== BASELINE ====="
run baseline-extent "$EXTENT_SPEC"
run baseline-framing "$FRAMING_SPEC"

echo "===== M1: peakReachRadii forgets the breathing peak ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/cells/shape-terms.ts')
s = p.read_text()
old = "    scales.breathing * BREATH_AMPLITUDE,\n    traits.wobble.amplitude,"
new = "    0,\n    traits.wobble.amplitude,"
assert s.count(old) == 1, 'M1 anchor not unique'
p.write_text(s.replace(old, new))
PY
run M1 "$EXTENT_SPEC"
revert

echo "===== M2: the cell scene goes back to one constant of 4.4 ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/preview/scenes/cell-scene.ts')
s = p.read_text()
old = """  const offsetRadii = isSwimming ? PREVIEW_SWIM_RADIUS_RADII : 0;
  return (
    subjectRadiusWu(balance) *
    Math.max(
      (offsetRadii + extent.bodyRadii) / PREVIEW_CELL_BODY_FILL_FRACTION,
      (offsetRadii + extent.drawnRadii) / PREVIEW_CELL_DRAWN_FILL_FRACTION,
    )
  );"""
new = """  void extent;
  void isSwimming;
  return subjectRadiusWu(balance) * 4.4;"""
assert s.count(old) == 1, 'M2 anchor not unique'
p.write_text(s.replace(old, new))
PY
run M2 "$FRAMING_SPEC"
revert

echo "===== M3: the cell scene frames twice as tight as its contents allow ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/preview/scenes/cell-scene.ts')
s = p.read_text()
old = "  const offsetRadii = isSwimming ? PREVIEW_SWIM_RADIUS_RADII : 0;"
new = "  const offsetRadii = (isSwimming ? PREVIEW_SWIM_RADIUS_RADII : 0) * 0.5;\n  extent = { bodyRadii: extent.bodyRadii * 0.5, drawnRadii: extent.drawnRadii * 0.5 };"
assert s.count(old) == 1, 'M3 anchor not unique'
s = s.replace(old, new).replace("  const extent = cellDrawExtentRadii(", "  let extent = cellDrawExtentRadii(")
p.write_text(s)
PY
run M3 "$FRAMING_SPEC"
revert

echo "===== M4: cilia are given a tail's reach ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/cells/cell-draw-extent.ts')
s = p.read_text()
old = "  const ciliaReach = traits.ciliaCount > 0 ? membraneRadii + CILIA_REACH_RADII : NO_APPENDAGE_REACH;"
new = "  const ciliaReach = traits.ciliaCount > 0 ? membraneRadii + FLAGELLUM_LENGTH_RADII : NO_APPENDAGE_REACH;"
assert s.count(old) == 1, 'M4 anchor not unique'
p.write_text(s.replace(old, new))
PY
run M4 "$EXTENT_SPEC"
revert

echo "===== M5: the tail stops growing with its tier ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/cells/cell-draw-extent.ts')
s = p.read_text()
old = "  const tierScale = FLAGELLUM_AMPLITUDE_BY_TIER[tier - 1] ?? FULL_AMPLITUDE;"
new = "  const tierScale = FULL_AMPLITUDE;"
assert s.count(old) == 1, 'M5 anchor not unique'
p.write_text(s.replace(old, new))
PY
run M5 "$EXTENT_SPEC"
revert

echo "===== DONE; working tree: ====="
git status --porcelain
