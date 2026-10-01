# Dive baselines (ticket #797, added in PR #799's round-two review)

The opening dive on the lobby (`docs/rendering/opening-dive.md`), SwiftShader, DPR 1. Each 1280 shot is the stage
alone (758 × 427 CSS px) in a 1280 × 800 viewport, taken after the autoplay reached the phase-1 stop and the upper
bands had baked, then scrubbed to the zoom with the slider (value = 7.4 − zoom) and left 2.5 s to settle. Zoom is
log10 of the view's width in metres. The micro scene's cells drift, so compare the look, not pixel positions.

| File                      | Pins                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `dive-1280-z7.3.png`      | the planet over Eurasia: clouds, atmosphere rim, stars, the EURASIA and AFRICA labels             |
| `dive-1280-z4.0.png`      | the coast where Victoria will be, the rocky point label                                           |
| `dive-1280-z1.5.png`      | the shore at low tide: the tide pool, boulders, the stranded kelp                                 |
| `dive-1280-z-0.3.png`     | the boulder and the kelp's blades                                                                 |
| `dive-1280-z-2.8.png`     | inside the drop: the golden slime, ciliate and copepod larva labels, the edge-of-drop label       |
| `dive-1280-z-3.6.png`     | the kelp's cells under the slime, the dish's pocket, a diatom                                     |
| `dive-1280-z-3.9.png`     | the handoff's start: the game's bacteria as small glassy specks, no far-dot orb (round one's fix) |
| `dive-1280-z-4.1.png`     | mid-handoff: the dish inside the slime's pocket, no seam, no vent, the dish label's lower-case µm |
| `dive-1280-z-4.3.png`     | the phase-1 stop (50 µm): the game's dish, wall and bacteria                                      |
| `dive-1280-z-4.6.png`     | inside the dish: bacteria and food specks, no vent glow                                           |
| `dive-1280-z-5.2.png`     | your cell (dashed ring) and the "YOU: 1.6 µm" label                                               |
| `dive-1280-z-5.6.png`     | the scrub's bottom: your cell fills the view, membrane and cytoplasm crisp at the atlas's bake    |
| `dive-phone390-z-4.3.png` | the whole panel at 390 × 844 at the stop: stage, phase buttons, every second power of ten         |
