# The engulf and escape preview scenes (ticket #507, ticket #364 PR 3 of 3)

Headless Chromium against a private dev stack on **4510 / 4512** in this branch's own worktree, `deviceScaleFactor: 2`,
`scale: "device"`: the crops are the evidence route's 360 px lens at 2× (720 px), which is the route's own framing
and not the encyclopedia's 300. Lane 2: one frame per scene.

| Frame                       | Parked at  | What it shows                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `507-engulf-t0.85-crop.png` | t = 0.85 s | the subject as **predator**, 24 ticks into the engulf (progress 0.33, the wrap): the two arms at ±30° closing on the prey, the notch between them, the prey — the second palette, no tail — sunk under the film at the prey angle, the predator's stretch eased to `ENGULF_PREDATOR_SPEED_FACTOR`                                    |
| `507-escape-t1-crop.png`    | t = 1.0 s  | the subject as **prey**, 4 ticks into its sprint (progress 0.22 and falling): the escape arc over the subject draining and `SPRINT TO ESCAPE` above it, the sprint's axial stretch and doubled tail wave pointing away, the predator's arms still closed around it and starting to play backwards, the `DANGER` ring on the predator |

## The choreography, and what is the balance's

Both scenes keep the **subject at the lens centre and move the partner** (`engulf-pair.ts`): the camera parks on the
subject as `ownPlayerId`, so in `engulf` the prey drifts in toward a predator that is really the one swimming, and in
`escape` the predator closes on a resting prey and then falls behind a fleeing one — what the player's own camera
shows.

Everything with a time in it is the simulation's:

| Beat                              | `engulf`                                          | `escape`                                                           | Source                                                                                                                     |
| --------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| masses                            | predator 100, prey 80                             | prey 100, predator 125                                             | `PREVIEW_CELL_MASS` and `ENGULF_MASS_RATIO`: **exactly** the required ratio, so `engulfMassFactor` is 1                    |
| contact                           | tick 27                                           | tick 32                                                            | `predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION` (the server's `contact.ts`), closed at the predator's top speed |
| cover → wrap → seal → payout      | +12 / +36 / +72 ticks                             | +12 / +36 / —                                                      | `engulfPhaseSpanSeconds` × 3 (this PR's shared helper; ticket #362)                                                        |
| the prey reacts                   | never: passive                                    | tick 56 (halfway through the wrap, progress 1/3)                   | `PREVIEW_ESCAPE_SPRINT_AT_WRAP_SHARE` — the one preview number in the timeline                                             |
| decay to the release              | —                                                 | 2/72 a tick, released at tick 63 (progress back in the cover band) | `engulfProgressDelta` for a wrap out of contact; `engulfPhaseOf`                                                           |
| the pair parts                    | —                                                 | 128 wu/s                                                           | prey top speed × `SPRINT_SPEED_MULTIPLIER` × `preyHeldSpeedFactor` − predator top speed × `predatorEngulfSpeedFactor`      |
| `cell_absorbed` / `cell_released` | at the prey, tick 99                              | at the prey (the lens centre), tick 63, reason `escaped`           | where `engulf-payout.ts` and `engulf-state.ts` place them                                                                  |
| `respawn`                         | tick 189, the prey back where it started, same id | —                                                                  | after the `absorbed` clip (600 ms) and a `PREVIEW_ACTION_REST_SECONDS` beat                                                |
| period                            | 267 ticks (4.45 s)                                | 147 ticks (2.45 s)                                                 |                                                                                                                            |

The **timeline is in whole ticks**: an effect lands on a tick and the bodies it removes or returns compare a loop tick
against that same tick (`wholeTicksOf`, `TICK_TOLERANCE`), so the prey leaves on exactly its `cell_absorbed` tick and
returns on exactly its `respawn` tick — the same contract the eat scene keeps with its mote, without leaning on a
duration being a whole number of ticks (ticket #505).

## The framing, measured

Every tick of one loop, against the extents the renderer builds — the membrane from `buildShapeTerms` with the
**engulf arms read off the frame's own cells** (`engulfClipInput`, new to the measurer in this PR), the clips from the
real `MotionClipPlayer`, the sprites from the real `effectPlacements`.

| scene    | lens (wu) | period | worst body | worst drawn | what binds                                                                                         |
| -------- | --------- | ------ | ---------- | ----------- | -------------------------------------------------------------------------------------------------- |
| `engulf` | 198.9     | 267 t  | 0.639      | **0.950**   | the prey's respawn halo (2 r, `haloRadii`) at the start distance, tick 189 — the rim band, exactly |
| `escape` | 206.7     | 147 t  | **0.750**  | 0.829       | the predator's body back at the start distance, tick 147 — the safe band, exactly                  |

Both scenes fill whichever band binds to its fill fraction (0.75 / 0.95), the `cell` family's rule over two bodies.
The pair's framing bounds the partner **twice** — out at the start distance resting, and at the contact reach wearing
the engulf's arms (0.616 r, `engulfDeformationPeak`) — because those are different moments; bounded once, at the start
distance with the arms, the lens would be framed for a frame that never happens.

The subject bodies land at about 0.20–0.22 of the lens radius. That is the two-body composition: the pair spans the
lens, and the entry is about the pair.

## The open cost

One cold open each, `/proc/loadavg` around 8 on the 4-core box (three validate runs beside the capture). SwiftShader,
so the absolute numbers are **unmeasured** until the hardware run (ticket #470); what they show is that a two-cell
scene with the own-cell record is in the same band as PR #500's single-cell ones, not a new cost class.

| scene    | cold `openedToFirstFrameMs` | init / bake / first submit | frame p95 (ms) | `cells` stage (ms) | draw calls |
| -------- | --------------------------- | -------------------------- | -------------- | ------------------ | ---------- |
| `engulf` | 1331.5                      | 297.8 / 385.5 / 647.7      | 71.4           | 5.8                | 10         |
| `escape` | 1999.2                      | 429.4 / 461.7 / 1107.5     | 81.9           | 10.8               | 11         |

No page or console errors on either open (the audio 404s excluded, as usual).

## Checks

- `./validate.sh test --scope shared` — the `engulfPhaseSpanSeconds` unit tests
- `./validate.sh test --scope packages/client/src/app/game/render/preview` — 10 files, 70 tests
- `./validate.sh test --scope packages/client/src/app/game/render/cells` — 25 files, 178 tests
- `./validate.sh test --scope packages/client/src/testing` — 2 files, 22 tests
- `./validate.sh test --scope packages/client/src/app/game/encyclopedia` — 33 files, 399 tests
- `./validate.sh typecheck --scope client`, `lint --scope client`, `duplication --scope client` — green
