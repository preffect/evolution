# #294 own-cell indicator textures: baked contact sheet

Every indicator texture this ticket bakes, drawn through the real Pixi path (the atlas frames, the nine-slice
label pill, the two installed BitmapFonts) by the dev bench route's contact sheet, `bench/indicator-sheet.ts`.

| File                     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `indicator-sheet.png`    | The sheet at its px floor sizes (1 CSS px = 1 screen px, DPR 1), trimmed from the 1920 × 1080 bench canvas. Row 1: ghosts nucleoid loop, envelope with pores, form slipper (tinted Cyan's rim), mitochondrion bean, the bean in its unlock ring, chloroplast lens, the lens in its ring. Rows 2–3: aerobic and photosynthetic pip blocks, 0 … 10 eaten. Row 4: label pills `AMOEBOID CAN ENGULF YOU`, `SPRINT TO ESCAPE`, `SEALED`. Row 5: `value` numerals 1, 4, 9, 12. |
| `indicator-sheet-x4.png` | The same pixels enlarged 4× nearest-neighbour (ImageMagick `-filter point`), so the texels read as baked.                                                                                                                                                                                                                                                                                                                                                                |
| `mockup-comparison.png`  | Crops of `qa/decisions/hud-layout/diegetic/own-cell-sizes.png` (45 px tile) and `qa/decisions/endosymbiosis-counter/endo-b-keep-counter.png` (branch `decisions/endosymbiosis-counter`, the decided option) above the baked ghosts and pip blocks at the same enlargement.                                                                                                                                                                                               |

Produced on a private client-only stack from the worktree:

```bash
CLIENT_PORT=4502 ./run.sh --client-only --no-deploy-watch
# Playwright, viewport 1920 x 1080, DPR 1:
#   http://localhost:4502/?bench&sheet=indicators&preserve=1&window=1
#   wait for __evolutionDebug.framesRendered() >= 2, __evolutionDebug.pause(), screenshot
magick sheet.png -crop 900x300+0+0 +repage -fuzz 4% -trim +repage indicator-sheet.png
magick indicator-sheet.png -bordercolor '#0b1626' -border 12 -filter point -resize 400% indicator-sheet-x4.png
```

## Against the mockups

- **Match:** pips in rows of five, ⌀ 4 px with 3 px gaps, lit in the organelle colour and unlit as outlines;
  the level-gold unlock ring 2 px outside the 14 px ghost; the bean told from the lens by cristae vs granules and
  by outline (round bean, pointed lens); the envelope as a dashed circle with pores; the pill 18 px tall with a
  danger rim around bold uppercase white `label` text; the numeral in the mono `value` role on a dark outline.
- **Softer than the mock:** the ghosts carry a halo and a lit wash under the dashes (ASSET-GENERATION §1 layers),
  so they read less flat than the SVG's bare dashed strokes. Graphics-qa to judge at the 14 px floor.
- **Pip row order:** lit from the row nearest the cell, left to right along the clockwise tangent, as UI.md §3.1.2
  says (`pip-block-bake.spec.ts` pins it through the orbit rotation). The mock generator's `pip_block` puts its
  first row at local −y, which is the outer row: the doc, not the generator, was followed.
- **DPR:** captured at DPR 1 only (the Playwright browser's); the 2× bake scale is pinned in the unit specs.
