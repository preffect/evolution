# Cell material baselines (#215, PR #228 at cdd6ba1)

Seed 42, 1920 × 1080, SwiftShader, the own cell promoted to level 5 (`nucleoid`, `ribosomes`,
`mitochondrion`, `nuclear_envelope`) with `debug_set_player`. All frames carry the screen vignette
darkening of #229 (≈ 0.45 of the true colour); compare shapes, layers and relative brightness, not
absolute levels, until #229 lands and these are re-shot.

| File                                             | Pins                                                                                                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `own-cell-rest-zoom1.8-seed42.png` / `-crop.png` | the eleven-layer stack at rest, r 32 px: halo, ramp, mottle (`rimMix` 0.7), lipids + one mitochondrion, nucleus 0.30 r offset toward the light, inner edge, soft rim, rim light with the hairline, glint, seat bead at −135°, self ring at 1.12 r |
| `mid-lod-nucleus-crop.png`                       | mid LOD 8–20 px: the nucleus / nucleoid disc kept (`CellLod.nucleusBlend`), interior organelles faded, seat beads countable                                                                                                                       |
| `own-cell-r100-crop.png`                         | mass 5000 at zoom 0.36 (r ≈ 100 px): the mottle averages under the mipmapped tile, no repeating pattern                                                                                                                                           |
| `protocell-at-spawn-zoom1.8-crop.png`            | the stage-0 stack: double film, @40 % outline, glint, granules, no nucleus                                                                                                                                                                        |

Not yet pinned: zoom 1.0 (the pre-fix crop predates the mipmapped tile), the far dot, trait tells
(#216), clips and the warning ring (#207). graphics-qa adds them with those PRs.
