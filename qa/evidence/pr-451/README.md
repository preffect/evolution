# PR #451 — the decay trait cut as a factor (#445)

One frame, the tight case: **1024 × 640** (the smallest viewport layout.md §1 documents) with `--hud-scale` read
live at **0.8**, the `UI_SCALE_MIN` floor. It carries both surfaces the string is shared by:

- the hold-Tab "affecting you" panel, top left — `Decay · Mitochondrion ×0.85` … `−0.5/s`
- the in-world DECAY rate tag, on the cell — `−0.5/s DECAY ◉ ×0.85`

Scene: mass 312 with Mitochondrion I in the warm vent, the worked example of hud.md §3.1.5, set with
`debug_set_player` on a private stack (4510/4512).

| file | what |
| --- | --- |
| `decay-cue-and-panel-1024x640-scale0.8.png` | the whole frame, unscaled |
| `decay-cue-and-panel-crop-2x.png` | the top-left 640 × 270 at 2×, so both surfaces are legible |

Measured in the same frame (DOM, not estimated): panel scroll viewport **260 px** of row, decay row name column
**185 px**, `Decay · Mitochondrion ×0.85` renders **163.6 px** — 20.5 px spare, row right edge 287.0 px on the
viewport's 287.0 px, `scrollWidth == clientWidth`, no horizontal overflow. The rejected `saves 15 %` rendered
**193.3 px** and pushed the row to 289.1 px, 2.05 px outside the panel. See the PR body's table.
