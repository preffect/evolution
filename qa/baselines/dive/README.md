# Dive baselines (ticket #797, added in PR #799's round-two review; retaken for ticket #805, on the GPU for ticket #804)

The opening dive on the lobby (`docs/rendering/opening-dive.md`), on the GPU (a GTX 1080 Ti, ANGLE / Vulkan), DPR 1.
Taken on the GPU since ticket #804: under software GL the resolution governor drops the canvas to its floor (0.35), so
a SwiftShader shot shows the governed look, not the dive's. Every shot here drew at a canvas ratio of 1. Retake them
with `capture.cjs` (`CLIENT_DIR=packages/client node qa/baselines/dive/capture.cjs <client port> qa/baselines/dive`) on
a box with a GPU, and check that the renderer line it prints names the GPU, not SwiftShader. Each 1280 shot is the stage
alone (830 × 467 CSS px, the right-hand column since ticket #805) in a 1280 × 800 viewport, taken after the autoplay
reached the phase-1 stop and the upper bands had baked, then scrubbed to the zoom with the slider (value = 7.4 − zoom) and left 2.5 s to settle. Zoom is
log10 of the view's width in metres. The micro scene's cells drift, so compare the look, not pixel positions.

| File                      | Pins                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `dive-1280-z7.3.png`      | the planet over Eurasia: clouds, atmosphere rim, stars, the EURASIA and AFRICA labels                             |
| `dive-1280-z4.0.png`      | the coast where Victoria will be, the rocky point label                                                           |
| `dive-1280-z1.5.png`      | the shore at low tide: the tide pool, boulders, the stranded kelp                                                 |
| `dive-1280-z-0.3.png`     | the boulder and the kelp's blades                                                                                 |
| `dive-1280-z-2.8.png`     | inside the drop: the golden slime, ciliate and copepod larva labels, the edge-of-drop label                       |
| `dive-1280-z-3.6.png`     | the kelp's cells under the slime, the dish's pocket, a diatom                                                     |
| `dive-1280-z-3.9.png`     | the handoff's start: the game's bacteria as small glassy specks, no far-dot orb (round one's fix)                 |
| `dive-1280-z-4.05.png`    | the dish and diatom labels apart, the dish's box clear of the readout's longest line (#805)                       |
| `dive-1280-z-4.1.png`     | mid-handoff: the dish inside the slime's pocket, no seam, no vent, the dish label's lower-case µm                 |
| `dive-1280-z-4.3.png`     | the phase-1 stop (50 µm): the game's dish, wall and bacteria                                                      |
| `dive-1280-z-4.6.png`     | inside the dish: bacteria and food specks, no vent glow                                                           |
| `dive-1280-z-5.2.png`     | your cell (dashed ring) and the "YOU: 1.6 µm" label                                                               |
| `dive-1280-z-5.6.png`     | the scrub's bottom: your cell fills the view, the readout on its 0.6 backing over it, 10⁻⁶ legible (#805)         |
| `dive-1024-z7.3.png`      | the 584 px stage at 1024 × 640: the smaller readout, EURASIA by its dot, PACIFIC OCEAN stacked clear of it (#805) |
| `dive-phone390-z-3.9.png` | the stage at 390 × 844: the diatom and dish labels stacked under the readout, not on one line (#805)              |
| `dive-phone390-z-4.3.png` | the whole panel at 390 × 844 at the stop: stage, phase buttons, every second power of ten                         |
