# The eat, sprint and level-up preview scenes (ticket #364, PR 2 of 3)

Headless Chromium against a private dev stack on **4510 / 4512** in this branch's own worktree,
`deviceScaleFactor: 1`, `scale: "css"`. The evidence route draws its lens at 360 px, which is its own framing and
not the encyclopedia's 300.

| Frame                            | Parked at  | What it shows                                                             |
| -------------------------------- | ---------- | ------------------------------------------------------------------------- |
| `364-action-scenes-1280x800.png` | —          | all three side by side, the lenses cropped to compare                     |
| `364-eat-1280x800.png`           | t = 1.2 s  | the mote swallowed, the eat halo ring, the dimple and wrap at the mouth   |
| `364-sprint-1280x800.png`        | t = 0.2 s  | mid-sprint: the self ring's bright arc on the membrane, the axial stretch |
| `364-level-up-1280x800.png`      | t = 1.35 s | the burst — rays, shock ring and three gold ripples                       |

**The dashed circle in the eat and sprint frames is the own cell's self ring** (`cell-shader-membrane.ts`: "the
own cell's dashed, slowly rotating ring … its alpha is the sprint ring"), and its solid bright arc in the sprint
frame is the recharged share. It is the proof the `ownPlayerId` wiring works: the own-cell indicators draw for
that player and nobody else, so a scene that left `subjectPlayerId` null would render the sprint without the ring
it exists to show.

## The framing, measured

Every tick of one loop, against the extents the renderer actually builds — the membrane from `buildShapeTerms`,
the clips from the real `MotionClipPlayer` fed the scene's own effects, the sprites from the real
`effectPlacements`.

| scene      | lens (wu) | period | worst body | worst drawn | at tick                   | fill   |
| ---------- | --------- | ------ | ---------- | ----------- | ------------------------- | ------ |
| `eat`      | 153.1     | 120 t  | 0.3772     | 0.9468      | 74 — 8 t into the clip    | 0.9966 |
| `sprint`   | 157.5     | 210 t  | 0.3505     | 0.9498      | 0 — the sprint's stretch  | 0.9998 |
| `level_up` | 196.1     | 162 t  | 0.2473     | 0.9425      | 107 — 53 t into the burst | 0.9922 |

**These ticks are the evidence the clips are really being measured.** `eat`'s worst tick is 8 ticks _after_ its
effect fires, `level_up`'s is 53 ticks into a burst that starts at tick 54 — neither is a resting frame. And
`level_up`'s lens is **28 % wider** than `eat`'s for the same cell, which is the outermost ripple at more than
three radii and nothing else.

`level_up`'s body is only 0.25 of the lens, and that is the composition the entry wants: the entry is about the
burst, so the burst sets the lens and the cell sits inside it.

### The subject carries a flagellum, and it costs

`PREVIEW_ACTION_SUBJECT_TRAITS` gives all three scenes the same tier-II flagellate, so a reader comparing `eat`
with `sprint` sees one creature doing two things. The tail is about 2.2 radii, so it — not the body, and not the
eat halo — is what binds `eat`'s and `sprint`'s lens, leaving their bodies at 0.35–0.38.

That is a deliberate trade and worth a reviewer's eye: dropping the flagellum would roughly double the body, and
would cost the speed stretch's clearest read and the sprint's doubled tail wave. The frames above are the
argument; if graphics-qa disagrees, the change is one constant.

## The open cost

The first preview scenes to emit effects, so the first to exercise that path. `?preview=level_up&opens=20`,
`cat /proc/loadavg` = **6.54 6.39 6.73**.

|                        | cold open                              | warm opens (19)                        |
| ---------------------- | -------------------------------------- | -------------------------------------- |
| `openedToFirstFrameMs` | **577.4**                              | min 252.2 · mean 341.5 · **p95 472.9** |
| split                  | init 183.5 · bake 272.3 · submit 121.5 | the bake is **51.7 %** of the open     |

Preview frame p95: **9.32 ms** against a 1 ms budget; 60 walk frames.

**Emitting effects does not move the open cost**, which is the thing this measurement was for. Against the
numbers already on record — ticket #363's 337 ms (`zone`) and 786 ms (`cell`), and PR #482's route run at cold
1058 / warm p95 541 with the bake at 65 % — an effect-emitting scene opens _faster_, not slower, and its bake
share is lower (ticket #442 having since split the bake). That is expected: effects are per-frame scene output,
not open work. Nothing here is a regression to chase.

Both budgets are still missed, as they have been on every run in this container. The browser is SwiftShader, a CPU
rasteriser; `rendering/budget.md §7` records the absolute numbers as **unmeasured** until the hardware run
(ticket #470). Nothing in this PR judges them.

## Guards verified by breaking them

| Mutation                                                        | Guard that went red                                                                                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PreviewLocalClock.restartScene` moves the clock, not the phase | `preview-clip-swap.spec.ts` — **both** tests: the clip is stranded (`expected 1 to be +0`) and the render tick goes backwards (`expected 0 to be >= 24`) |

**The first version of the pruning test passed under that mutation.** It started its clip at render time zero, so
a clock reset still left `nowMs − startMs` positive and the clip pruned anyway — a test named for the defect that
could not see it. It now starts the clip 5 s in, which is what puts a reset _behind_ the clip's start. The
mutation was re-run to confirm both halves go red.
