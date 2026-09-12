# PR #251 evidence: nucleus shading at the large tier as a shader radial ramp (#248, decision #231)

Seed 42, SwiftShader, the private stack of the worktree (server 4510, client 4512). Every shot: the room paused
with `debug_pause_room`, the cell set with `debug_set_player` (level 5, traits `nucleoid` + `ribosomes` +
`mitochondrion` + `nuclear_envelope`, so the stage is `eukaryote`), one `debug_step_room`, the client caught up
at 640 × 400 and then resized for the shot with its own loop paused (`__evolutionDebug.pause()`). The Coral cell
is an idle bot (`debug_spawn_bot`, avatar 1) given the same level, traits and mass and placed beside the own cell.
The camera is mass-driven (`CAMERA_VIEW_RADII` 12 r, floor 300 wu, ceiling 1500 wu), so the large tier is reached
by the viewport height, not by the zoom floor: at mass ≈ 4 820 (r 278 wu; the 5 000 set decayed while the room ran
for the camera to settle) the view is the 1 500 wu ceiling and a 1 600 px tall viewport gives 0.53 px/wu, r ≈ 148 px.

| File                                         | Viewport    | Cells                                         | r on screen                     | What to look at                                                                                                                      |
| -------------------------------------------- | ----------- | --------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `protocell-no-nucleus-zoom1.8-1920x1080.png` | 1920 × 1080 | own protocell at spawn (mass 20)              | 32 px                           | `nucleusDiscRadii` 0: no disc, the band returns early; the protocell stack is unchanged                                              |
| `cyan-coral-r44-zoom1.8-1920x1080.png`       | 1920 × 1080 | own Cyan + Coral bot, mass 37                 | 44 px                           | play scale: the 13 px nucleus turns pale (toward −135°) to dark with the rim, chromatin and nucleolus over it                        |
| `cyan-coral-r148-zoom0.53-1920x1600.png`     | 1920 × 1600 | own Cyan + Coral bot, mass ≈ 4 820            | ≈ 148 px                        | large tier: the analytic ramp at r_n ≈ 44 px, no upsampling; per palette from the palette texture (Cyan, Coral)                      |
| `large-tier-vs-sheet01-panelA.png`           | crops       | Cyan render · sheet 01 panel A · Coral render | 148 px (sheet scaled 128 → 148) | the pale-to-dark turn of panel A's `nuc-cyan` gradient, same focus side; the sprite's rim, chromatin and nucleolus sit over the ramp |
| `play-scale-vs-sheet01-panelA.png`           | crops × 3   | Cyan render · sheet 01 panel A · Coral render | 44 px (sheet scaled 128 → 44)   | the same turn at the size the own cell has for most of a round                                                                       |

Round two (head after the review fixes): the four cell shots above are re-shot on a fresh room with the rim-tinted
sprite, the halo cut out inside the disc and #246's motes in the field. Probes on the Cyan cell at r 148 px (r_n 44 px,
sRGB luminance): nucleolus centre `#a6f4ff` L 0.90 against the ramp focus `#a3f0fb` L 0.88 (the nucleolus is lighter
than its surround again), lit edge 0.85 r_n toward the light `#76d9ea` L 0.77, dark edge 0.85 r_n away `#288695` L 0.45
(`nucleusDark` `#167787` is L 0.39; the residual is the 0.92 alpha over the cytoplasm ramp and the last 0.11 of the
smoothstep). Frame time: `docs/RENDERING.md §7`'s bench route and `performanceReport()` are not in main yet (#206 /
#208), so there is no harness line; the client showed no page or shader errors (console: the opt-in audio 404s only).
