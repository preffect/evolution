# Dish baselines (#221, re-shot after #229 in PR #233 and after #242 in PR #244; zoom bands added with #223 in PR #723)

Seed 42, 1920 × 1080, SwiftShader, zoom 1 (the own cell at mass ≈ 125, r 45 wu, so `CAMERA_VIEW_RADII`
gives 540 wu of half height). Shot with the fixed screen vignette (#229): the centre of the frame is the
true field colour and only the edges darken toward 0.55 black. Since #242 (decision #222, option A) the
condenser light pool is anchored to the view: its centre sits at `LIGHT_POOL_VIEW_CENTRE` (384, 200) of
every 1080p frame and its three caustic arcs cross x = 700 at rows 161 and 320 and x = 1100 at row 172
whatever the camera does; the pool centre reads `BG_FIELD` + 9 % `LIGHT_ACCENT` (21, 40, 57) over the broth.

| File                                  | Pins                                                                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field-at-rest-seed42.png`            | the field at the spawn (−2407, 784): the view-anchored pool and its three arcs over the shallows tint, the wall glass reading `#182c46`, the particles      |
| `vent-at-zoom1-seed42.png`            | the own cell at (120, 60) beside the vent at the origin: the vent sprite, crust, risers and bubbles drawn over the pool; no world-anchored pool at the vent |
| `vent-crop-zoom1-seed42.png`          | 760 × 480 crop of the vent from the frame above (offset 580, 300)                                                                                           |
| `bakes-preview-seed42.png`            | the Canvas-2D bakes laid out as a sheet (#221); untouched by #229 and #242 (it still shows the pre-#242 field bake with the pool painted in)                |
| `band-near-zoom1.8-seed42.png`        | #223 near band: own cell at mass 20 (zoom 1.8), 150 wu left of the first gel patch; the mire strands as crisp world-scale lines at their sheet-02 width     |
| `band-mid-zoom1-seed42.png`           | #223 mid band: mass 210 (zoom ≈ 1), 330 wu left of the patch; thin strands widened to 1 CSS px at zoom 0.6, so ≈ 1.7 px here                                |
| `band-far-mass5000-seed42.png`        | #223 far band: mass 5000 (zoom ≈ 0.45), 700 wu left of the patch; strands at the old one-texel floor, the far view unchanged from before #223               |
| `band-near-wall-scratches-seed42.png` | #223 near band at the wall (0, −2960), mass 20: the stage scratches outside the wall as 1 px lines under the wall's glass                                   |

The `band-*` shots were taken with the room paused (the "Waiting for server…" strip at the top is that pause, not a
regression). Not yet pinned: the zones at play scale (shallows, vent at zoom 1.8), motes and fragments (#207). graphics-qa adds them with those PRs.
