# Decision: encyclopedia and ESC menu (#354)

Real-size mockups of the ESC menu, the encyclopedia and the UI kit (`docs/ui/components-and-constants.md` §10,
`docs/ui/encyclopedia.md` §11, `docs/ui/overlays.md` §3.5). 1920 × 1080 is UI scale 1.35, 1280 × 800 is scale 1. The
three layout options of decision #368 are drawn at both sizes on the same entry. **The human chose B, the eyepiece**: the `encyclopedia-b-*` frames and the category landing are the reference; A and C stay as the record of the decision.

| Frame                                | Shows                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `esc-menu-{1920x1080,1280x800}`      | The ESC menu over the live round: focus on `Return to game`, the pointer on a trait row                                                    |
| `esc-menu-alert-1280x800`            | The menu with the offer alert strip up (seconds in `figure`, the `1` `2` `3` key hints)                                                    |
| `esc-menu-confirm-1280x800`          | `Exit game`'s confirm row: `Leave this round?`, `Exit`, then `Cancel` focused at the trailing end                                          |
| `encyclopedia-a-trait-*`             | Option A (atlas) on Mitochondrion: preview box, tier facts, links, the projected alert strip                                               |
| `encyclopedia-a-category-*`          | Option A on the Cells & food landing: glyph-medallion tiles, focus on the rail, hover on a tile, Back disabled                             |
| `encyclopedia-a-long-trait-1280x800` | Option A on Diatom Shell scrolled to its end: sticky title, three effect rows, a Requires fact                                             |
| `encyclopedia-b-trait-*`             | Option B (eyepiece): a round lens preview beside the facts                                                                                 |
| `encyclopedia-b-long-trait-1280x800` | Option B on Diatom Shell scrolled past its title: the sticky title bar over the lens column                                                |
| `encyclopedia-c-trait-*`             | Option C (codex): category tabs sized to their labels, a full-width hero preview, prev/next                                                |
| `kit-states-1280x800`                | Every kit component in every state: buttons, rail items, rows, tier switch, chips, alert strip, search, key hints, the `side` panel, tiles |

Trait facts are the shipped `MITOCHONDRION_TIERS` and `DIATOM_SHELL_TIERS` through the picker's label table; the other
facts are the `constants/` values. Text is measured from the faces the SVGs render in, so chips and buttons are their
content plus padding. Code-drawn SVG on the #143 dish kit, seeded; re-run from the repo root:

```bash
python3 qa/decisions/encyclopedia/tools/render_encyclopedia.py qa/decisions/encyclopedia
for f in qa/decisions/encyclopedia/*.svg; do rsvg-convert "$f" -o "${f%.svg}.png"; done
```
