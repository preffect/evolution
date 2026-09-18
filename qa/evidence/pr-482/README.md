# PR #482 — the encyclopedia lens (ticket #466)

Every frame is headless Chromium against a private dev stack on **4520 / 4522** in this branch's own worktree,
`deviceScaleFactor: 1`, `scale: "css"` — true size, no zoom. The panel is opened from the **lobby**, so no room is
running behind it and the numbers below are the preview's own. The 1024 × 640 frame is the `UI_SCALE_MIN` floor
(`--ui-scale` 0.8), which ticket #415 found is where layout breaks.

| Frame                               | Size       | What it shows                                                                                          |
| ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `466-lens-live-1280x800.png`        | 1280 × 800 | Mitochondrion, tier I: the live cell in the eyepiece, the reticle, and the tier switch under it        |
| `466-lens-tier3-1280x800.png`       | 1280 × 800 | tier III selected — the same session, a new scene: three organelles instead of two                     |
| `466-lens-live-1024x640.png`        | 1024 × 640 | the same page at the scale floor: the lens is 240 px and the canvas 240 device px                      |
| `466-lens-unavailable-1280x800.png` | 1280 × 800 | `unavailable`, with WebGL taken away from the page: the eyepiece with `Preview unavailable` in it      |
| `466-lens-in-room-1280x800.png`     | 1280 × 800 | the same lens over a **live room**: two renderers on the page, the dish still running behind the scrim |
| `466-vignette-on.png` / `-off.png`  | 1280 × 800 | the pair the vignette table below is measured from                                                     |

**The `loading` frame is not here, and it is not a shortcut.** The state is real and was observed: on the first open
of a page the lens's own `data-preview-state` went `loading` at **+177 ms** after the row click and `live` at
**+1978 ms**, and every later open was polled through `loading` too. It could not be photographed on this box. Warm, it lasts about 30 ms; on the cold open the main
thread is blocked for ~1 s, and the preview's canvas presents through the compositor independently of it, so a
screenshot taken during the wait comes back with the scene in it rather than with the wait. Its drawing is the
`unavailable` frame's eyepiece plus one accent ring at half the radius, whose geometry `format/lens-overlay.spec.ts`
pins.

## The open, measured

**The lens does not relayout the page #465 left.** The lens's box measures `(521, 113) 300 × 300` at 1280 × 800 —
the same top-left the reserved box measured — and its canvas is exactly 300 × 300 CSS px at DPR 1.

**In the panel, from the click on a list row to `data-preview-state="live"`**, with `PerformanceObserver` watching for
long tasks (load average ≈ 11 on this box, another agent's test run beside it):

| Open                           | click → `live` | longest main-thread block |
| ------------------------------ | -------------- | ------------------------- |
| cold (first in the page load)  | 1185 ms        | **1061 ms**               |
| warm (second in the same page) | 31 ms          | none                      |
| warm (third)                   | 41 ms          | none                      |

Each of those opens builds a **new** session: the canvas element differs every time, and after a close there is no
canvas in the DOM at all. So the cold open is ticket #442's trap — one ~1 s freeze — and every open after it in the
same page load is free, because what the cold one pays for (the WebGL2 context, the shader compiles, the module
graph) the browser keeps.

**Through the evidence route** (`?preview=trait:mitochondrion&opens=20`, which is a harsher loop: 20 open-and-close
cycles back to back with `preserveDrawingBuffer` on):

|                        | cold open                              | warm opens (19)                  |
| ---------------------- | -------------------------------------- | -------------------------------- |
| `openedToFirstFrameMs` | 1058                                   | min 278 · mean 397 · **p95 541** |
| split                  | init 471 · bake 463 · first submit 123 | bake is 65 % of the open         |

`PREVIEW_OPEN_BUDGET_MS` is 300, so the route's p95 **misses it** — as ticket #363's own run did (337 ms `zone`,
786 ms `cell`). Nothing here judges that: the container's browser is SwiftShader, a CPU rasteriser, and
`rendering/budget.md §7` records the absolute numbers as unmeasured until the hardware run (#470).

## The vignette, now that there is a scene under it

Ticket #465 measured the vignette as a genuine no-op over the empty well. Over a lit scene it is not. Sampled down
the lens's vertical radius, with the overlay's vignette circle shown and hidden (1280 × 800, tier I):

| r (of the lens radius) | vignette on      | vignette off     | Δ blue |
| ---------------------- | ---------------- | ---------------- | ------ |
| 0.5                    | `srgb(14,27,43)` | `srgb(14,27,43)` | 0      |
| 0.7 (the stop)         | `srgb(14,26,43)` | `srgb(14,26,43)` | 0      |
| 0.8                    | `srgb(12,24,38)` | `srgb(14,27,43)` | −5     |
| 0.9                    | `srgb(10,20,32)` | `srgb(14,27,43)` | −11    |
| 0.96                   | `srgb(49,64,80)` | `srgb(53,71,90)` | −10    |

Clear inside its start fraction, a quarter of the field's brightness out of the band at the rim. The samples inside
0.5 are the subject and move between the two frames, so they are left out.

## Over a live room: two renderers on one page

§12.7's page-level budget is the room ticker's own rAF interval with the encyclopedia open against closed. Measured
in a started room on this box, 60 frames each:

|                             | rAF interval mean | p95   |
| --------------------------- | ----------------- | ----- |
| encyclopedia closed         | 17 ms             | 31 ms |
| the lens live over the room | 28 ms             | 68 ms |

The second renderer roughly halves the page's frame rate **on SwiftShader**, where every submit is rasterised on the
CPU and the room's own frame already costs 34 ms (the bench route's own report on this box). It is the cost §12.7
anticipated and lever 0 exists for — throttling the room renderer while the encyclopedia covers it — and the number
that decides whether that lever is needed is the hardware run's (#470), not this one.

## The context is not leaked

Twelve open-and-close cycles in one page, from the lobby:

- while open: **1** canvas; after every close: **0**. No accumulation across the twelve.
- no `Too many active WebGL contexts` warning at any point (the browser's cap is 16).
- the one warning each close does log is `[BindGroup] a 'textureSource' was destroyed while still bound to a shader`
  — **ticket #468**, the renderer's own teardown, which the preview's `destroy` now reaches as well as the room's.

Open times across those twelve cycles ran 38 ms – 2.8 s, the spread being the box: another agent's test tier was
running beside this one throughout.
