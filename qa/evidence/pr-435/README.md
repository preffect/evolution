# Evidence — #385 PR A, the legibility cues

Shot on a private stack from `feat/385-legibility-cues` (server 4610, client 4612), headless Chromium through the
Playwright MCP, room `DzqSb7f6I7` created from the lobby with seed 3255538424. The room was paused and moved only by
`debug_step_room` (at most 20 ticks a step); cells were placed with `debug_set_player` (idle bots as the neighbours) and
motes with `debug_spawn`. Every frame was shot after the client's `renderTick` reached the room's tick plus the paused
extrapolation, and every PNG was looked at before it went in.

## Frames

| File | What it shows |
| --- | --- |
| `worked-moment-1280x800.png` | The audit's worked moment: mass 312 in the vent, Mitochondrion I, touching a Toxin Vacuole I cell, a bigger cell near. Chip `312 ▼ 10/s`; tags `−9.4/s TOXIN` (danger rim), `−0.5/s DECAY` (Mitochondrion ghost, `−15 %`), `−0.3/s VENT` (vent rim), largest nearest the chip; the threat label clear of every pill. |
| `worked-moment-with-zone-pill-1280x800.png` | The same moment right after a re-entry into the vent: all three tags and `● WARM VENT · DECAY ×1.5 · ORANGE RODS` under the orbit. |
| `zone-pill-entry-1280x800.png` | The zone pill on entry with two tags (the toxic contact had just ended that tick). |
| `zone-pill-shallows-up-trend-1280x800.png` | A first entry into the shallows: the green-dot pill, and the chip's **up** trend (`312 ▲ 0.5/s`, green triangle). The threat below flips its label to the far side (the existing `threatLabelPlacement` rule), so it never meets the pill. |
| `zone-pill-yields-to-threat-label-1280x800.png` | The yield rule: a threat to the lower right whose near-side label lands on the pill's box — the pill is hidden while the record still has it up (tick 4345 of its 240-tick window). |
| `zone-pill-yields-control-1280x800.png` | Control for the frame above: the threat moved further out, its label no longer meets the pill, and the pill is back — so it yielded to the label and nothing else. |
| `cap-rate-column-1024x640.png` | The cap on the smallest viewport: mass 4997, a full three-tag column (`−150/s TOXIN`, `−8.5/s DECAY`, `−4.2/s VENT`). The top pill's upper edge is at about y 105 (read from a 2× crop), under the notice stack's 96 — the §3.1.5 inequality's 105.0. |
| `floater-01-eat-1280x800.png` | Floater strip, frame 1: `+1 FOOD` (gain rim) spawned past the chip and tags, just above the 3 o'clock line. |
| `floater-02-eat-rising-1280x800.png` | Frame 2, five ticks on: the same floater about 2 px higher (24 px × 83 ms / 1200 ms ≈ 1.7), same x. |
| `floater-03-merge-1280x800.png` | Frame 3: a second mote eaten 6 ticks (100 ms) after the first merges into `+2 FOOD` — one pill, same x, no push. |
| `floater-04-engulf-1280x800.png` | Frame 4: an engulf payout and later eats: `+18 ENGULF`, `+32 DNA` (DNA rim), `+4 FOOD`, stacked by pushes, all at one x. |
| `floater-05-sprint-1280x800.png` | Frame 5: `−16 SPRINT` (no rim) arrives at the bottom and pushes the three above it one row: four floaters, `FLOATER_MAX_VISIBLE`, no sideways snap. |

## Bench

`bench-cues.md` (the effects stage with and without `?bench&cues=1`, before and after the measuring fix) and the raw
24-frame reports beside it.

## Seen while shooting (for the reviewers)

- **VENT reads `−0.3/s`, where hud.md's example said `−0.2/s`.** The server applies 0.248 and the wire carries it at
  `SNAPSHOT_MASS_RATE_DECIMALS` as 0.25, which the one-decimal cue format rounds to 0.3. The cue shows the number the
  server sent, as §3.1.5 requires, so **the doc's example was corrected in this PR**, not the formatter.
- **The zone pill and a near threat label can sit a few px apart** (`zone-pill-entry`: the pill's bottom and the label's
  top about 3 px apart). Within the rule — the pill hides only when a box meets it — but tight to the eye.
- **The trait picker's dim covers the cues** (a first cap frame was shot under an open level-up offer and retaken after a
  pick). The zone pill hides while an offer is open, as specified; the chip and the tags stay, under the dim.
- Engulf evidence needed the prey's centre inside `predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION`
  (`isEngulfContact`), not just touching — noted so the next evidence session does not step 120 ticks waiting for it.
