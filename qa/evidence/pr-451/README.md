# PR #451 — the decay trait cut as a factor (#445)

One frame, the tight case: **1024 × 640** (the smallest viewport layout.md §1 documents) with `--hud-scale` read
live at **0.8**, the `UI_SCALE_MIN` floor. It carries both surfaces the string is shared by:

- the hold-Tab "affecting you" panel, top left — `Decay · Mitochondrion ×0.85` … `−0.5/s`
- the in-world DECAY rate tag, on the cell — `−0.5/s DECAY ◉ ×0.85`

Scene: mass 312 with Mitochondrion I in the warm vent, the worked example of hud.md §3.1.5, set with
`debug_set_player` on a private stack (4510/4512).

| file                                        | what                                                       |
| ------------------------------------------- | ---------------------------------------------------------- |
| `decay-cue-and-panel-1024x640-scale0.8.png` | the whole frame, unscaled                                  |
| `decay-cue-and-panel-crop-2x.png`           | the top-left 640 × 270 at 2×, so both surfaces are legible |

## The widths, against the measured threshold

The panel's scroll viewport holds **260 px** of row. The decay row's name column overflows between **189.23 px**
(widest text still fitting) and **192.52 px** (narrowest that does not), bisected a character at a time on #451's
review stack — so the capacity is **~189 px**.

| name text                               | name cell | against ~189 px           |
| --------------------------------------- | --------: | ------------------------- |
| `Decay · Mitochondrion −15 %` (old)     | 185.11 px | fits, ~2 characters clear |
| `Decay · Mitochondrion ×0.85` (this PR) | 184.11 px | fits, ~5 px clear         |
| `Decay · Mitochondrion saves 15 %`      | 193.27 px | **overflows**             |

`saves 15 %` pushed the row to 289.05 px against a 287.0 px viewport edge and gave the panel a horizontal scroll
axis (`scrollWidth` 262 against `clientWidth` 260). That is the rejection this PR rests on, and it reproduced to
the decimal on the reviewer's own stack.

**A flush right edge is not evidence of tightness.** A fitting row's right edge is always flush with the viewport's
(287.0 px here) because the name column takes the row's slack — `−15 %` and `×0.85` both measure 287.0. Only the
name cell against the ~189 px threshold means anything. An earlier draft of this file and of the PR body read the
flush edge as "zero spare"; that was wrong, and the corrected reading is above.

The tightest `name + value` rows in this panel are **not** these: `Toxin · near <name>` and `Swallowed · <name>`
reach 188.09–188.63 px at the 20-character name cap and sit ~0.6 px from overflow. See overlays.md §3.7.
