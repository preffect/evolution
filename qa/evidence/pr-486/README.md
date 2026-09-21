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
| `swim-loop/364-swim-loop-four-phases.png` | 4 × 360 px | ticket #488's orbit at four quarter phases of its 2.05 s lap                           |

The before frame is not a re-capture: it is `466-lens-live-1280x800.png` from PR #482's own evidence, taken on
`main` at the same entry and the same viewport. Reusing it is what makes the pair comparable — the same page, the
same build of everything but this change.

## The subject, measured in pixels

Read off the two PNGs above, not derived from the framing arithmetic. The lens box is `(521, 113) 300 × 300`, so
its centre is `(671, 263)` and its radius 150 px; everything is measured inside 0.90 of that radius, clear of the
rim, the reticle and the vignette, which are DOM SVG drawn over the canvas.

**Half the bright-pixel bounding box — the membrane's own drawn radius:**

| threshold | before            | after             | ratio                    |
| --------- | ----------------- | ----------------- | ------------------------ |
| 90        | 35.5 px (0.237 r) | 49.0 px (0.327 r) | 1.38× radius, 1.91× area |
| 120       | 35.0 px (0.233 r) | 49.0 px (0.327 r) | 1.40× radius, 1.96× area |
| 150       | 35.0 px (0.233 r) | 48.5 px (0.323 r) | 1.39× radius, 1.92× area |

Stable across three thresholds: **1.39× in radius, 1.93× in area.**

### Why this is not the 2.0× / 3.9× an earlier revision of this file reported

Two things changed, and only one of them is the picture.

**The metric was wrong for the question.** The earlier number was the _furthest_ bright pixel from the lens
centre, which is the **band** — the subject's own reach plus how far its orbit carries it. That is 0.75 of the
lens radius by construction whatever the orbit is, so it could not see a change in orbit at all. Measuring half
the bright-pixel bounding box measures the subject. The old figure was not wrong about the band; it was answering
a different question from the one the headline asks. (PR #482's reviewer independently reproduced the old number
at 0.636 r, which is consistent — same metric, same frame.)

**And the orbit changed**, which is the real halving: ticket #488 took the swim loop from 0.4 to 1.2 radii, so the
lens grew to hold the wider circle and the subject shrank inside it. At the 0.4 orbit this fix gave about 2.1× in
radius; at 1.2 it gives 1.39×. That is the human's decision and its cost, both measured.

## The framing bands, walked

Every tick of one loop, for every cell spec in `SUBJECT_SPECS`, against the extents the renderer itself would
build — the membrane from the real `buildShapeTerms`, the tail from the real `flagellumPolyline` over the same
terms. `fill` is `max(body / 0.75, drawn / 0.95)`: how much of its own fill fraction the binding band reached.

| cell (traits at tier)                    | tail | view (wu) | body   | drawn  | fill       |
| ---------------------------------------- | ---- | --------- | ------ | ------ | ---------- |
| protocell, resting                       | —    | 61        | 0.7500 | 0.9000 | **1.0000** |
| protocell, swimming                      | —    | 139       | 0.7500 | 0.8308 | **1.0000** |
| prokaryote, resting                      | yes  | 137       | 0.3124 | 0.8852 | 0.9318     |
| prokaryote, swimming                     | yes  | 197       | 0.5078 | 0.8060 | 0.8485     |
| endosymbiosis, resting                   | —    | 63        | 0.6835 | 0.9500 | **1.0000** |
| endosymbiosis, swimming                  | —    | 133       | 0.7500 | 0.9023 | **1.0000** |
| eukaryote, resting                       | —    | 61        | 0.6835 | 0.9500 | **1.0000** |
| eukaryote, swimming                      | —    | 132       | 0.7500 | 0.9002 | **1.0000** |
| specialised, resting                     | —    | 59        | 0.7422 | 0.9500 | **1.0000** |
| specialised, swimming                    | —    | 135       | 0.7500 | 0.8603 | **1.0000** |
| wild protocell, resting                  | —    | 61        | 0.7500 | 0.9000 | **1.0000** |
| **`simple_flagellum` III**, swimming     | yes  | 200       | 0.5013 | 0.7968 | 0.8387     |
| **`diatom_shell` III** (rigid), swimming | —    | 129       | 0.7500 | 0.8559 | **1.0000** |

Every row **without a tail** fills **1.0000**: the bound is tight, and since the tail is now measured rather than
taken from that bound, the figure is not a tautology.

**The tailed rows do not, and the gap is a real finding.** `appendageReachRadii` roots the tail on the cell's
_widest_ membrane; `cell-layer.ts` roots the drawn tail on the membrane **at the rear**, which the speed stretch
tapers. The bound is safe but loose — 1.07× at rest, **1.19× at speed** — so a tailed cell is framed smaller than
it needs to be. `preview-framing.spec.ts` carries that as a named `TAIL_BOUND_SLACK` applied only to tailed rows,
with **ticket #491** to tighten it; a tail-less row still has to fill exactly. Deferred rather than fixed here
because it moves every tailed row by about a fifth, which would be a third framing change landing alongside
ticket #488's orbit.

**Two rows are new coverage**, and they are the two that decide the argument: `BENCH_STAGE_TRAITS` tops its
flagellum out at tier II, and `diatom_shell` is the ladder's only rigid form — the one path where `restScales`
zeroes the breathing, the jitter and the lobes at once. Both are entries a reader can open, and neither was being
measured.

### What is measured and what is not

Everything above is the drawing, with one exception: the **cilia** reach is the membrane (measured) plus
`CILIA_OUTER_RADII − 1`, read from the same render constant the shader compiles in. Cilia never bind a lens in
practice — a tail or the halo always reaches further — but that one term is a constant rather than a measurement,
and it is named here so the table is not read as more than it is.

### Why one constant could not serve the family

The old 4.4 scored **0.9433** on the tier-III flagellate — nearly right, because that is the case it was sized for
— and **0.3332** on a specialised cell at rest. One number, a 2.8× spread. That is what sets
`MEASURED_FILL_FLOOR` at 0.99 rather than something more comfortable: a floor at or under 0.9433 would let a
revert to 4.4 through on exactly the row it was tuned for.

This also shows the two bands are **not jointly satisfiable** for a flagellate: its lens is set by the tail, which
leaves the body well under half. So §12.7's body band is a **ceiling**, not a target, and whichever band binds is
the one to fill — the reading this PR writes into §12.7, with the reason, so it is not later "fixed" toward 0.8.

### A defect in the old measurement

`preview-framing.spec.ts` was adding a tier-III **sprinting** flagellum's reach to _every_ cell, including ones
with no tail: a bare protocell measured 0.8245 "drawn" with nothing but its halo on screen. That inflated number
is part of why 4.4 looked defensible — it made the rim look nearly full for everything. Two smaller things fixed
with it: the cilia reach was taken as an absolute `CILIA_OUTER_RADII` 1.12 radii rather than
`CILIA_OUTER_RADII − 1` **past the membrane**, and was counted for cells with no cilia.

## The swim loop (ticket #488, option B)

`PREVIEW_SWIM_RADIUS_RADII` 0.4 → **1.2**, the human's decision. The lap is `2πR / maxSpeedForMass(100)` — the
cell walks its circle at its **own top speed**, so the stretch, the flagellum wave and the cilia beat all read the
speed ratio the simulation would have given it, and widening the orbit is the only way to slow it that keeps them
agreeing. The lap goes **0.683 s → 2.050 s**; the orbit is 48.0 wu.

`364-swim-loop-four-phases.png` is the loop at four quarter phases (t = 0.256 / 0.769 / 1.281 / 1.794 s).

The cost is in the table above and was accepted knowingly: the lens grows to hold the wider circle, so a
protocell's own radius falls from about 0.52 to 0.37 of the lens, and this fix's headline goes from ~2.1× to
1.39×. `preview-scene.spec.ts`'s "swims at the full speed ratio at every tick" was **re-run, not assumed**, and
still holds — it is about velocity, which option B does not change.

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
