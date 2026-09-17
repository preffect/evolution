# #387 — the hold-Tab "affecting you" panel

Four frames, captured on a private stack (ports 4510/4512) so the human's game on 4400/4402 was never touched: the
panel after round one of review, and the two round-one frames the reviewers found the blockers in.

| Frame                                | Viewport   | What it shows                                                                    |
| ------------------------------------ | ---------- | -------------------------------------------------------------------------------- |
| `pr440-affecting-panel-1280x800.png` | 1280 × 800 | The reference viewport of `docs/ui/layout.md` §1, HUD scale 1.                   |
| `pr440-affecting-panel-1024x640.png` | 1024 × 640 | The smallest viewport the layout frame targets, at the `UI_SCALE_MIN` 0.8 floor. |
| `pr440-before-1280x800.png`          | 1280 × 800 | Round one, kept as the before: the two blockers below are visible in it.         |
| `pr440-before-1024x640.png`          | 1024 × 640 | Round one at the scale floor; both defects reproduce identically.                |

## What the round-one frames got wrong, and what the new ones show

| Defect                                                                                                   | Before                           | After                                     |
| -------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------- |
| The `HERE` facts were in the kit's mono `figure` column, which never wraps, so they were cut at the edge | `decay ×1.5 · orange`            | `Warm vent · decay ×1.5 · orange rods`    |
| The same, on the widest line the panel draws                                                             | `8:02 · food ×1.5 · DNA dro`     | `Bloom · 9:18 · food ×1.5 · DNA drops ×2` |
| The trait glyph was sized by nobody, so it collapsed inside the kit's shrink-to-content marker cell      | `app-trait-glyph` measured 0 × 0 | 20 × 20 at scale 1, 16 × 16 at 0.8        |
| The sparkline never appeared: the frozen room held a single mass sample, and it needs two                | no `polyline` in either frame    | 42 points, a run that rises then falls    |

Measured from the live DOM in both new frames, not eyeballed.

## The scene

Staged deterministically through the debug MCP on the private stack, with the room left **running** while Tab was
held so the mass history actually accumulated — the panel is what reads that history, so a room frozen before the
panel opens can never grow one. It was frozen with `debug_pause_room` only once the run was complete, which is why
these frames are reproducible even though the example is self-consuming (contact toxin plus vent-multiplied decay
drains about 10 mass/second).

- Own cell **mass 312** at the dish origin, which is inside the warm vent (`zoneAt`: `distance <= VENT_RADIUS`, 500).
- **Mitochondrion I**, so decay carries its −15 % share.
- A **Toxin Vacuole I** cell (`Bot 0`, mass 96, `idle` so it holds still) at (90, 0). Toxin Vacuole has no aura
  range, so its drain is contact-only: own radius 70.7 + its 39.2 = 109.9 against a 90 wu separation, so the two
  discs genuinely overlap.
- **In bloom**, forced by patching `ROUND_BLOOM_START_FRACTION` to 0 rather than waiting out a round.
- The mass was driven through **250 → 336 → 312** while Tab was held, so the sparkline has a real run to draw.
- The **full leaderboard is open beside it**, which is what the panel opens with.

## What the rows read, and why that is the right answer

Every figure below was rendered by the panel from the live balance, not typed into it:

| Row                           | Rendered                                     |
| ----------------------------- | -------------------------------------------- |
| Mass                          | `312` with its falling trend glyph, `10/s`   |
| `Toxin · near Bot 0`          | `−9.4/s`                                     |
| `Decay · Mitochondrion −15 %` | `−0.5/s`                                     |
| `Vent · decay ×1.5`           | `−0.3/s`                                     |
| `Warm vent`                   | `decay ×1.5 · orange rods`                   |
| `Bloom`                       | `9:18 · food ×1.5 · DNA drops ×2`            |
| `You eat`                     | `≤ 249.8`                                    |
| `Eats you`                    | `≥ 390.4`                                    |
| `Speed`                       | `−50 %`                                      |
| `Mitochondrion I`             | `−15 % mass decay`, marked by its #312 glyph |
| `World`                       | `ahead`                                      |

The two thresholds are the frozen cell's own, not the doc's: the mass is 312.3 under the floor the chip shows as
`312`, so `You eat` is `312.3 / 1.25` floored to `249.8` and `Eats you` is `312.3 × 1.25` ceiled to `390.4`. §3.7's
`249.6` and `390` are the figures at exactly 312. The floor and the ceiling are each pinned by a unit test with its
own counterexample, which is where that contract belongs — a frame cannot show a rounding rule, only one value of it.

The panel is the kit's side panel: `data-variant="side"`, `role="region"`, `aria-label="Affecting you"`, the four
`label` headings `Mass` / `Here` / `Size` / `Traits`, and nothing focusable inside.

## The centre stays clear

Measured from the live DOM at both viewports. The exclusion box is `HUD_PLAYER_EXCLUSION_PX` (120) each way from the
viewport centre, scaled by the HUD's own scale:

| Viewport   | HUD scale | Panel left | Panel right | Width | Exclusion box starts at | Clearance | Clear? |
| ---------- | --------- | ---------- | ----------- | ----- | ----------------------- | --------- | ------ |
| 1280 × 800 | 1.0       | 16         | **376**     | 360   | 520                     | 144 px    | yes    |
| 1024 × 640 | 0.8       | 12.8       | **300.8**   | 288   | 416                     | 115 px    | yes    |

376 against 520 is exactly the figure §3.7 predicts. At 1024 × 640 the panel is 288 px wide — 360 at the
`UI_SCALE_MIN` 0.8 floor — and still clears the box, which is the viewport where the rule is most likely to break.
The e2e spec asserts this as a real rectangle overlap against the same constant, rather than the viewport midpoint
it used to compare against.

## Console

The console errors in every frame are 404s on `/assets/audio/…`. The audio assets are opt-in
(`docs/AUDIO-PIPELINE.md`) and the renderer smoke filters exactly these; there are no page, renderer or HUD errors.
