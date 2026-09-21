# PR #486 — the preview lens, framed from its subject (ticket #364, the framing half)

Headless Chromium against a private dev stack on **4510 / 4512** in this branch's own worktree,
`deviceScaleFactor: 1`, `scale: "css"` — true size, no zoom. The panel is opened from the **lobby**, so no room is
running behind it. The 1024 × 640 frame is the `UI_SCALE_MIN` floor, where the lens is 240 px.

| Frame                                     | Size       | What it shows                                                                          |
| ----------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `364-entry-mito-before-1280x800.png`      | 1280 × 800 | **before**, on `main` — `trait:mitochondrion` I, a speck in the eyepiece               |
| `364-entry-mito-after-1280x800.png`       | 1280 × 800 | **after** — the same entry, the same viewport, the same page                           |
| `364-entry-mito-after-1024x640.png`       | 1024 × 640 | the same entry at the scale floor: the lens is 240 px, the canvas 240 device px        |
| `364-entry-protocell-after-1280x800.png`  | 1280 × 800 | `stage:protocell` — the worst case before, a cell with no appendages at all            |
| `364-entry-flagellum3-after-1280x800.png` | 1280 × 800 | `trait:simple_flagellum` **III** — the case 4.4 existed for: two tails, inside the rim |
| `364-route-mito-after-1280x800.png`       | 1280 × 800 | the evidence route (`?preview=trait:mitochondrion&t=1`), whose lens is its own 360 px  |

The before frame is not a re-capture: it is `466-lens-live-1280x800.png` from PR #482's own evidence, taken on
`main` at the same entry and the same viewport. Reusing it is what makes the pair comparable — the same page, the
same build of everything but this change.

## The subject, measured in pixels

Not derived from the framing arithmetic — read off the two PNGs above. The lens box is `(521, 113) 300 × 300`, so
its centre is `(671, 263)` and its radius 150 px. Inside 0.90 of that radius (clear of the rim, the reticle and the
vignette, which are DOM SVG drawn over the canvas), the furthest pixel brighter than a luminance threshold:

| threshold | before            | after             | ratio |
| --------- | ----------------- | ----------------- | ----- |
| 90        | 47.4 px (0.316 r) | 93.5 px (0.623 r) | 1.97× |
| 120       | 46.2 px (0.308 r) | 92.9 px (0.619 r) | 2.01× |
| 150       | 45.4 px (0.303 r) | 90.6 px (0.604 r) | 2.00× |

Stable across three thresholds: **2.0× in radius, 3.9× in area.** These are single frames at one phase of the swim
loop, so they sit under the 0.75 the loop's worst tick reaches.

## The framing bands, walked

Every tick of one loop, for every cell spec in `SUBJECT_SPECS`, against the extents the renderer itself builds.
`fill` is `max(body / 0.75, drawn / 0.95)` — how much of its own fill fraction the binding band reached. Both
columns of each pair are measured the same way, so `old` is the old lens re-measured with the fixed appendage
rule, not the number the old spec printed.

| cell (traits at tier)                    | view (wu)     | body old → new  | drawn old → new | fill old → new   |
| ---------------------------------------- | ------------- | --------------- | --------------- | ---------------- |
| protocell, resting                       | 176 → **61**  | 0.2609 → 0.7500 | 0.3131 → 0.9000 | 0.3479 → **1.0** |
| protocell, swimming                      | 176 → **96**  | 0.4092 → 0.7500 | 0.4729 → 0.8667 | 0.5456 → **1.0** |
| prokaryote, resting                      | 176 → **137** | 0.2427 → 0.3124 | 0.7382 → 0.9500 | 0.7770 → **1.0** |
| prokaryote, swimming                     | 176 → **163** | 0.3870 → 0.4166 | 0.8825 → 0.9500 | 0.9289 → **1.0** |
| endosymbiosis, resting                   | 176 → **63**  | 0.2427 → 0.6835 | 0.3374 → 0.9500 | 0.3551 → **1.0** |
| endosymbiosis, swimming                  | 176 → **93**  | 0.3870 → 0.7317 | 0.5025 → 0.9500 | 0.5290 → **1.0** |
| eukaryote, resting                       | 176 → **61**  | 0.2359 → 0.6835 | 0.3279 → 0.9500 | 0.3452 → **1.0** |
| eukaryote, swimming                      | 176 → **91**  | 0.3787 → 0.7328 | 0.4910 → 0.9500 | 0.5168 → **1.0** |
| specialised, resting                     | 176 → **59**  | 0.2473 → 0.7422 | 0.3165 → 0.9500 | 0.3332 → **1.0** |
| specialised, swimming                    | 176 → **92**  | 0.3926 → 0.7500 | 0.4770 → 0.9114 | 0.5234 → **1.0** |
| wild protocell, resting                  | 176 → **61**  | 0.2609 → 0.7500 | 0.3131 → 0.9000 | 0.3479 → **1.0** |
| **`simple_flagellum` III**, swimming     | 176 → **166** | 0.3870 → 0.4103 | 0.8961 → 0.9500 | 0.9433 → **1.0** |
| **`diatom_shell` III** (rigid), swimming | 176 → **86**  | 0.3682 → 0.7500 | 0.4458 → 0.9081 | 0.4909 → **1.0** |

`fill` comes out at **1.0000 on every row**, so the bound is _tight_, not merely safe: every loop is long enough
that some tick lands on the breathing sine's peak, which is the only term `maxReachRadii` samples rather than
bounds.

**The last two rows are new coverage, and they are the two that decide the argument.** `BENCH_STAGE_TRAITS` tops
its flagellum out at tier II, and `diatom_shell` is the ladder's only rigid form — the one path where `restScales`
zeroes the breathing, the jitter and the lobes at once. Both are entries a reader can open, and neither was being
measured.

### Why one constant could not serve the family, quantified

Read the `fill old` column. The old 4.4 scores **0.9433** on the tier-III flagellate — nearly right, because that
is the case it was sized for — and **0.3332** on a specialised cell at rest. One number, a 2.8× spread. The
flagellate's body stays small after the fix too (0.41), and that is correct: its tail is what makes it wide, and
the tail has to stay inside the rim.

This also shows the two bands are **not jointly satisfiable** for a flagellate. Its lens is set by the tail at
0.95 of the rim, which leaves the body at 0.41 — there is no framing that puts a 2-radius tail inside the rim and
a body near 0.8 at the same time. So §12.7's body band is a **ceiling**, not a target, and whichever band binds is
the one to fill. That is the reading this PR builds to and writes into §12.7.

### A defect in the old measurement

`preview-framing.spec.ts` was adding a tier-III **sprinting** flagellum's reach to _every_ cell, including ones
with no tail at all: a bare protocell measured 0.8245 "drawn" with nothing but its halo on screen. That inflated
number is part of why 4.4 looked defensible — it made the rim look nearly full for every cell. `appendageReachRadii`
now asks each cell what it actually has, which is why the `drawn old` column above (0.3131 for that protocell)
disagrees with what the old spec printed.

Two smaller things fixed with it: the cilia reach was being taken as an absolute `CILIA_OUTER_RADII` 1.12 radii
rather than `CILIA_OUTER_RADII − 1` **past the membrane** (`cell-shader-tells.ts`'s own `CILIA_REACH`), and it was
counted for cells with no cilia.

## Guards, verified by breaking them

Each mutation was applied, the spec run, the mutation reverted.

| #   | Mutation                                                | Guard that went red                                                                                      |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| M1  | `peakReachRadii` drops the breathing peak               | `cell-draw-extent.spec.ts` — "is never beaten by a frame the renderer actually builds"                   |
| M2  | the lens goes back to the looseness 4.4 gave it (3.07×) | `preview-framing.spec.ts` — "frame every cell scene no looser than its own contents need"                |
| M3  | the lens frames half as wide as its contents allow      | `preview-framing.spec.ts` — "keep every body inside the safe radius and everything drawn inside the rim" |
| M4  | cilia are given a tail's reach on top of their own      | `cell-draw-extent.spec.ts` — "reaches only just past the membrane for cilia"                             |
| M5  | every tail waves as if it were tier I                   | `cell-draw-extent.spec.ts` — "lengthens the tail with its tier and doubles its wave on a sprint"         |

The failure messages, verbatim:

- **M1** — `protocell at speed 0, tick 1: the renderer reached 1.3549 radii, past the 1.3536 bound the lens is framed from`
- **M2** — `cell (resting) is framed 3.07× looser than its contents need: the body of preview-cell reached 0.244 of the lens radius at tick 13 … expected 0.325732418149424 to be greater than or equal to 0.99`
- **M3** — `cell: the body of preview-cell reached 1.500 of the lens radius at tick 13: expected 1.4999977855780973 to be less than or equal to 0.8`

**M2 and M3 are the pair that matters.** They break the framing in opposite directions, and each fires a
_different_ guard while the other stays green — under M2 both band tests passed, and under M3 the fill guard
passed. Neither test is standing in for the other, and M2 is the original defect reproduced: a body at 0.244.

### Three of these first failed to compile, and so had tested nothing

The first attempt at M2, M4 and M5 removed a symbol's last use and died on `TS6133`. Each run printed **no test
lines at all** and was scored as "the guard fired" by nothing but the non-zero exit. They were rewritten to keep
every symbol used, and the runner now says `BUILD FAILED — this mutation TESTED NOTHING` when a run produces no
`Tests` line. The M1 and M3 results above were green-to-red on a build that compiled both times.

### What these guards do not cover, said plainly

`cell-scene.ts` and `preview-framing.spec.ts` share `appendageReachRadii`, so a wrong tail length moves the lens
and the measurement together and the bands stay green — M4 and M5 are caught by the unit spec, not by the framing
spec. That is the price of the two not keeping private copies of how long a tail is, and it is why the appendage
function has its own direct tests. The membrane half is **not** shared: the framing spec measures `buildShapeTerms`
per tick while the scene frames by the bound, which is what M1 and M3 exercise.

## A tripwire left behind for #192–#196

`evaluateProfile` is `radius × pulse × form.evaluate(Δ) × stretch × surface`, but `maxReachRadii` has **no form
term**. That is exact only because every entry in `FORM_PROFILES` still returns `null` from `profileAt` — every
form draws the blob, `B ≡ 1`. The day a silhouette registers a real `B(Δ)` that peaks above 1, the membrane will
reach further than `maxRadii` reports: the in-game cell quad will clip it and so will this lens.

`cell-draw-extent.spec.ts` now fails on that commit, naming the trait and the tier, rather than leaving it to turn
up in a screenshot. This is pre-existing and not introduced here — the lens inherits it from the quad extent.

## Cost

| Spec                       | Tests | Wall   |
| -------------------------- | ----- | ------ |
| `preview-framing.spec.ts`  | 3     | 426 ms |
| `cell-draw-extent.spec.ts` | 8     | 478 ms |

`preview-framing.spec.ts` was 4569 ms before ticket #363's memoisation and once timed out at vitest's 5000 ms
default, so the budget mattered here: the fill guard reuses the memoised walk the band test already does, so it
added a third test and no third walk, and two more specs went into `SUBJECT_SPECS` at 426 ms total. The bound
sweep in `cell-draw-extent.spec.ts` is 241 ticks × 5 stages × 2 speeds of real shape terms, with the strip row
held fixed because a separate test pins that the reach does not depend on it — sweeping all 16 rows would have
multiplied the cost for nothing.
