# Dish baselines (#221, re-shot after #229 in PR #233)

Seed 42, 1920 × 1080, SwiftShader, zoom 1 (the own cell at mass ≈ 125, r 45 wu, so `CAMERA_VIEW_RADII`
gives 540 wu of half height). Shot with the fixed screen vignette (#229): the centre of the frame is the
true field colour and only the edges darken toward 0.55 black.

| File                         | Pins                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `field-at-rest-seed42.png`   | the field at the spawn: the condenser light pool from the top-left, the wall glass reading `#182c46`, the far and near particles |
| `vent-at-zoom1-seed42.png`   | the own cell parked 320 wu below the vent at the origin: the vent sprite, crust, risers and bubbles over the field               |
| `vent-crop-zoom1-seed42.png` | 760 × 480 crop of the vent from the frame above                                                                                  |
| `bakes-preview-seed42.png`   | the Canvas-2D bakes laid out as a sheet (#221); untouched by #229, which only covered the rendered frame                         |
