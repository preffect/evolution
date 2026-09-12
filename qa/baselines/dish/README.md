# Dish baselines (#221, re-shot after #229 in PR #233 and after #242 in PR #244)

Seed 42, 1920 × 1080, SwiftShader, zoom 1 (the own cell at mass ≈ 125, r 45 wu, so `CAMERA_VIEW_RADII`
gives 540 wu of half height). Shot with the fixed screen vignette (#229): the centre of the frame is the
true field colour and only the edges darken toward 0.55 black. Since #242 (decision #222, option A) the
condenser light pool is anchored to the view: its centre sits at `LIGHT_POOL_VIEW_CENTRE` (384, 200) of
every 1080p frame and its three caustic arcs cross x = 700 at rows 161 and 320 and x = 1100 at row 172
whatever the camera does; the pool centre reads `BG_FIELD` + 9 % `LIGHT_ACCENT` (21, 40, 57) over the broth.

| File                         | Pins                                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field-at-rest-seed42.png`   | the field at the spawn (−2407, 784): the view-anchored pool and its three arcs over the shallows tint, the wall glass reading `#182c46`, the particles   |
| `vent-at-zoom1-seed42.png`   | the own cell at (120, 60) beside the vent at the origin: the vent sprite, crust, risers and bubbles drawn over the pool; no world-anchored pool at the vent |
| `vent-crop-zoom1-seed42.png` | 760 × 480 crop of the vent from the frame above (offset 580, 300)                                                                                       |
| `bakes-preview-seed42.png`   | the Canvas-2D bakes laid out as a sheet (#221); untouched by #229 and #242 (it still shows the pre-#242 field bake with the pool painted in)              |

Not yet pinned: the zones at play scale (shallows, mire, vent at zoom 1.8), the field per zoom band (#223),
motes and fragments (#207). graphics-qa adds them with those PRs.
