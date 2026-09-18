# Evolution — Rendering: file plan and test plan

§8–§9 of the split [`RENDERING.md`](../RENDERING.md), which keeps the shared context and the file list.

## 8. File plan (`packages/client/src/app/game/render/`, ≤ 250 lines each, 300 is the lint cap)

```text
pixi-app.ts  layers.ts  camera.ts  view-registry.ts  sprite-pool.ts  instanced-quad.ts  constants.ts  palette.ts  colour.ts  geometry.ts  light-direction.ts  easing.ts   (renderTick: net/interpolation.ts, §1; sprite-pool: the pooled centred sprites the organelle, fragment and effect layers place by index; instanced-quad: the unit quad with an instance index the cell mesh and the arc mesh draw)
constants/{colours,cell-shape,organelles,world-render,vent}.ts   the pages of constants.ts (a barrel), each under the 300-line cap; the lint exemption covers the directory
noise/{noise-tile,noise-strip}.ts                 256² two-channel cytoplasm tile (64 wu period), 256×16 RGBA jitter / lobes strip (16-bit pairs, derivatives from the lerp), from the cosmetic fork (#206)
textures/{texture-bake,soft-paint,pixi-textures}.ts   the Canvas-2D bake seam (`BakeContext2D`, the DOM factory, the fill / stroke / halo / glint primitives), the feathered ellipse and soft stroke that stand in for the sheets' blurs, and the one place a bake or a byte table becomes a Pixi texture (#206)
textures/radial-bake.ts                              the per-pixel radial sampler behind the soft disc and the vignette: premultiplied bytes a spec can read back (#229)
textures/{glow-atlas,organelle-atlas,mote-atlas,dish-texture}.ts   the atlases and the field, each a pure bake over the seam (#206)
textures/atlas-layout.ts                             shelf packing of the mote and fragment bakes into the one canvas the food `ParticleContainer` draws from (`TextureBaker.atlasFromBakes`, #207)
textures/{nucleus-bake,bacterium-bake,fragment-bake,dish-field-details}.ts  the multi-layer bakes the atlases and the field compose (#206)
textures/{vent-bake,vent-risers-bake}.ts          the vent sprite at ≥ 1 px/wu, drawn by the dish layer over the field (§6); the field stays 0.33 px/wu for the tints (#206)
textures/light-pool-bake.ts                       the condenser pool and its caustics, one bake the dish layer keeps fixed to the view over the field (§6.1, #242)
textures/{ghost-bake,pip-block-bake,label-pill-bake}.ts   the own-cell indicators' px bakes (§10): the five ladder ghosts, the pip blocks per (variant, eaten), the nine-slice label pill (#294)
textures/{indicator-atlas,indicator-textures,bitmap-fonts,mote-textures}.ts   the indicator bakes keyed as `orbit-layout` hands them over, packed on one source with the pill and the fonts beside it; the `value` / `label` BitmapFont installs; the mote atlas's textures (#294)
cells/{cell-layer,cell-layer-frame,cell-render-state,cell-traits,cell-lod}.ts   the composer, its frame contract, one state per cell, the stage / trait summary, the LOD rule (#215)
cells/{cell-instance,cell-instance-builder,cell-mesh}.ts       the instance-texture layout and packing, the per-frame record, the GPU objects (#215)
cells/self-ring.ts                                 the sprint ring's input to the cell layer, its clockwise-from-12 arc coordinate (the GLSL's reference) and the escape's warning-ring rule (§10, #295)
cells/{cell-shader,cell-shader-source,cell-shader-patterns,cell-shader-bands,cell-shader-tells,cell-shader-membrane}.ts   GLSL as template strings: the two stages, the shared helpers, the profile, pass A (with the interior tells), the pass-B tells (wall, cilia, warning ring, rim dash), pass B (#215, #216)
cells/{radial-profile,shape-terms,contact-dents}.ts            r(θ) in TypeScript; terms from views + clips + t (dents: #216)
cells/{cell-clips,cell-effects,ghost-cells,ghost-instance}.ts  the clip hooks (tracks → deformation), effects → clip starts and ghosts, the absorbed-prey ghosts and their instance rows (#216; #207 drives the first two)
cells/{organelle-kinds,organelle-layout,organelle-mapper,organelle-motion,organelle-sprites,flagellum-lines}.ts   counts, seeded slots, the mapping through the profile, sprite motion, the pooled sprites (#215); flagella #216
cells/forms/{form-profiles,diatom-pattern,stentor-anchor}.ts   the registry and aspects (#216); the silhouettes (#192–#196, #121)
food/{food-layer,mote-sprites,dna-fragment-sprites,bacterium-heading}.ts   one `ParticleContainer` over the mote atlas and the fragment sprites above it, one render state per mote (cosmetic draws, held heading) in a `ViewRegistry`; the pure appearance rules (#207)
dish/{dish-layer,depth-particles,vent-shimmer}.ts
effects/{effects-layer,motion-clip-player,effect-sprites,reticle}.ts   the glow-atlas sprites of the four effects and the reticle, the millisecond clip player, the placements as data (#207)
effects/cell-clip-tracker.ts                       one clip player per cell, started from the effects, sampled with the engulf terms of the views into the frame's `CellDeformations` (#207)
effects/{own-cell-geometry,oriented-box,orbit-layout,threat-label-placement}.ts   the own cell's indicator geometry (§10), pure and one-way: the radii and the angle turn (the leaf), the gap between drawn boxes, the ladder orbit's layout, the threat label
effects/own-cell-indicators.ts                      the own cell's arc rows, sprite placements and texts from the HUD record, at the top of that chain; `threatAnchorFor` (§10, #187)
effects/own-cell-layer.ts                           what both own-cell layers share: the sprite container and pool, the text view built on first use, and the frame that stands down without a record or an own cell (§10, #385)
effects/own-cell-indicators-layer.ts                the layer that draws them: one arc mesh, one pooled sprite batch, the texts; the DNA fill tween and the level-up flash (§10, #187)
effects/cue-layout.ts                               where the legibility cues sit: the chip, the tag column, the zone pill, a floater's column; labels first (§10, #385)
effects/cue-placements.ts                           the record's cues and the live floaters as pill rows, backings, texts and glyph sprites (§10, #385)
effects/cue-layer.ts                                the layer that draws them; the floater stack and the rate tags' refresh hold (§10, #385)
effects/cue-text.ts                                 the cues' pooled nine-slice pills and BitmapText behind an injectable factory (§10, #385)
effects/floater-stack.ts                            the floaters: spawn, merge, push, expire and their rise and fade on the render clock (§10, #385)
effects/{indicator-fill-tween,indicator-text}.ts    the DNA fill's linear tween; the numeral and label text views behind a factory, so specs need no `BitmapText` (§10, #187)
effects/own-cell-ring.ts                           the sprint ring per frame: the fill, the `sprint_ready` brighten on reaching ready, the escape's predator (§10, #295)
effects/{arc-instance,arc-shader,arc-mesh}.ts       the arc primitive (§10): the row packing (start angles through `screenRadiansOf`, a round or butt cap per row), the distance-to-stroke GLSL, one instanced mesh drawing every ring, track and arc of a frame in one call (#294)
effects/orbit-backing-arcs.ts                       the ladder orbit's backings as butt-ended arc rows over `orbitLayout`'s padded, merged spans (§10, #294)
bench/{render-stage-timer,draw-call-counter,gpu-timer,frame-instrumentation,render-benchmark}.ts   the stage brackets, the two GL counters, what both sessions wrap around a frame, the report and its verdict (§7, #208)
bench/{bench-scene,bench-traits,bench-food,bench-effects,bench-driver}.ts   the fixed-seed world and its snapshot at any tick, driven through the real store on a `ManualClock` (§7)
bench/{bench-session,bench-route,render-bench.component,heap-probe}.ts   the dev-only route: the engine and its query flags, the `IS_BENCH_ROUTE` gate, the component, Chrome's heap counter (§7)
preview/{preview-spec,preview-scene,preview-frame,preview-session,preview-host,preview-timings,preview-still}.ts   the encyclopedia preview seam (architecture/encyclopedia.md §12.7): the spec data, spec → scene, scene → `RenderFrame`, the third `FrameLoopSession`, the `ENCYCLOPEDIA_PREVIEW` token, the walk arithmetic and the two budgets' verdict, the cached still frames (#378)
preview/{preview-clock,preview-canvas}.ts           the session's two pure pieces, out of it so it is only the session: the local clock (a monotonic render tick, a scene phase a `show` restarts, a pause that re-bases) and the canvas bounds (the DPR cap, the CSS clamp, the lens's bounding square)
preview/scenes/{cell-scene,food-scene,zone-scene}.ts   the subject scenes (#363: `cell`, `food`, `dna_fragment`, `zone`), pure over (loop seconds, balance)
preview/scenes/{eat-scene,engulf-scene,sprint-scene,level-up-scene}.ts   the action scenes (#364); until they land `previewSceneFor` shows the open-broth stand-in for their families
bench/indicator-sheet.ts                            `sheet=indicators`: the own-cell indicator textures drawn at their px floor and magnified over the field colour, the evidence sheet of §10 (#294)
game-renderer.ts  render-session.ts  render-textures.ts  render-target.ts   the orchestrator (the seven stages), one room's session, the texture bundle, whom the camera follows
frame-loop-session.ts  renderer-slot.ts                       the frame loop, gate and instrumentation all three sessions share (§7, #208); the one renderer a session holds, built over its textures and disposed with them
../route-query.ts  ../debug/debug-hook-holder.ts        what the two dev routes (bench, preview) share: reading a number off the query, and holding the `window.__evolutionDebug` install so each removes only its own (#363)
pixi-texture-baker.ts                                  the `TextureBaker` (the per-pixel radial bakes of `textures/radial-bake.ts` for the soft disc and the vignette, the Canvas-2D factory and `textureFromBake` for the atlases and the field)
```

`cell-layer.ts` composes; every other module is a pure function or a dumb view (`CODE-STANDARDS.md §4`). This
list is the one home of the `render/` file plan; `architecture/constants-files-tests.md §10` points here.

## 9. Test plan (`TESTING.md` tiers)

- **Unit (vitest, no WebGL):** `radial-profile.spec.ts` pins `r(θ)` at 36 angles per state against literal
  tables (rest with lobes and jitter zeroed = the circle, moving k = 1 gives 1.22 / 0.868 / 0.72 at Δ 0° / 90° /
  180° and k = 0.45 gives 1.10 / 0.94 / 0.87, eat wrap frame, engulf wrap frame gives 1.616 at ±30° and 1.114 at 0° (§4), contact
  dent, each form), pins `r′(θ)` against a central difference of `r(θ)` (≤ 1e-4 r per rad) and `d(p)` on an arm
  flank (a probe at `|p| = r(θ) + w` reads `d < w` where `r′ ≠ 0`), a seeded rest profile has 5–7 lobes within
  ±2.5–4 % and stays inside ±5 % of `r`, and same seed + same tick ⇒ same profile (`determinism/replay-tests-and-traps.md §7`);
  `shape-terms.spec.ts` (view → terms, bump slot assignment including the eight-slot amoeba III mid-engulf and
  contact / eat dropped while engulfing, sprint scaling, and the moving-wrap extent: k = 1 stretch with the wrap frame and an eat pulse reports a maximum of 2.99 r, below `CELL_QUAD_EXTENT_RADII` 3.0); `form-profiles.spec.ts` (every `B` has unit area within
  0.5 %, the sheet-04 aspects, diatom terms all zero); `organelle-layout.spec.ts` (slot centres inside 0.92 and outside `DNA_RING_KEEP_OUT_FRACTION`, every sprite body inside the membrane, the
  toxin bladder on the keep-out ring (#243), outside the nucleus disc, gap held, append-only across tiers, seeded); `ghost-instance.spec.ts` (the ghost's sprites at the rest slots mapped through its own profile, the shader's
  nucleus disc anchored on the mapped nucleus sprite, none below the far threshold; `cell-layer.spec.ts` queues them before the predator's at the ghost's alpha and `organelle-sprites.spec.ts` freezes their idle motion, #243); `organelle-mapper.spec.ts` (lag 0.20 r at k = 1; mapping equals the profile
  on the rim); `cell-lod.spec.ts` (thresholds and the fade window); `cell-instance.spec.ts` (the §2.3 row is seventeen texels, 272 B a cell,
  `nucleusDiscRadii` and `speckleSeed` in the tenth scalar texel and the sprint ring alone in the eleventh, #295), `self-ring.spec.ts` (the arc
  coordinate at 12 / 3 / 6 / 9 o'clock in the y-down frame, the escape rule), `own-cell-ring.spec.ts` (the fill through
  `sprintFillFor`, a full ring while sprinting, `sprint_ready` on reaching ready and never on a first frame or a
  respawn), `cell-shader.spec.ts` (every field read from its column, the sprint ring's turn, track and brightness, the speckle salt
  is the cell's seed, the filament and cilia masks are ±0.5 px `band`s, the wall band's tier-I reading 1.05 → 1.1175 / 1.0875, the
  `SHADE_NUCLEUS` / `SHADE_NUCLEUS_DARK` defines, the nucleus ramp band's stops, `frame.aa` edge, zero-radius return
  and place at the end of pass A, no `lodBlend`), `cell-instance-builder.spec.ts` (`nucleusDiscRadii` = `NUCLEUS_RADIUS`
  with a nucleus at full and mid LOD, 0 for a nucleoid or protocell; a far dot's warning ring is 0 and its quad
  equals the ringless `quadExtentRadii`, #243), `nucleus-bake.spec.ts` (no disc fill: the only
  gradients are the two halos); `palette.spec.ts` (HSL derivations, the
  separability numbers of visual-style/principles-and-palette.md §2); `bench-scene.spec.ts` (counts, seed-stable, the pairs, the schedule),
  `bench-driver.spec.ts` (parks and steps the store), `bench-session.spec.ts` (the query and its flags, the report
  after the window, the hook), `preview-scene.spec.ts` (every family resolves, seed- and tick-stable frames, each
  zone target reads as its own zone through `zoneAt`, the swim at the cell's own top speed, and the stand-in the
  action families share until #364 builds them), `preview-framing.spec.ts` (the two framing bands measured from the
  renderer's own `buildShapeTerms` extents at every tick of a loop, over the `preview-subject-specs.ts` list both it
  and `preview-scene.spec.ts` walk),
  `preview-loop.spec.ts` (each loop's effects once, at their absolute ticks; a jump of many periods emits at most
  one loop's), `preview-frame.spec.ts` (radius and stage through the shared formulas over the live balance),
  `preview-session.spec.ts` (one bake per session and none on `show`, a `show` that restarts the scene's phase
  without ever moving the render tick backwards, a destroy before `start` resolves destroys the late app,
  open/close cycles balance apps, bakes and font installs), `preview-clocks.spec.ts` (the wall clock measures the
  open while a caller's `sceneClock` drives the scene, `pause` uses the ticker and never the `FrameGate`, `resume`
  re-bases the clock, the DPR cap, the canvas clamp and the lens's bounding square), `preview-timings.spec.ts` (the walk
  arithmetic and the budget verdict's `null` rows), `bitmap-fonts.spec.ts` (a bundle's own font names, and an
  uninstall that touches only them), `bench-route.spec.ts` (both halves of the production gate),
  `render-stage-timer.spec.ts` (p95s, accrual, nesting, the measured residual, a cancelled frame),
  `gpu-timer.spec.ts` (the plausibility rule and the four statuses), `render-benchmark.spec.ts` (the verdict rows,
  a window too short to judge, an unavailable `gpuMs`), `render-budget-ledger.spec.ts` (§6–§7's numbers against the
  constants); `motion.test.ts` in
  `shared` (one snapshot per clip; durations and keyframe times equal sheet 03's; every `pulse` ≤ 1.14; overshoot
  ≤ 3 %; tracks are monotonic in `at`; every `easingTo` is an `EasingName`; no file under `packages/server/src`
  imports it and `balance.json` has no key from it); `constants.spec.ts` (every visual-style/principles-and-palette.md §2 hex is present
  once).
- **Integration (`*.integration.spec.ts`, WebGL):** shader ↔ TypeScript parity: render one cell per state to a
  render texture, walk 36 rays, boundary within 1 px of `radial-profile`; on the engulf wrap frame the rim-light
  band measured along the outline normal is 5 % r ± 1 px at every one of the 36 rays, arm flanks included
  (the perpendicular-distance check); draw-call count ≤ 17 on the bench scene; `renderStagesMs` populated; the
  ghost instance appears on `cell_absorbed` and leaves at 600 ms; `own-cell-ring.integration.spec.ts` takes the own
  view's cooldown through the renderer to the packed `selfRingFill` and `selfRingBrightness`, and keeps every warning
  ring, the escaping predator's included, while `SHOULD_HIDE_PREDATOR_RING_DURING_ESCAPE` is off (#295; the unit specs cover
  both switch states). The client's vitest tier runs under jsdom with
  no WebGL, so the WebGL checks ride the Playwright smoke (`packages/client/e2e/render-smoke.spec.ts`, run with
  `pnpm --filter @evolution/client smoke` against the dev servers — **to run one spec file, append the filter with
  no `--` separator** (`pnpm --filter @evolution/client smoke render-smoke`): `smoke -- render-smoke` selects
  nothing and silently runs every e2e spec, which passes, takes many times as long, and is easy to mistake for the
  one file having run; check the `Running N tests` line): slice A (#205) opens a live room with a fixed
  seed, asserts no page or shader errors, that the canvas fills the viewport with no page scroll and no lobby
  panel left, at the config's viewport and at the 1024 × 640 minimum (ui/layout.md §1, #217, #220), that the debug hook's pause holds the rendered tick and the canvas and a step
  advances both, and screenshots the dish; slice D (#208, `e2e/render-bench.spec.ts`) opens the bench route at
  the three zoom bands, asserts no errors, two fresh loads of the same seed, tick and zoom ⇒ the same pixels and a
  step changes them, the report in the DOM with every stage key and the draw calls under the §6 ceiling at two zoom
  bands, and writes the reports beside the screenshots; the
  shader parity walk is still open (#206).
- **Screenshot baselines (`qa/baselines/`, graphics-qa on every renderer PR, not part of `validate.sh all`):**
  `qa/baselines/scenes.json` lists bench scenes × zoom 1.8 / 1.0 / 0.36 (visual-style/performance-and-checklist.md §9) × ticks, each scene carrying a
  fixed `ownCellIndicators` record (plain data, §10; `null` for scenes without an own cell), so a baseline never
  depends on HUD timing or a live threat search; `check.sh`
  renders each through headless Chromium (the concept-art recipe) and compares with ImageMagick
  `compare -metric AE -fuzz 2%`; a baseline moves only in a PR that shows before / after under `qa/evidence/<pr>/`.
