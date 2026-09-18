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

The affecting panel was also measured directly in both builds: its tables carry no `data-wrap-values`, every
cell computes `white-space: nowrap` at `line-height: 14px`, every row is 26 px (`UI_FACT_ROW_HEIGHT_PX`) and
every table is 326 px wide — identical figures either side.

**RMSE alone would not have caught a leak here, so do not read the zeroes as the whole answer.** Every value
on `?kit` is short enough to fit its column, so a table that wrapped would still land on the same pixels: the
frames go identical whether the opt-in is respected or not. The measurement that separates the two cases is
the computed one — `data-wrap-values` absent, `white-space: nowrap`, `line-height: 14px` — and the proof that
it separates them is the mutation below, which moved those three figures while leaving RMSE at 0.

## Re-verified on this round's head, with each guard broken to show it bites

The four guards this round adds were each broken in turn and the named spec went red (172 client ui-kit tests,
344 encyclopedia tests):

| Mutation                                                   | Spec that went red                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| delete `.table[data-wrap-values] td.value`'s `white-space` | `keeps every cell on one line by default and wraps only where a feature asks`  |
| add `th.name` back to that selector                        | `leaves the row names on one line even in a table that wraps`                  |
| drop the `\|\| null` from the attribute binding            | `marks only the table that asked to wrap, and leaves the others unmarked`      |
| remove `[shouldWrapValues]="true"` from the entry page     | `asks the kit to wrap, since a value here can be several links or a wide unit` |

The last two were also driven in the browser, which is where they say something jsdom cannot:

- **without the `|| null`**, every kit table carries `data-wrap-values="false"`, the rule matches, and all four
  `?kit` tables compute `white-space: normal` at `line-height: 20.3px` instead of `nowrap` at `14px`. The opt-in
  is the attribute's _absence_, not its value, and that is what keeps the other consumers still.
- **without `[shouldWrapValues]="true"`**, the review's blocker returns exactly: **12 of 28** entries overflow at
  1280 × 800, the same twelve the review listed, worst `stage:eukaryote`, and the detail column's `scrollWidth`
  goes to 1706 against `clientWidth` 750.

With both in place, swept over all 28 entries at both sizes: **0 of 28 overflowing, worst 0 px, and no element
under the entry page whose `scrollWidth` exceeds its `clientWidth`.**

The consumer re-check on this head, and exactly which build each figure came from: `?kit` and
`?kit&sheet=collections` were captured on the branch and again with `ui-facts-table.component.{ts,css}` replaced
by `origin/main`'s — **RMSE 0** both, and the same computed figures either side. The hold-Tab affecting panel was
re-measured on the branch only (three tables, `data-wrap-values` absent, `nowrap`, `line-height: 14px`, rows 26 px,
tables 326 px); it shares the one rule the two `?kit` routes pin either side, so nothing about it is taken on
trust beyond that shared rule.
