# Ticket #443 — one live floater per cause (PR #485)

How it was captured: a private stack on 4510 / 4512 (never 4400 / 4402; port ownership checked via
`/proc/<pid>/cwd`), Playwright Chromium at 1280 × 800 and at the 1024 × 640 floor, `scale: 'css'` so
every frame is true size. Each "pickup" is one algae mote spawned onto the own cell through
`debug_spawn`, eaten on the next tick. Nothing is paused: these are live frames, and the timings
below are wall-clock, so treat them as approximate.

The **before** rows are `main`'s `floater-stack.ts` and `legibility-cues.ts` checked out into the
same running client — the two rows differ only in this PR's behaviour, not in scene, cell, spawn
point or cadence.

## The sheets

| File                       | What it settles                                    | Read it for                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clutter-before-after.png` | The ask: "less clutter please"                     | Three moments at the same mass readings (24 / 28 / 31). `main` above: two or three identical `+1 FOOD` pills stacked at every moment. This branch below: one pill.                                                                          |
| `counter-climbs.png`       | That the count climbs **in place**                 | One pickup every ~420 ms, four frames: `+1`, `+2`, `+2`, `+3`, the pill at one x throughout.                                                                                                                                                |
| `late-increment-fade.png`  | **Decision 1's written-down cost** (hud.md §3.1.5) | A third pickup merged into a pill already in its fade. The same `+3` read at four points down the fade (alpha ≈ 0.58, 0.34, 0.03, gone): the number changes, and the pill keeps fading on its own curve instead of flicking back to bright. |
| `hero-1280x800.png`        | True size, full frame                              | Five pickups, one `+5 FOOD` pill.                                                                                                                                                                                                           |
| `floor-1024x640.png`       | The smallest supported viewport                    | Six pickups, one `+6 FOOD` pill; the cue column still clears the notice stack.                                                                                                                                                              |

## `frames/`

Every frame of all four runs, cropped to the cell and its cue column (the crop is the only edit; the
full frames are not kept, since at this scale the rest of the viewport is empty dish).

| Prefix              | Run                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| `crop-before-00…05` | `main`'s behaviour, two pickups ~350 ms apart per frame                                             |
| `crop-after-00…05`  | this branch, the identical cadence in the same scene                                                |
| `crop-climb-00…07`  | this branch, one pickup every ~420 ms — the source of `counter-climbs.png`                          |
| `crop-fade-00…03`   | this branch, two pickups then a third landing in the fade — the source of `late-increment-fade.png` |

`crop-before-NN` and `crop-after-NN` are the same moment of the two runs, so they can be read as
pairs.
