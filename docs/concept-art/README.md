# Concept art

Code-drawn concept sheets for Evolution. Every sheet is a single hand-authored SVG (gradients,
filters, layered shapes, no embedded rasters) with a PNG render committed next to it. They exist
so the look is fixed before the Pixi renderer is built and so the shapes can evolve into the real
code-drawn assets (`ASSET-GENERATION.md`).

Render a sheet with headless Chromium at board size (Playwright's bundled build lives under
`/opt/playwright/`):

```bash
/opt/playwright/chromium-*/chrome-linux64/chrome --headless=new --no-sandbox --disable-gpu \
  --hide-scrollbars --window-size=1920,1080 --screenshot=docs/concept-art/<sheet>.png \
  file://$PWD/docs/concept-art/<sheet>.svg
```

## `motion-and-hud.svg` — motion studies and HUD (#106)

1920 × 1080 board. Left column: three 6-keyframe strips for the player actions; right column: the
in-game HUD and the level-up trait picker composed over a play-scale dish scene at 0.37 scale.

### Strips (keyframes, easing, durations)

| Strip                                            | Total   | Keyframes (t)                                                                      | Easing per tween                                                                              |
| ------------------------------------------------ | ------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **A · Eat** (small mote, interruptible)          | 300 ms  | approach 0 → contact 50 → wrap 100 → pulse 160 → absorb 220 → settle 300           | ease-out-quad 100 · ease-out-back 60 · linear 60 · ease-in-out-sine 80                        |
| **B · Engulf** (prey cell, predator −40 % speed) | 1200 ms | contact 0 → wrap 300 → seal 600 → dissolve 800 → DNA streams 1000 → done 1200      | ease-out-cubic 300 · ease-in-out-quad 300 · linear 200 · ease-in-quad 200 · ease-out-back 200 |
| **C · Level-up** (not interruptible)             | 900 ms  | ring full 0 → anticipate 120 → burst 250 → nucleus 450 → settle 700 → new form 900 | ease-in-quad 120 · ease-out-expo 130 · ease-out-cubic 200 · ease-in-out-sine 250 · linear 200 |

Membrane deformation values (fraction of the cell radius `R`):

- Eat: velocity stretch 1.07 × 0.95; contact dimple −12 % (σ 22°); wrap bulge +14 % (σ 30°);
  pulse scale 1.09 with a halo at 1.5 R; settle returns to 1.00 through a ring at 1.5 R.
- Engulf: two pseudopod arms +62 % at ±30° (σ 16°) with a −10 % notch between them; seal bulge
  +60 % (σ 42°) relaxing 0.60 → 0.42 → 0.22; prey rim becomes a `5 6` dash and its cytoplasm
  drops to 50 % before three helix fragments stream into the nucleus. The prey is drawn _under_
  the predator membrane from the wrap frame on, so the translucent cytoplasm shows it inside.
  The escape window closes at the seal frame.
- Level-up: anticipation squash 0.90, burst scale 1.14 with 16 rays (1.2 R → 1.95 R) and a white
  shock ring at 1.6 R, nucleus flash then the tier-2 nucleus pattern (inner ring + two lobes),
  three dish ripples at 1.7 / 2.1 / 2.5 R, then the DNA ring resets and the picker opens.

### HUD (panel D)

- Top-left: level ring radius 34 (5 px stroke, `#d36bff` on `#132238` track) around the level
  number, mass readout next to it, DNA percentage line under it.
- Top-right: leaderboard 146 × 112, five rows with player swatches, own row tinted `#5ce9ff` 12 %.
- Bottom-left: minimap radius 46 with dish edge, zone tints and cell dots.
- Bottom-centre: trait strip, five 32 px slots (empty slots dashed), label above the panel.
- Bottom-right: round timer and the two key hints.
- Engulf warning: `#ff5470` dashed circle (6 5) at 64 px around any cell that can engulf you.
- Nothing is drawn within ±120 px of the player cell.

### Trait picker (panel E)

Dish dims to 55 % black but keeps simulating; three 152 × 226 cards (rounded 14) with a 68 px
icon medallion, category, name, two-line effect, rarity chip and a key chip `1` `2` `3` under
each. The hovered/highlighted card lifts 10 px and glows in its accent colour. A 10 s gold timer
bar sits under the title; at 0 s the highlighted card is auto-picked. The player cell stays
visible left of the cards with the hovered trait previewed on it.

### Palette

| Role         | Hex                        | Role                   | Hex                               |
| ------------ | -------------------------- | ---------------------- | --------------------------------- |
| player rim   | `#5ce9ff`                  | player cytoplasm       | `#1a7d9a` (deep `#0b3d52`)        |
| nucleus      | `#39c2e6` (core `#e8fbff`) | prey rim               | `#ffb64d`                         |
| rival rim    | `#ff6fb1`                  | rival 2 rim            | `#9cff7a`                         |
| food · green | `#7dff8a`                  | food · amber           | `#ffc857`                         |
| DNA          | `#d36bff` (deep `#6b2ea6`) | level gold             | `#ffe08a`                         |
| danger       | `#ff5470`                  | dish deep / mid / edge | `#03060e` / `#071224` / `#0b1c34` |
| panel rim    | `#173250`                  | text / label / muted   | `#dfeaf2` / `#8fb3c9` / `#7f93a8` |

Cell layer stack (back to front): halo at 1.55 R, cytoplasm radial gradient, clipped inner rim,
organelles (5), cytoplasm specks, nucleus halo + nucleus + highlight, bright rim stroke (5.5 % of
R, min 1.6 px, soft glow), hairline white rim, glint. Motes are core + soft halo + wide halo +
glint. Membranes are 36-point Catmull-Rom loops with Gaussian radial bumps, so the same numbers
transfer directly to a Pixi `Graphics` soft body.
