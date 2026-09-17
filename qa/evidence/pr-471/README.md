# PR #471 — the encyclopedia entry page (ticket #465)

Every frame is headless Chromium against a private dev stack on **4510 / 4512** in this branch's own
worktree, `deviceScaleFactor: 1`, `scale: "css"` — true size, no zoom. The 1024 × 640 pair is the
`UI_SCALE_MIN` floor (`--ui-scale` 0.8), which ticket #415 found is where layout breaks.

| Frame                                   | Size         | What it shows                                                                                                                                                                                                  |
| --------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `471-trait-1280x800.png`                | 1280 × 800   | Mitochondrion outside a round: the chip row, both facts tables, the prose with its link, See also, and the reserved lens box                                                                                   |
| `471-trait-1024x640.png`                | 1024 × 640   | the same page at the scale floor                                                                                                                                                                               |
| `471-trait-owned-in-round-1280x800.png` | 1280 × 800   | in a room with the trait owned: `OWNED · I` in level gold, the `You own I` caption, tier I tinted with its header in the accent                                                                                |
| `471-stage-1280x800.png`                | 1280 × 800   | Endosymbiosis — a non-trait page: the kind chip, the one `Facts` table, `Reached by` as two links joined by `, `                                                                                               |
| `471-stage-1024x640.png`                | 1024 × 640   | the same at the scale floor                                                                                                                                                                                    |
| `471-eukaryote-fixed-1280x800.png`      | 1280 × 800   | **the review's worst overflow, fixed.** `stage:eukaryote` ran 980 px past the title column with `Opens` cut mid-word; its eight links now wrap inside the column and `Opens` / `Reached by` each keep one line |
| `471-eukaryote-fixed-1024x640.png`      | 1024 × 640   | the same at the scale floor                                                                                                                                                                                    |
| `471-eukaryote-in-room-1280x800.png`    | 1280 × 800   | the same page over a live dish: the row rules stop at the panel rim instead of crossing it                                                                                                                     |
| `471-chloroplast-fixed-1280x800.png`    | 1280 × 800   | the _Effects by tier_ half: `+0.3 mass / s` wraps to two lines in each tier column, all three tier headers present (tier III's had been gone and its values cut to `+0`)                                       |
| `471-lens-before-after.png`             | 320 px crops | the reserved lens box before and after the vignette and the 1 px `LIGHT_ACCENT` inner ring                                                                                                                     |

## The two measurements behind the frames

**Overflow, every entry, both sizes.** Driven in the browser over all **28** registry entries, measuring each
facts table's right edge against the content column's, and looking for any descendant of the entry page whose
`scrollWidth` exceeds its `clientWidth`:

|                                        | before (review, head `56aebc2e`)   | after       |
| -------------------------------------- | ---------------------------------- | ----------- |
| entries overflowing, 1280 × 800        | 12 of 28                           | **0 of 28** |
| entries overflowing, 1024 × 640        | 12 of 28                           | **0 of 28** |
| worst overflow                         | 980 px (`stage:eukaryote`)         | **0 px**    |
| horizontal scroll in the detail column | yes (974 > 750, 1706 on Eukaryote) | **none**    |

**The inner ring, pixel for pixel.** At the lens's left inner edge, `y = 263`:

|                            | x526 (rim)       | **x527 (ring)**       | x528 (field)    |
| -------------------------- | ---------------- | --------------------- | --------------- |
| head `56aebc2e`            | `srgb(23,50,80)` | `srgb(9,17,30)`       | `srgb(9,17,30)` |
| this branch                | `srgb(23,50,80)` | **`srgb(49,92,106)`** | `srgb(9,17,30)` |
| the review's own prototype | `srgb(23,50,80)` | **`srgb(49,92,106)`** | `srgb(9,17,30)` |

**The vignette measures as a no-op on an empty box**, and this README says so rather than claiming depth:
sampled along the radius (x 530 → 671) the field reads `srgb(9,17,30)` at every step both before and after,
because `CALLOUT_BACKING` at 0.6 over a well that is already `CALLOUT_BACKING` at 0.45 changes nothing the
8-bit buffer can hold. It is kept because §11.4 owns it and it is the field stop for the lit scene ticket #466
puts under it — there it will have something to darken.

## The kit change, and the consumers it did not move

`ui-facts-table` gained `shouldWrapValues`, off by default. Every other consumer was captured on this branch
and again with `ui-facts-table.component.{ts,css}` reverted to `origin/main`, same stack, same viewport:

| Consumer                                                  | Comparison                                      | RMSE  |
| --------------------------------------------------------- | ----------------------------------------------- | ----- |
| `?kit` (a `side` panel of facts tables, and a tier table) | full page, 1280 × 800                           | **0** |
| `?kit&sheet=collections`                                  | full page, 1280 × 800                           | **0** |
| the HUD's hold-Tab affecting panel                        | panel crop, room paused and player state pinned | **0** |

The affecting panel was also measured directly in both builds: all four of its tables carry no
`data-wrap-values`, every cell computes `white-space: nowrap` at `line-height: 14px`, every row is 26 px
(`UI_FACT_ROW_HEIGHT_PX`) and every table is 326 px wide — identical figures either side.
