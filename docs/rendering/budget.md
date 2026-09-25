# Evolution — Rendering: batching plan and frame budget

§6–§7 of the split [`RENDERING.md`](../RENDERING.md), which keeps the shared context and the file list.

## 6. Batching plan

Everything not a cell is a **baked texture**: `textures/glow-atlas.ts` bakes one radial-gradient glow per colour
(core + soft + wide + glint, `ASSET-GENERATION.md §1.5`) for motes, fragments, halos and effect rings; the dish
(field, zone tints and clouds, mire strands, vent crust, wall) is one render texture per zoom band
(visual-style/performance-and-checklist.md §8); the condenser light pool and its caustics are one view-anchored sprite over the field (§6.1);
the vent shimmer is the one filter, over the vent sprite only. Draw calls at the bench load (§7):

| Layer (`architecture/client.md §6`) | Container                                                                                                                                                                    | Calls |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| dish                                | field render texture; light pool (view-anchored sprite, §6.1); vent shimmer; vignette (screen-space)                                                                         | 4     |
| depth particles                     | far / near / bokeh `ParticleContainer`s (position + phase only)                                                                                                              | 3     |
| food                                | one `ParticleContainer`, mote atlas (algae, detritus, three rods, small variants, the fragment helices: one packed texture source, `textures/atlas-layout.ts`)               | 1     |
| DNA fragments                       | sprite batch: one helix frame per tag from the same packed mote source (strands, tag-tinted rungs and halos baked in, `textures/fragment-bake.ts`), 20 °/s                   | 1     |
| cells                               | pass A; organelle sprite batch; flagella `Graphics`; pass B                                                                                                                  | 4     |
| effects                             | glow-atlas sprites (rays, rings, halos, streams, reticle) with the own-cell ghosts, pip blocks and label pill; the own-cell arc mesh (§10); `BitmapText` floaters and labels | 3     |
| debug                               | `Graphics` + text, none when off                                                                                                                                             | 0–2   |
| HUD                                 | DOM (`UI.md`); no DOM inside `HUD_PLAYER_EXCLUSION_PX` is the HUD's rule; the own-cell indicators inside it are ours (§10, counted in `effects`)                             | 0     |

Total **≤ 17 draw calls** (counted by wrapping the GL draw functions in the bench build). The rows add up to 16
with debug off, which leaves **1** call of headroom; the arc mesh is one instanced call at any arc count (§10), so
the effects row never grows with the indicators. A canvas wider than `INTEREST_VIEW_ASPECT_RATIO` (2.4:1) adds 2: the
stencil rectangle that clips every layer above the field to the drawn band (`layers.ts` `applyDrawnBand`, #408), pushed
and popped once a frame; a narrower canvas has no mask and pays nothing. Its two edges fade into the field colour
rather than cutting a cell with a straight line (#684): two sprites of the `BAND_EDGE_FADE_BAKE` ramp in the screen
root, over the band's edges, under the vignette and batched into its draw call (`band-edge-fade.ts`; hidden, and free,
on a narrower canvas). The screen root must stay above the world root: a staged build moves both onto the stage in
their staged order (`renderer-slot.ts`), since the field is opaque. Culling: cells whose
drawing cannot reach `cameraExtent` are not uploaded — the reach is the widest any frame of the cell draws
(`cells/cell-cull.ts`: `cellDrawExtentRadii` sprinting at top speed with the widest clip, or its widest ring's px
floor), tested with no further margin (#529); motes and fragments are all uploaded (the bench load's quads are
free) and only bacteria positions change per snapshot.

### 6.1 The condenser light pool (#222)

`visual-style/principles-and-palette.md §1` anchors the pool to the view (option A); #242 builds it. It is **one sprite in the dish layer's world
container**, between the field sprite and the vent sprite, that the layer re-places every frame with the inverse
camera transform so it stays fixed on screen while everything over it scrolls. It cannot live in the screen root
with the vignette: it must sit under the motes, fragments, cells and the vent, and the field under it is opaque.

- **Bake** (`textures/light-pool-bake.ts`, once per session, no cosmetic stream, Canvas 2D through
  `texture-bake.ts` exactly as the field is: `fillRadial` for the gradient, `dish-field-details.ts` `paintCaustics`
  for the strokes; `radial-bake.ts` is not used, it has no strokes): a `LIGHT_POOL_TEXTURE_PX` **1024** square
  filled with the `LIGHT_ACCENT` radial `LIGHT_POOL_ALPHA` 0.09 → `LIGHT_POOL_MID` (stop 0.5, alpha 0.03) → 0 at
  the half-size, then the three `CAUSTIC_SWEEPS` at `CAUSTIC_ALPHA` painted across it. **Per-axis mapping:** the
  half-size (512 texels) is the pool's radii (`LIGHT_POOL_SHEET_RADII_WU`, sheet 02's 980 × 760 wu, the frame the
  sweeps' control points are drawn in), so x maps at 512 / 980 = 0.52 texel per wu and y at 512 / 760 = 0.67
  texel per wu (`FieldScale` grows a `pxPerWuY`, defaulting to `pxPerWu`, so `paintCaustics` places each control
  point per axis); the ellipse is then exact and the sprite's non-uniform scale restores the sheet's proportions
  instead of squashing the arcs. Stroke widths take the x factor: 3 / 2 / 1.5 wu → 1.57 / 1.04 / 0.78 texels, and
  `FIELD_MIN_STROKE_TEXELS` (1) applies, so the thinnest sweep is drawn 1 texel wide. At 1080p and zoom 1 the
  sprite is 1958 × 1512 px, so one texel is 1.9 × 1.5 px and the three arcs stay separate and crisp as on sheet 02
  (256 would have been 7.7 wu per texel: sub-texel strokes smeared into one band). The bake extent is the pool's
  radii, nothing more: the third sweep starts at y = 920 wu, past the 760 wu radius, and that 160 wu of tail is
  **clipped by design** (the pool is already 0 there, and on the sheet most of it lies below the frame). Cost:
  one 4 MiB RGBA8 texture (the field is 16 MiB), one gradient fill and three strokes at session start, nothing per
  frame. `dish-texture.ts` loses `paintLightPool` and its caustics call, and `LIGHT_POOL_SIZE_WU` /
  `LIGHT_POOL_OFFSET_FRACTION` are deleted.
- **Placement** each frame (`DishLayerFrame` carries the camera state and the `ViewportPx`, never a separate
  zoom; `camera.ts` `screenToWorld` and `zoomFor` are the helpers): centre = `screenToWorld(LIGHT_POOL_VIEW_CENTRE
× viewport)`, width = 2 × `LIGHT_POOL_VIEW_RADII.x` × viewport width / zoom wu, height = 2 ×
  `LIGHT_POOL_VIEW_RADII.y` × viewport height / zoom wu, anchor 0.5. A viewport with no height (a hidden tab, a
  0 × 0 canvas mid-resize) has zoom 0: `camera.ts` `hasViewportHeight` is the one guard that `cameraExtent`,
  `screenOffsetToWorld` / `screenToWorld`, this placement and `GameRenderer.render` share. The renderer skips such a
  frame whole and answers its last outputs, and the sprite keeps its last placement (ticket #245). The constants are
  cosmetic and live in `render/constants/world-render.ts`, never in `shared`: `LIGHT_POOL_VIEW_CENTRE = { x: 0.2, y: 0.185 }` and
  `LIGHT_POOL_VIEW_RADII = { x: 0.51, y: 0.7 }` (fractions of the viewport's width and height, so every aspect
  keeps sheet 02's look), `LIGHT_POOL_TEXTURE_PX = 1024`, `LIGHT_POOL_SHEET_RADII_WU = { x: 980, y: 760 }`.
- **Composition:** normal blend, the alpha lives in the texture; no mask, no filter, no per-frame bake. Dish
  layer order: field, light pool, vent, wall, far particles. The shallows tint is under it in the field texture
  and stacks with it; the vignette (screen root) stays above everything and is 0 at the pool's centre
  (visual-style/principles-and-palette.md §1).
- **Cost:** one draw call (the dish row above; the total is ≤ 17), one sprite transform per frame (the one point
  `screenToWorld` returns; no texture, buffer or bake work per frame).
- **Tests:** a fake-context spec (`testing/fake-bake-canvas.ts`, the `dish-texture.spec.ts` pattern): the canvas
  is `LIGHT_POOL_TEXTURE_PX` square; the one radial gradient carries the stops (0, `LIGHT_POOL_ALPHA`),
  (`LIGHT_POOL_MID.stop`, `LIGHT_POOL_MID.alpha`), (1, 0) in `LIGHT_ACCENT`; exactly `CAUSTIC_SWEEPS.length`
  `bezierCurveTo` calls, their points the sweeps' control points mapped per axis; every `lineWidth` ≥
  `FIELD_MIN_STROKE_TEXELS`. The dish-layer spec pins that `worldToScreen` of the sprite's centre and extent equals
  `LIGHT_POOL_VIEW_CENTRE` / `LIGHT_POOL_VIEW_RADII` × viewport at both zoom ends (1.8 and 0.36 px/wu) and two
  camera positions; the render smoke screenshots a cell in the shallows with the camera far from the vent and the
  pool at the top-left, three separate caustic arcs visible at zoom 1 (graphics-qa evidence).

## 7. Frame budget and the harness #99 ships

Target: **60 fps, ≤ 12 ms p95 frame** at 1080p, `devicePixelRatio` 1, on an integrated laptop GPU (Iris Xe
class: a new assumption stated here, not traced to any doc). The load is stated **once**, here; `architecture/client.md
§6` owns the baseline and this doc owns the bench scene that proves headroom above it:

| Load        | Cells                         | Motes                                             | DNA fragments | Source                                                                             |
| ----------- | ----------------------------- | ------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| baseline    | 8 (one per player)            | 1 400 (`FOOD_CAP_BASE + 8 × FOOD_CAP_PER_PLAYER`) | 110           | `architecture/client.md §6` populations at 8 players, ecology/food-and-spawn.md §3 |
| bench scene | `RENDER_BENCH_CELL_COUNT` 100 | `RENDER_BENCH_MOTE_COUNT` 1 400                   | 110           | this doc: the superset, same motes and fragments as the baseline                   |

Budget per stage (ms, p95) at the bench load. The seven `renderStagesMs` keys are the CPU stages
`render/bench/render-stage-timer.ts` brackets; the three rows below them are not keys:

| `renderStagesMs` key                                | Budget | `renderStagesMs` key                            | Budget |
| --------------------------------------------------- | ------ | ----------------------------------------------- | ------ |
| `net` snapshot apply + interpolation                | 1.0    | `effects` clips and effect sprites (i)          | 0.3    |
| `cells` registry diff, shape terms, instance buffer | 1.2    | `camera` follow, zoom, cull, `cameraExtent` (i) | 0.1    |
| `organelles` slots, lag, mapping (≤ 1 200 sprites)  | 1.0    | `submit` Pixi render (≤ 17 calls)               | 1.0    |
| `food` mote and fragment updates (i)                | 0.6    |                                                 |        |

**(i) informational** (ruling on ticket #470): a stage budget under **1** ms (`RENDER_JUDGED_STAGE_BUDGET_MIN_MS`) is
below what any consumer browser's clock resolves, so the verdict reports its p95 and never judges it; the frame p95
and the draw calls carry the frame. A number nobody can measure outside a lab raises no line.

| Not a key                                    | Budget | What it is                                                                                             |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ |
| `gpuMs` (its own field)                      | 4.0    | GPU timer query; `null` whenever the number is unavailable or implausible (below), and then not judged |
| HUD (Angular and the dish, inside the frame) | 1.0    | the residual the timer measures per frame as `frame − Σ its top-level brackets`, reported at p95       |
| headroom                                     | 1.8    | 12 − Σ keys (5.2) − `gpuMs` − HUD; a number in this table, never a field                               |

**Measurement.** `ClientPerformanceReport` (`shared/types/messages.ts`) carries the fields below and the server's
`clientPerformance` schema accepts them, so the server stays game-agnostic. The key list lives beside the type, the
way `CLIENT_MESSAGE_TYPE` does, because the server's schema and the client's timer must agree on it (`RENDER_STAGE_NAMES`
is pinned complete against `RENDER_STAGE`). The client does not send the report yet and `debug_get_room_performance`
does not list the stored reports: that wire path is a follow-up of #208; today the report is read through the debug
hook (`window.__evolutionDebug.performanceReport()`), the routes' DOM and — since #492 — the **browser console**.
Both measurement routes print their finished report there as well, headline block first and then the object, so a
human runs the measurement by opening the URL with devtools open and reads the numbers off the console; the DOM
element stays exactly as it is, because the smokes parse it and its `opacity: 0` is what keeps text out of a
screenshot of the stage. A route that produces no report says so on the console too (`console.error`), so a slow
run and a broken one are never the same silence. `game/measurement-log.ts` is the one module that may
`console.log`, and it carries the scoped `no-console` allowance in `eslint.config.js`.

```ts
export const RENDER_STAGE = {
  net: 'net',
  cells: 'cells',
  organelles: 'organelles',
  food: 'food',
  effects: 'effects',
  camera: 'camera',
  submit: 'submit',
} as const;
export type RenderStageName = (typeof RENDER_STAGE)[keyof typeof RENDER_STAGE];
export interface ClientPerformanceReport {
  // existing: fps, frameTimeAvgMs, frameTimeP95Ms, frameTimePeakMs, heapMb
  renderStagesMs: Readonly<Record<RenderStageName, number>>; // p95 per stage, ms; every key present
  gpuMs: number | null;
  drawCalls: number;
  visibleCells: number;
  visibleMotes: number;
}
```

**How the numbers are taken** (`render/bench/`, #208). `render-stage-timer.ts` is the injected `StageMeasurer` the
renderer and the cell layer bracket their stages with, on the injected wall `Clock`, a `RENDER_SAMPLE_CAPACITY_FRAMES`
ring per stage and per frame; a stage measured inside another (`organelles` inside `cells`) is taken out of the outer
sample, so the seven keys add up without double counting, and work done outside the frame is `accrue`d to its stage's
next sample: the session charges a snapshot applied on arrival to `net` and measures the frame's interpolation as
`net`; the renderer accrues the effects' start (before the cell sync) to `effects`. `frame-instrumentation.ts` is what
both sessions wrap around a frame: the timer, `draw-call-counter.ts` (the four GL draw entry points of the app's
context, wrapped in every build: one increment per call) and `gpu-timer.ts` (`EXT_disjoint_timer_query_webgl2`, one
query per submit, read back on later frames, every sample checked for plausibility; `null` where the extension is
missing or the number is not one a frame could have taken, see **Reading a report** below).
`render-benchmark.ts` builds the report and its **verdict** against the tables above (`budgetVerdict`: every judged stage,
the frame, `gpuMs`, the HUD residual, the draw calls). A live session rebuilds the
report every `RENDER_REPORT_EVERY_FRAMES` frames. Every budget and bench number is a constant of
`render/constants/bench.ts` (`CODE-STANDARDS.md §2`), and `render-budget-ledger.spec.ts` reads the tables of this
section and §6 back and pins the constants to them.

The `camera` key is the camera and nothing else — follow, zoom, cull, `cameraExtent`, the world transform. The dish
(the depth-particle walk, the light-pool placement) is **not** a stage: it runs unbracketed inside the frame and so
lands in the HUD residual row, together with Angular's HUD. The cell views every later stage reads (`cellsById`, the
own cell, the last-view lookup) are accrued to `cells`, the stage that consumes them, so no per-frame work sits
outside every key.

**Reading a report.** The harness reports a number only where it can support one, and the `verdict` says which rule
applied (`unjudged` names every row the evidence could not judge; `isFullyJudged` is false whenever it is not empty):

- **A p95 needs a window.** Below `RENDER_P95_MIN_SAMPLE_FRAMES` frames (**20**, `⌈1 / (1 − P95_QUANTILE)⌉`) the 95th
  percentile is not estimable from the window at all — any estimator degenerates towards the maximum — so the verdict
  judges no quantile row and lists every one of them in `unjudged`; only `drawCalls`, a count, is still judged.
  `quantileOf` interpolates between the two ranks around the quantile (the `PERCENTILE.INC` / R type-7 estimator)
  rather than taking a rank outright. `window=` may go under the minimum for a screenshot or a smoke run, never for
  evidence: **a number quoted against a budget comes from a window of at least 20 frames**, and the report carries
  its `sampleCount` so a reader can check.
- **`gpuMs` is a measurement or it is `null`.** Each query is checked against the wall clock between the two submits
  it brackets: in steady state a frame's GPU time cannot exceed its frame period, so a sample above
  `RENDER_GPU_SAMPLE_MAX_FRAME_RATIO` (**2×**) that period is not a measurement. The timer drops it, stops trusting
  that context and reports `gpuMs: null`. The bench report's `gpuStatus` says which of the four cases holds: `ok`,
  `unsupported` (no `EXT_disjoint_timer_query_webgl2` — SwiftShader, most mobile GPUs, and desktop Chrome unless the
  extension is exposed), `pending` (no query has resolved yet) or `implausible`. A `null` is never an overrun: the
  verdict lists `gpu` as unjudged instead. The disjoint flag is read once a frame (reading it clears it) and drops
  every query then in flight.
- **The HUD residual is measured, not subtracted.** The timer records, per frame, `frame − Σ its top-level brackets`,
  and the verdict judges the p95 of that against the HUD budget, so the row can fail. The old subtraction
  `frameTimeP95Ms − Σ renderStagesMs` is still reported as `derivedResidualMs`, signed and never judged: it goes
  negative because a sum of seven independent p95s is not the p95 of their sum, and because work accrued from outside
  a frame (a snapshot applied on arrival) is charged to a stage without ever being inside the frame bracket.
- **A CPU-clock row needs a clock that resolves it** (ticket #504). Browsers quantise `performance.now()` unless the
  page is cross-origin isolated: 1 ms in Firefox, 0.1 ms plus jitter in Chrome, so a stage p95 read off such a clock
  is a whole number of ticks (`net 2.00, food 1.00`), not the work. On its first report the session probes the
  clock's smallest step (`timer-resolution.ts`), and a row read off it — a judged stage, the frame, the HUD residual
  — is judged only where the step is at most **a tenth** of its budget (`RENDER_TIMER_RESOLUTION_BUDGET_FRACTION`).
  Coarser, the row lands in `unjudged` and the console prints its number marked unjudged with the clock's step. At
  1 ms that leaves the frame and the draw calls judged; a test clock that never moves leaves nothing unjudged.
- **`drawCalls` is the window's worst frame**, not its last, so one arbitrary frame cannot hide a spike.
- **`heapGrowthBytesPerFrame` is heap residency growth, not allocation.** It is the heap read after the window minus
  the heap read after a forced collection at the window's start, divided by the frames. A collection inside the
  window silently subtracts most of it and nothing here detects that, so the same scene reports figures several times
  apart between runs: quote it as a range over several runs with the run count, never as one number. What it is not
  is an allocation count; measuring allocation, and attributing it to a call site, needs CDP
  `HeapProfiler.startSampling` around the window, which this harness does not drive.

The route takes three more flags, all off by default. `cues=1` draws the own cell's legibility cues at their worst
case (ui/hud.md §3.1.5, #385): a shrinking mass chip with its trend glyph, `RATE_TAG_ROWS_MAX` rate tags with the DECAY
tag's trait glyph, the zone pill and `FLOATER_MAX_VISIBLE` floaters — one of each cause since #443 — kept alive by an
eat, an engulf payout and a sprint landing together at the head of each `floaterCycleFrames` (`bench-cues.ts`), so the
`effects` stage is measured with every cue drawn.
`advance=1` steps the scene one tick per frame, so the snapshot
apply and the view-registry churn that §7 budgets as `net` happen inside the window; parked on one tick (the default,
and what a screenshot needs) the window measures the interpolation half of `net` only. `preserve=1` keeps the WebGL
backbuffer so `canvas.toDataURL` can read it; production does not set it and it costs a full-framebuffer copy a frame
on a real GPU, so the report runs without it and only the pixel-determinism test asks for it.

**Fixed-seed scene:** `render/bench/bench-scene.ts` builds a synthetic `GameSnapshot` from `RENDER_BENCH_SEED` (42) with
the bench-load cells (table above) across every stage and palette on scripted circular paths (`bench-traits.ts`
gives each stage its trait set and the player records; three predator / prey pairs mid-engulf, four victims
absorbed and respawned on a cadence (player cells, ticket #501: an absorb names its victim's player and the
return is a `respawn` effect, which a wild seat's is not), eats and level-ups scheduled by `bench-effects.ts`; motes by the eukaryote-era
shares with the bacteria on a tick-driven walk, fragments drifting, `bench-food.ts`), all from the
`cosmetic:bench` fork of the seed, fed through the real `WorldStore` by a `ManualClock` (`bench-driver.ts`,
snapshots at `SNAPSHOT_EVERY_TICKS`); the dev-only route `/?bench=<seed>&tick=<n>&zoom=<z>[&window=<frames>][&advance=1][&preserve=1][&cues=1]`
(`render-bench.component.ts` behind the `IS_BENCH_ROUTE` token, `bench-session.ts` the engine) renders it,
parked at tick `n` and re-rendered every frame at `zoom` px/wu in a fixed 1920 × 1080 canvas, and after
`RENDER_BENCH_WARMUP_FRAMES` + `RENDER_BENCH_REPORT_FRAMES` frames (`window=` shortens the report window where a
software GPU renders a frame in seconds; the smoke passes 24) publishes the **bench report** to both sinks above —
the console block leads with the verdict, then the frame, GPU and HUD rows against their budgets, the draw calls,
the seven stages and the window, and a quantile row prints its window instead of a verdict wherever
`isP95Estimable` is false, so no number quoted from it comes from a window too short to hold one — and
`data-testid="render-bench-report"`: the wire report plus `seed`, `tick`, `zoom`, `frames`, the `verdict`, and
`heapGrowthBytesPerFrame` (the heap growth over the window after a forced collection, through Chrome's
`performance.memory` and `--js-flags=--expose-gc`, `heap-probe.ts`; `null` elsewhere) and `gpuStatus`. The debug hook runs in
bench mode: `step(n)` advances the scene `n` ticks and renders one frame, `setSeed` rebuilds it. The container's
SwiftShader proves the harness and the baselines (`e2e/render-bench.spec.ts`: no errors, **fresh-load determinism** —
two fresh loads of the same `seed`, `tick` and `zoom` draw identical pixels — a step changes them, the report's keys
and the draw-call ceiling at two zoom bands; never an absolute time, the box's load decides those). Fresh-load
determinism is the claim the route supports: a page walked to a tick and a page loaded at it are **not** the same
frame, because effects due at that tick have already drained on the walked page. The numbers in a PR body come from a
hardware run of the same route, with the machine's load stated.

### 7.1 The encyclopedia preview (#363)

The preview seam (`architecture/encyclopedia.md §12.7`) is a **third** `FrameLoopSession` on its own small Pixi app:
the real `GameRenderer` over a fixture scene and a local clock, with no room, snapshot or socket. It has two budgets
of its own, both constants of `render/constants/preview.ts`:

| Budget                    | Value | What it covers                                                                                                                                                   |
| ------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PREVIEW_OPEN_BUDGET_MS`  | 300   | `openedToFirstFrameMs` p95 over 20 opens in one page (`RENDER_P95_MIN_SAMPLE_FRAMES`), the cold first open reported apart, split into init / bake / first submit |
| `PREVIEW_FRAME_BUDGET_MS` | 1.0   | the preview frame's own CPU work outside its submit, p95, through the same `FrameInstrumentation` as a room's, warm-up frames excluded                           |

**Why the frame budget excludes the submit** (ticket #502). The frame bracket ends after `app.render()`, and on a real
GPU the driver blocks inside it once its queue is full, so the whole frame tracks the refresh interval: #470's run
read `frame p95 7.15 ms` at 183 fps. A 1 ms budget on that judges the display, never the lens. The route judges each
frame's bracket minus its submit (`FrameInstrumentation.workOutsideSubmitP95Ms`) and prints the whole frame beside
it, unjudged. The same clock rule as §7 applies: on a page whose clock steps coarser than a tenth of the budget
(Firefox's 1 ms), the work is printed and left unjudged.

**The route.** `/?preview=<EntryAnchor|PREVIEW_SCENE>&t=<seconds>&opens=<n>` (dev builds only, behind the same
production gate as the bench route) mounts `opens` sessions on a `ManualClock`, walks each to `t` in
`TICK_INTERVAL_S` steps with a **no-op submit** and submits only the parked frame, then publishes its report to
both sinks (§7): the **browser console** — the open p95 against `PREVIEW_OPEN_BUDGET_MS`, the parked lens's work outside its submit
against `PREVIEW_FRAME_BUDGET_MS` (the whole frame beside it, never judged), and the cold open split into init / bake / first submit with the bake's share of
it, then the object — and `data-testid="encyclopedia-preview-report"`: the cold open, every warm open, the open
p95, the parked session's frame report, both budgets and the verdict. One open leaves no warm open to take a p95
over, so that row prints what to pass (`&opens=20`) rather than a verdict. It is the one place the preview installs `window.__evolutionDebug` and
sets `preserveDrawingBuffer`. `packages/client/e2e/encyclopedia-preview.spec.ts` is its smoke.

**The absolute numbers are UNMEASURED.** Every figure below awaits a hardware run of that URL. No agent has a real
GPU: the container's browser is SwiftShader, a CPU rasteriser, which exaggerates GPU work and the shader compiles
inside `init`, so a bad number there may be better on hardware and only a **good** SwiftShader number is
trustworthy. The smoke therefore asserts the report's **shape** — every key present, every value reported and
finite — and never an absolute time.

| Number                                                   | State                     | Where it is read                                                                                                                                                                                                            |
| -------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| open p95 over 20 opens                                   | **unmeasured**            | `openP95Ms` in the DOM report, `opens=20`                                                                                                                                                                                   |
| cold open, apart                                         | **unmeasured**            | `coldOpen` in the DOM report                                                                                                                                                                                                |
| the three-way split (init / bake / first submit)         | **unmeasured**            | every `PreviewOpenTimings` in the report                                                                                                                                                                                    |
| preview frame work p95 (outside the submit)              | **unmeasured**            | `frameWork.workOutsideSubmitP95Ms`, the whole frame and the per-stage split in `frame`                                                                                                                                      |
| page rAF interval p95 and dropped frames, open vs closed | **unmeasured**            | a **live room** with the encyclopedia over it, through the room's debug hook — not this route, which has no room                                                                                                            |
| room startup through the same instrument                 | **unmeasured**            | the baseline §12.7 says is missing; `RenderSession`'s own first frame                                                                                                                                                       |
| lens canvas GPU memory at the cap (900² device px)       | **unmeasured**, ≈ 10 MiB  | colour backbuffer + the depth-stencil Pixi requests (`stencil: true`, ≈ 3.2 MiB) + the presented front buffer; ≈ 13 MiB on the evidence route with `preserveDrawingBuffer`; ≈ 50 MiB with the bundle while the lens is open |
| the stencil-free app option (would save ≈ 3.2 MiB)       | **not built, unmeasured** | nothing in the preview draws a Pixi mask, so it is available; §12.7 says measure before building                                                                                                                            |

**Shape checks the smoke asserts** (`e2e/encyclopedia-preview.spec.ts`, SwiftShader): every subject scene draws
with no page or shader error; two loads at the same `t` are pixel-identical and a different `t` is not; the canvas
is clamped to `PREVIEW_CANVAS_MAX_PX` device pixels on a 3× display; 20 open-and-close cycles log no
`Too many active WebGL contexts` warning; the DOM report carries every key with a finite value.

This list is what the spec asserts. Whether it last **ran** green is a separate fact, and it belongs with the PR
that last touched the file rather than here: ticket #363 (PR #469) is the first run — 5 passed in 5.8 min against a
private stack in the container. Two things that run cost and that the next runner should know: the whole file must
be the only e2e spec running (`pnpm smoke encyclopedia-preview`, **not** `-- encyclopedia-preview`, which selects
nothing and runs the entire suite), and every wait in it is scaled to a SwiftShader open, because Playwright's 5 s
default is shorter than `createPixiApp` takes on a loaded box.

**If a budget is missed**, §12.7's levers in order: throttle the room renderer while the encyclopedia covers it;
keep the preview session alive across encyclopedia opens; a bundle option that skips the dish-field and light-pool
bakes for scenes that do not show the dish. None is built before a measurement asks for one.

### 7.2 The texture bundle's two halves (#442)

`createRenderTextures` is synchronous and runs on the render thread. Ticket #442 measured what that costs: about
**1.2 s at room entry** and a **~310 ms freeze at every round change**, because a rematch's new seed rides a
snapshot (`architecture/wire-contract.md §4`) and `RenderSession` re-ran the whole bundle inline.

The bundle is therefore **two halves**, and `renderer-slot.ts` owns the difference:

| Half                   | What is in it                                                                                                         | Lifetime                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SharedRenderTextures` | the two radial bakes, the glow and mote atlases, the palette, the light pool, the indicator atlas and its BitmapFonts | baked once per Pixi app and **kept**; re-baked only if the baker or the device pixel ratio changes, dropped on `dispose` |
| `SeededRenderTextures` | the dish field, the vent, the noise strip, the cytoplasm tile, the organelle atlas                                    | re-baked on every seed change, and only then                                                                             |

Every seeded bake takes a **named sub-stream** off the cosmetic stream (`COSMETIC_SUB_STREAM`,
`DETERMINISM.md`) rather than drawing from it, so no bake can move another's numbers and the split could not
change a byte. What that rests on is that nothing in the shared half touches `cosmetic` at all — a shared bake
that drew from it directly would shift every seeded bake after it. `render-textures.spec.ts` compares the dish
field's and the vent's recorded Canvas-2D strokes, argument for argument, between a whole bundle and a
seeded-only one to catch exactly that, and `renderer-slot.spec.ts` pins that a rebuild adds no radial bake and
no font install and hands the new renderer the very same indicator bundle.

**Measured on the container's SwiftShader** through the bench route at 1920 × 1080, `devicePixelRatio` 1, taking
the bake spans directly; 8 rebuilds per run through the debug hook's `setSeed`, medians. **These absolutes are a
software rasteriser on a loaded 4-core box and are not hardware numbers** — the proportions are the durable part:

| Figure                                               | Before (main)         | After                 | Notes                                                                                                                                                                          |
| ---------------------------------------------------- | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| round-change rebuild, median of 8                    | **485 ms** (load 7.4) | **136 ms** (load 9.2) | −72 %, measured on a _busier_ box after                                                                                                                                        |
| what a rebuild re-bakes                              | the whole bundle      | the seeded half only  | the structural change                                                                                                                                                          |
| the seeded half as a share of the bundle             | —                     | —                     | **35–44 %** across four runs whose absolutes span 1.6 ×: one spread, not a before and an after. It is the floor a round change now pays, where it used to pay the whole bundle |
| `buildNoiseTile` (256², pure CPU, Node, median of 5) | 134 ms                | **64 ms**             | −52 %: per-row terms hoisted, no closure per knot read                                                                                                                         |
| `bakeRadialBytes` (vignette 512², same)              | 49 ms                 | **37 ms**             | −25 %: no `stops.slice(1)` per pixel                                                                                                                                           |

**The live room stages its builds across frames (#479).** Each half is a list of bakes (`render-texture-stages.ts`:
one step per radial bake, atlas, font install, dish field, vent, noise tile and organelle atlas), and a live
`RenderSession` builds through `RendererSlot.beginBuild`: the ticker runs **one bake per animation frame**
(`FrameLoopSession.buildRendererAcrossFrames`), so the page keeps painting and taking input while a room's
textures are baked. Nothing swaps until the last bake — at a rematch the old round keeps drawing — and the frame
that carries the last bake and the renderer's construction draws nothing. A room torn down mid-build finishes the
build before disposing it, so no baked texture or installed font leaks. `build` runs the same steps back to back
for the bench and the preview, which measure a whole build; `renderer-slot.spec.ts` pins that the staged and the
whole build make the same bakes in the same order.

Measured on the container's SwiftShader (load 8–9, 1280 × 800, three fresh rooms each, the longest main-thread
task from `Start` to the first frame; not hardware numbers):

| Figure                | Before                        | After                                       |
| --------------------- | ----------------------------- | ------------------------------------------- |
| the texture bake      | one task of 0.39–0.76 s       | one step per frame, the longest 0.10–0.22 s |
| the first drawn frame | 1.7–2.4 s (a task of its own) | 1.0–2.2 s, unchanged in kind                |

**The staged build warms the first draw before the reveal (#603).** After the last bake the new renderer is built
on a staging container **off the stage** (`RendererSlot.beginBuild`'s `staged`, put on the stage only by `commit`),
and `renderer-warm-up.ts`'s `WarmedRendererBuild` goes on one step per frame: the bundle's texture sources uploaded
`RENDER_WARM_UP_UPLOADS_PER_FRAME` (4, Pixi's own prepare default) at a time (`textureSourcesOf`, `PixiAppHandle.warmUp`), one
warm-up draw of the current frame on the staged renderer (its first-time CPU work: the pools, meshes and texts made
on first use; the stage brackets muted through `MutableStageMeasurer`, nothing submitted), and one render of the
staging container to a `RENDER_WARM_UP_TARGET_PX` (64 px) off-screen target (the shader compiles). Only then does it commit. A teardown
mid-build commits at once, skipping the warm-up, so what was made is still freed.

Measured the same way (SwiftShader, load 9–13, three fresh rooms; not hardware numbers):

| Figure                                           | #479 alone  | With the warm-up                                                |
| ------------------------------------------------ | ----------- | --------------------------------------------------------------- |
| the first visible frame's `renderer.render`      | 0.39–0.88 s | 7–23 ms (the warm-up draw, before the reveal: 23–31 ms)         |
| the first visible frame's `app.render`           | 0.37–0.82 s | 1–10 ms (the off-screen render, before the reveal: 0.32–0.74 s) |
| the longest task from `Start` to the first frame | 1.0–2.2 s   | 1.1–1.35 s                                                      |

**What is left is the first on-screen present, outside the frame's JavaScript:** the ticker callback that draws the
first visible frame runs in about 45 ms, yet its task lasts 1.1–2 s — the main thread waits on SwiftShader
rasterising the first full-screen frame (steady frames are 0.3–0.6 s tasks here). A real GPU does that in a frame;
ticket #470's hardware run is what says whether anything of it is left to chase.

**The bytes did not move.** `noise-tile.spec.ts` and `radial-bake.spec.ts` pin FNV-1a digests of the production
bakes, taken from the implementations these replaced, so the mottle and the vignette are byte for byte what every
screenshot and every pixel-determinism check already shows.
