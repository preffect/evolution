# #387 — the hold-Tab "affecting you" panel

Two frames of the panel at the audit's worked example (`docs/ui/overlays.md` §3.7), captured on a private stack
(ports 4500/4502) so the human's game on 4400/4402 was never touched.

| Frame                                | Viewport   | What it shows                                                       |
| ------------------------------------ | ---------- | ------------------------------------------------------------------- |
| `pr387-affecting-panel-1280x800.png` | 1280 × 800 | The reference viewport of `docs/ui/layout.md` §1, HUD scale 1.      |
| `pr387-affecting-panel-1024x640.png` | 1024 × 640 | The smallest viewport the layout frame targets, at the scale floor. |

## The scene

Staged deterministically through the debug MCP on the private stack, then frozen with `debug_pause_room` so the
frames are reproducible (the worked example is self-consuming: contact toxin plus vent-multiplied decay drains about
10 mass/second, so mass 312 evaporates in seconds if the room is left running).

- Own cell **mass 312** at the dish origin, which is inside the warm vent (`zoneAt`: `distance <= VENT_RADIUS`, 500).
- **Mitochondrion I**, so decay carries its −15 % share.
- A **Toxin Vacuole I** cell (`Bot 0`, mass 96) at (90, 0). Toxin Vacuole has no aura range, so its drain is
  contact-only: own radius 70.7 + its 39.2 = 109.9 against a 90 wu separation, so the two discs genuinely overlap.
- **In bloom**, forced by patching `ROUND_BLOOM_START_FRACTION` to 0 rather than waiting out a round.
- The **full leaderboard is open beside it**, which is what the panel opens with.

## What the rows read, and why that is the right answer

Every figure below was rendered by the panel from the live balance, not typed into it. They match §3.7's worked
example:

| Row                           | Rendered                                     |
| ----------------------------- | -------------------------------------------- |
| Mass                          | `312` with its trend glyph, `10/s`           |
| `Toxin · near Bot 0`          | `−9.4/s`                                     |
| `Decay · Mitochondrion −15 %` | `−0.5/s`                                     |
| `Vent · decay ×1.5`           | `−0.3/s`                                     |
| `Warm vent`                   | `decay ×1.5 · orange rods`                   |
| `Bloom`                       | `8:02 · food ×1.5 · DNA drops ×2`            |
| `You eat`                     | `≤ 249.6`                                    |
| `Eats you`                    | `≥ 390.1`                                    |
| `Speed`                       | `−50 %`                                      |
| `Mitochondrion I`             | `−15 % mass decay`, marked by its #312 glyph |
| `World`                       | `ahead`                                      |

The panel is the kit's side panel: `data-variant="side"`, `role="region"`, `aria-label="Affecting you"`, the four
`label` headings `Mass` / `Here` / `Size` / `Traits`, and nothing focusable inside.

## The centre stays clear

Measured from the live DOM rather than eyeballed, at both viewports:

| Viewport   | Panel left | Panel right | Width | Exclusion box starts at | Clear? |
| ---------- | ---------- | ----------- | ----- | ----------------------- | ------ |
| 1280 × 800 | 16         | **376**     | 360   | 520                     | yes    |
| 1024 × 640 | 13         | **301**     | 288   | 392                     | yes    |

376 against 520 is exactly the figure §3.7 predicts. At 1024 × 640 the panel is 288 px wide — 360 at the
`UI_SCALE_MIN` 0.8 floor — and still clears the box, which is the viewport where the rule is most likely to break.

## Console

45 console errors in both frames, every one a 404 on `/assets/audio/…`. The audio assets are opt-in
(`docs/AUDIO-PIPELINE.md`) and the renderer smoke filters exactly these; there are no page, renderer or HUD errors.
