# PR #243 evidence: the condenser light pool anchored to the view (#242, #222 option A)

Seed 42, SwiftShader, the private stack of the worktree (server 4510, client 4512), the room paused with
`debug_pause_room` before every shot and the own cell moved with `debug_set_player` (mass sets the zoom:
20 → 1.8 px/wu, 126.6 → 1.0, 1000 → 0.36 at 1080p). Before: `qa/evidence/pr-221/field-at-rest-seed42.png`
(main, the pool baked into the field at the vent).

| File                                | Viewport    | Own cell              | Zoom (px/wu) | What to look at                                                                  |
| ----------------------------------- | ----------- | --------------------- | ------------ | -------------------------------------------------------------------------------- |
| `before-after-shallows-zoom1.8.png` | 1920 × 1080 | spawn in the shallows | 1.8          | left: main, no pool in view; right: this PR, pool top-left with three arcs       |
| `shallows-zoom1.8-1920x1080.png`    | 1920 × 1080 | shallows (−2407, 784) | 1.8          | pool top-left over the shallows tint, three separate caustic arcs, wall at left  |
| `shallows-zoom1.0-1920x1080.png`    | 1920 × 1080 | shallows (−2407, 784) | 1.0          | same screen placement as zoom 1.8; the wall moved, the pool and its arcs did not |
| `vent-zoom1.0-1920x1080.png`        | 1920 × 1080 | vent zone (120, 60)   | 1.0          | pool still top-left; the vent sprite draws over the pool, the arcs under it      |
| `vent-zoom0.36-1920x1080.png`       | 1920 × 1080 | vent zone (120, 60)   | 0.36         | view ceiling: the whole dish in view, the pool and arcs at the same fractions    |
| `shallows-zoom0.67-640x400.png`     | 640 × 400   | shallows (−2407, 784) | 0.67         | small viewport (the 300 wu floor gives 0.67 px/wu at 400 px tall): pool top-left |

Draw calls, counted by wrapping `drawElements` / `drawArrays` and their instanced forms on
`WebGL2RenderingContext.prototype` over 30 animation frames (one cell, no motes yet):

| Viewport    | Calls per frame | Ceiling (RENDERING §6) |
| ----------- | --------------- | ---------------------- |
| 1920 × 1080 | 9               | 17                     |
| 640 × 400   | 9               | 17                     |

Console: no page or shader errors; only the opt-in audio asset 404s and the favicon.
