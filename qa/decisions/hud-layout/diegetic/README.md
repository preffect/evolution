# Decision #143 option C, reading floor solved (#146)

Option C (diegetic: progress on the cell, only the leaderboard and clock as chrome) failed its own reading floor at
the own cell's real on-screen size: a 3 px arc and 1.5 px pips at 32 px. These frames show the solution specified
in `docs/UI.md §3.1`: **every on-cell indicator has a screen-px floor** (`max(fraction × r_px, floor)`, the idiom
of the self ring and the warning ring), the level numeral is the `value` type role at a fixed size, and the ladder
hint moves from the cell interior to a **ladder orbit** outside the identity ring, where ten countable pips (two
rows of five) fit at every size the camera produces. No chrome fallback at any size.

| File                 | What                                                                                                                                                                                                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `own-cell-32px.png`  | 1280 × 800 frame, own cell 32 px (1080p spawn size) as a respawned level-4 prokaryote: DNA 62 %, aerobic 2/10, photosynthetic 0/10, a threat labelled on its ring                                                                                                                                                                             |
| `own-cell-102px.png` | 1280 × 800 frame, own cell 102 px (`CELL_MAX_MASS`): level-9 eukaryote, the form ghost on the orbit (its next rung), sprint cooling on the self ring                                                                                                                                                                                          |
| `own-cell-sizes.png` | 1:1 tiles of the own cell at 24 px (reference-viewport spawn; cyan, then Mint with a 4-bead seat mark under the counters), 32, 45 (most of a round; aerobic 10/10 unlocked), 102 (max level, gold ring), the escape arc at 33 px in the cover phase and after the seal, and the threat label moved to the far side of a close predator's ring |

The backdrop is the decision frames' dish view at its zoom; only the own cell (and, in the 102 px frame, the other
cells and motes) is drawn at the stated scale. Code-drawn SVG, seeded; re-run from the repo root:

```bash
python3 qa/decisions/hud-layout/tools/render_diegetic.py qa/decisions/hud-layout/diegetic
for f in own-cell-32px own-cell-102px; do
  rsvg-convert -w 1280 -h 800 qa/decisions/hud-layout/diegetic/$f.svg -o qa/decisions/hud-layout/diegetic/$f.png
done
rsvg-convert qa/decisions/hud-layout/diegetic/own-cell-sizes.svg -o qa/decisions/hud-layout/diegetic/own-cell-sizes.png
```

`tools/render.py` is the decision branch's generator (`decisions/hud-layout`), copied unchanged so this one can
import its dish and cell primitives.
