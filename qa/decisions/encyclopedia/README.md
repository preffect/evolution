# Decision: encyclopedia and ESC menu (#354)

Real-size mockups of the ESC menu and the encyclopedia, the first screens built on the UI kit
(`docs/ui/components-and-constants.md` §10, `docs/ui/encyclopedia.md` §11, `docs/ui/overlays.md` §3.5). Each frame is
drawn at 1920 × 1080 (UI scale 1.35) and 1280 × 800 (scale 1); the B and C alternatives only at 1920 × 1080.

| Frame                        | Shows                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `esc-menu-*`                 | The ESC menu over the live round: focus on `Return to game`, the pointer on a trait row   |
| `encyclopedia-a-trait-*`     | Option A (atlas) on Mitochondrion: preview stage, tier facts, links, the in-round alert   |
| `encyclopedia-a-category-*`  | Option A on the Food landing: tile grid, keyboard focus on the rail and on the first tile |
| `encyclopedia-b-trait-1920…` | Option B (eyepiece): a round lens preview beside the facts                                |
| `encyclopedia-c-trait-1920…` | Option C (codex): category tabs, a full-width hero preview, prev/next instead of a list   |

The trait facts are the shipped `MITOCHONDRION_TIERS` run through the picker's label table; the food facts are the
`constants/ecology.ts` values. Code-drawn SVG on the #143 dish kit, seeded; re-run from the repo root:

```bash
python3 qa/decisions/encyclopedia/tools/render_encyclopedia.py qa/decisions/encyclopedia
for f in qa/decisions/encyclopedia/*.svg; do rsvg-convert "$f" -o "${f%.svg}.png"; done
```
