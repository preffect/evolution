# #294 fill arc primitive: the arc panel of the contact sheet

The arc primitive (`effects/arc-mesh.ts`, one instanced SDF quad per row, one draw call per frame) drawn through
the real Pixi / WebGL path by the dev bench route's contact sheet (`bench/indicator-sheet.ts`,
`bench/indicator-sheet-arcs.ts`), below the texture rows of PR #301.

| File                                                                 | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `indicator-sheet-arcs.png`                                           | The whole 1920 × 1080 bench canvas at DPR 1: the texture rows on top (the unlock ring is no longer a baked sprite), then the arc panel. Left: the DNA ring at 0 / 25 / 50 / 75 / 100 % on the 17 px floored ring (a 24 px spawn cell) and on the 44.9 px ring of a max-mass cell, each track plus a 4 px fill on a patch of body. Middle, top: a 32 px cell's ladder orbit with the envelope ghost at 180 and both counters full, whose padded backings merge into one band (UI.md §3.1.3). Middle, bottom (round two): a 24 px prokaryote with both counters full, whose two backings stay apart. Each counter ghost wears its gold unlock ring; the ghosts and pip blocks are placed tangent by `orbitLayout`; every backing has butt ends. Right: the escape arc on a max-mass cell's 126.2 px orbit, the danger track and a 40 % window, 4 px stroke. |
| `arc-panel.png`                                                      | The panel's parts enlarged nearest-neighbour: the DNA rings ×2, both orbits ×4, the escape arc ×1, and three ×8 close-ups of the anti-aliased edge (the escape arc's edge, the 44.9 px ring's fill end cap, the 17 px ring's fill start).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `orbit-32px-merged-backing-x6.png`, `orbit-24px-two-counters-x6.png` | graphics-qa's two round-one panels re-shot ×6 after the butt-cap fix: the merged 32 px band ends 4 px past its outer items, and the 24 px prokaryote's two backings stand apart at 6 o'clock.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

Produced on a private client-only stack from the worktree, exactly as PR #301's sheet:

```bash
CLIENT_PORT=4502 ./run.sh --client-only --no-deploy-watch
# Playwright, viewport 1920 x 1080, DPR 1:
#   http://localhost:4502/?bench&sheet=indicators&preserve=1&window=1
#   wait for __evolutionDebug.framesRendered() >= 2, __evolutionDebug.pause(), screenshot (no console errors or warnings)
magick sheet.png -crop 40x40+1556+500 +repage -filter point -resize 800% arc-edge-escape-x8.png   # and the other crops
```

## What it shows

- **Fill and sense.** Every fill starts at 12 o'clock and runs clockwise; 25 / 50 / 75 % end at 3 / 6 / 9 o'clock,
  0 % draws no row (a round cap would leave a dot), 100 % is the closed ring.
- **Stroke at any radius.** The fill is 4 px on the 17 px ring and on the 44.9 px ring, and the escape arc is 4 px on
  the 126 px orbit: one row layout, no per-radius bake.
- **Edge.** One screen px of coverage across every edge. The round caps are real, not butt ends that look round at 4 px:
  at the 17 px fill's start the pixel diagonally past the cap, `(268, 361)`, reads `srgb(95,120,186)` (partly
  covered) while the pixel on the stroke's centre line beside it, `(268, 363)`, reads `srgb(196,109,246)` (fully
  covered); a butt or square end would cover both alike.
- **Merged backing.** At 32 px the orbit's padded backings meet and draw as one band with no darker seam, as
  `orbitLayout` merges them.
- **Butt-ended backings (round two).** Round one drew the backings with the primitive's round caps. A cap adds
  half the 16 px stroke to each end, so every band overshot its items by 12 px instead of §9's 4. At 24 px the
  prokaryote's two backings, 5 px apart per §3.1.3, overlapped into a double-alpha seam (graphics-qa measured
  #060B15 at x 998–1003).
  - The fix is a per-row cap: the backings are `butt`, and the DNA fill, escape arc and unlock rings stay `round`.
  - On the re-shot sheet, along the 24 px orbit's centre line (y 649) at 6 o'clock, x 1000 reads `srgb(11,22,38)`,
    the bare field colour, where the gap between the two bands now is.
  - x 998 and x 1003 read `srgb(10,19,33)` and `srgb(8,15,27)`: the single-backing band (#080F1B), with no darker
    seam anywhere.
  - `orbit-backing-arcs.spec.ts` pins the drawn extents, caps included, at 24, 32, 45 and 102 px: no overlap
    between the two unmerged backings, and each band ending exactly `LADDER_BACKING_END_PAD_PX` past its items.
    A round cap fails both.
- **Draw calls.** Every arc on the panel (the 30 DNA rows, the orbit's rows and the escape rows) is one instanced
  call of one mesh; `arc-mesh.spec.ts` pins one mesh, one quad index buffer and the instance count at 0, 1 and many
  rows, and `render-budget-ledger.spec.ts` pins the effects row at 3 calls with 1 call of headroom under 17.
