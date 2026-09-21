#!/usr/bin/env bash
# Redo of M2, M4, M5. The first attempt at each failed to COMPILE (unused-symbol errors), so it
# tested nothing. These keep every symbol used, and the runner now says so out loud.
set -uo pipefail
ROOT=/workspace/.worktrees/gd/364-action-scenes
cd "$ROOT"

EXTENT=packages/client/src/app/game/render/cells/cell-draw-extent.ts
SCENE=packages/client/src/app/game/render/preview/scenes/cell-scene.ts
EXTENT_SPEC=packages/client/src/app/game/render/cells/cell-draw-extent.spec.ts
FRAMING_SPEC=packages/client/src/app/game/render/preview/preview-framing.spec.ts

run() { # <label> <spec path>
  echo "### RUN $1 on $2"
  out=$(./validate.sh test --scope "$2" 2>&1)
  if ! grep -qE "^ +Tests +[0-9]" <<<"$out"; then
    echo "!!! $1 BUILD FAILED — no test lines, so this mutation TESTED NOTHING"
    grep -E "ERROR|error TS" <<<"$out" | head -5
  fi
  grep -E "✓ |×|FAIL |^ +Tests |^ +Test Files " <<<"$out" | head -20
  echo "### END $1"
}

revert() { git checkout -- "$EXTENT" "$SCENE"; }

echo "===== M2: the lens goes back to the looseness the single 4.4 constant gave it ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/preview/scenes/cell-scene.ts')
s = p.read_text()
old = """  return (
    subjectRadiusWu(balance) *
    Math.max("""
new = """  // 3.07x takes a bare protocell's lens from 1.435 radii back to the 4.4 the old constant gave it.
  return (
    3.07 *
    subjectRadiusWu(balance) *
    Math.max("""
assert s.count(old) == 1, 'M2 anchor not unique'
p.write_text(s.replace(old, new))
PY
run M2 "$FRAMING_SPEC"
revert

echo "===== M4: cilia are given a tail's reach on top of their own ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/cells/cell-draw-extent.ts')
s = p.read_text()
old = "membraneRadii + CILIA_REACH_RADII : NO_APPENDAGE_REACH;"
new = "membraneRadii + CILIA_REACH_RADII + FLAGELLUM_LENGTH_RADII : NO_APPENDAGE_REACH;"
assert s.count(old) == 1, 'M4 anchor not unique'
p.write_text(s.replace(old, new))
PY
run M4 "$EXTENT_SPEC"
revert

echo "===== M5: every tail waves as if it were tier I ====="
python3 - <<'PY'
import pathlib
p = pathlib.Path('packages/client/src/app/game/render/cells/cell-draw-extent.ts')
s = p.read_text()
old = "  const tierScale = FLAGELLUM_AMPLITUDE_BY_TIER[tier - 1] ?? FULL_AMPLITUDE;"
new = "  const tierScale = FLAGELLUM_AMPLITUDE_BY_TIER[Math.min(tier, 1) - 1] ?? FULL_AMPLITUDE;"
assert s.count(old) == 1, 'M5 anchor not unique'
p.write_text(s.replace(old, new))
PY
run M5 "$EXTENT_SPEC"
revert

echo "===== DONE; working tree: ====="
git status --porcelain
