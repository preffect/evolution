# Evolution — Rendering: the opening dive

Tickets #797 and #800, epic #795. The dive from orbit to the dish on the lobby (main menu), with the mockup's controls. The
mockup is the design (https://claude.ai/artifact/A674H91iLRxEa4MTzCRPhu): its look, labels, sizes, phase stops and
controls. This file says how the client draws it. The numbers are `render/constants/dive.ts` and the words
`render/constants/dive-script.ts`. Both carry the mockup's own values.

## 1. Where it lives

- **Panel:** `game/dive/dive-panel.component.ts` sits beside the lobby's forms from 1024 px wide, and right under
  Connection below that (`app.component.html`, ui/layout.md §2.1, ticket #805), so Connect & Join Lobby is never
  below the fold and the dive is in view without scrolling. It is DOM only: the readout,
  labels, scale bar, flag and controls. It gets a `DiveHandle` through the `OPENING_DIVE` token
  (`render/dive/dive-host.ts`), the same seam shape as the encyclopedia preview's (`preview/preview-host.ts`). A
  component spec provides `testing/fake-dive-handle.ts` and never touches Pixi.
- **Session:** `render/dive/dive-session.ts` is the fourth `FrameLoopSession`, beside a room's, the bench's and the
  preview's. The panel's stage element holds two canvases:
  - the upper bands' canvas (§4)
  - the session's Pixi app, which clears to transparent (`PixiAppOptions.isTransparent`). Its stage holds
    `gameRoot`, with a real `GameRenderer` in it (`FrameLoopSession.rendererStage` puts the renderer's layers
    there), the dish clip mask, and the planet (§4, ticket #800). The planet and the dish are never drawn in the same
    frame.
  - **Their order follows the band** (`render/dive/dive-upper-layers.ts`, `DiveMacroBand.stackOverGame`): while the
    planet shows, the upper bands' canvas lies over the Pixi canvas and is left clear for it, so the coast and shore
    draw over the planet; otherwise it lies under it, so the game's dish draws over the slime.
- **Start:** the app and the upper bands load in parallel (`dive-session-open.ts`). If either fails (no WebGL, a missing coastline, the
  chunk), or the panel closes first, the half that arrived is given back at once and `start` answers `false`; the
  stage then says "The opening dive could not load." and the lobby works on. The renderer's textures bake across
  frames (ticket #479) while the upper bands already draw, so the lobby never freezes on the bake. A failed bake
  leaves the dive on its upper bands. They bake at the organelle atlas's highest ratio whatever the screen's
  (`DIVE_BAKE_DEVICE_PIXEL_RATIO`).
- **Teardown:** the panel goes with the lobby, so joining a room destroys the dive before the room's
  `RenderSession` builds. `destroy` frees the planet's GPU objects (its quad, program, coastline textures and render
  texture), then runs `disposeLoop` in ticket #468's order (unbind, renderer and textures, app). The dive holds one
  WebGL context, the app's. The mockup's canvas and its baked tiles, and the planet's coastline bakes (kept by the
  loader, `diveUpperBandsLoader`), stay for the page, so a return to the lobby does not bake them again.
- **No debug hook:** the session never installs `window.__evolutionDebug`.

## 2. The log-zoom camera

`render/dive/dive-camera.ts` keeps one focus and one zoom.

- **Focus:** the rocky point where Victoria will be (`DIVE_FOCUS_DEGREES`).
- **Zoom:** log10 of the view's width in metres, from `DIVE_ZOOM_TOP` 7.4 (orbit) to `DIVE_ZOOM_BOTTOM` −5.6 (your
  cell filling the view). The mockup went on to −6.2, inside your cell; the game's cell holds its detail only to
  about −5.6, where it is drawn at about the organelle atlas's resolution, and past it the textures are magnified
  several times.
- **Upper bands:** they draw in metres round the focus (x east, y south), at `pixelsPerMetre = width / 10^zoom`.
- **Game renderer:** it takes the same scale as a fixed zoom, `pixelsPerMetre × DIVE_METRES_PER_WU` px per world
  unit, parked on the dish centre. `DIVE_METRES_PER_WU` makes the game's `DISH_RADIUS` the mockup's 40 µm pocket.
- **Planet turn:** the planet turns from Eurasia to the focus between zoom 7.3 and 6.75 (`diveGlobeRotation`).
- **Idle spin:** while the dive is in orbit above that turn (the wait for the autoplay's bakes, the hold before the
  fall), the planet turns on its own the same way, since the readout says "The planet turns…" (ticket #805). It
  starts at 3° a second and eases toward 90° (`DIVE_GLOBE_IDLE_SPIN`, `diveGlobeIdleSpin`), so a long wait never
  turns it past the focus; the opening turn takes up whatever it reached and still ends on the focus. It stands still
  while paused and under reduced motion (`dive-globe-idle.ts`).
- **Labels:** an amber dot and a text on a dark box, faded over each label's zoom range (`dive-labels.ts`). The
  script writes them in capitals with the units in lower case: CSS capitals would turn µ into a capital mu that
  reads as M. A label that would sit on the readout moves down below it. The panel measures the readout's box with a
  `ResizeObserver` (its words change with the zoom and wrap on a phone) and keeps the labels
  `DIVE_READOUT_CLEARANCE_PX` past it; until it has measured, `DIVE_READOUT_KEEP_OUT_PX` stands in, as wide as the
  readout's longest line on the 1280 stage (408 px). Two labels whose boxes would overlap, or sit closer than
  `DIVE_LABEL_SIDE_GAP_PX` side by side on one line (they would read as one label), stack: taken top first, each
  moves down under a box already set (`stackDiveLabels`), so the dish and a diatom in the same spot, or two labels
  pushed under the readout, both read. Their dots stay put. The boxes are as rendered: the panel lays every label's
  text out once unseen and measures it (`dive-stage-measures.ts`, again when the label font arrives); until then each
  width is estimated from the text's length (ticket #805).
- **Slider:** its `aria-valuetext` is the field of view. Under 560 px the tick row shows every second power of
  ten.

## 3. The bands

Each band draws in its own metres round the focus. It fades in over its window on the way down and stops drawing
once the view has passed it. `render/dive/dive-bands.ts` turns a camera into every band's `{ weight, isActive }`.
That table is the one place the windows live: the mockup's canvas and the game's renderer both read it.

| Band   | Fades in (zoom) | Stops drawing            | Drawn by                                        |
| ------ | --------------- | ------------------------ | ----------------------------------------------- |
| planet | always 1        | at or below 1.35         | **the game's Pixi app**: the planet shader      |
| shore  | 4.85 → 4.4      | at or below −1.42        | mockup: coast and shore over the globe          |
| kelp   | 2.4 → 2.1       | at or below −1.42        | mockup: the boulder and the stranded bull kelp  |
| drop   | 0.35 → 0.05     | at or below −2.96        | mockup: the blade's beads of spray and the drop |
| slime  | −1.95 → −2.35   | once the view is in dish | mockup: inside the drop, round the dish         |
| dish   | −3.7 → −4.22    | while dish radius < 2 px | **the game's renderer**                         |

- **The dish band:** it is the dark field arriving. While it fades in, the game canvas's CSS opacity is its weight,
  so the browser composites the fade as a group alpha. Above the band the opacity is 0 and the renderer does no
  work at all.
- **The handover:** the mockup's own pocket, its wall and its bacteria in the dish fade out by `1 − weight`.
- **The clip:** while the slime shows, `gameRoot` is clipped to the dish's outer wall (`DISH_RADIUS` plus the wall
  glass), so the slime round the dish stays the mockup's. Once the view lies inside the dish, the clip lifts.
- **Culling:** the mockup's canvas is hidden and not drawn when no mockup band is active, so in orbit (above the
  shore's fade at 4.85) the planet on the Pixi canvas is all that draws. Close in (below zoom 3) the mockup's canvas
  says whether any of the view lies past the rock band; when none does, the planet is not drawn and the canvas paints
  its own sea and land (`MockupBands.draw` answers whether the planet shows).
- **Between the planet and the dish** (zoom 1.35 to −3.7) the Pixi canvas draws nothing and its opacity is 0.
- **The shore weight:** it is also the planar world's fade over the globe. It stays 1 below its cut, so the
  close-ups under it still draw.

## 4. What draws each band

**The dish (the micro end) is the game's own.** `render/dive/dive-micro-scene.ts` is a scripted scene, never a room
snapshot. It builds a `RenderFrame` the way the encyclopedia preview does (`previewCellView`, `previewRenderFrame`),
so nothing the renderer draws is forked. It holds:

- **The field:** the dark field, the dish wall and its glass, the light pool and the vignette.
- **Your cell:** in the first seat's colour (Cyan) at the dish centre, with its self ring. The own-cell record is
  built by the encyclopedia lens's `actionSubjectOwnCellIndicators`.
- **Bacteria:** seeded wild cells in the cell shader. The dive turns the far dot off (`RenderInputs.isFarDotShown`):
  a cell under 8 px stays at mid LOD instead of a rim dot with a ×3 halo, a play-zoom legibility rule the dive does
  not need, so the bacteria grow from specks into cells with no bright orb between.
- **Food:** algae and detritus specks as the food layer's motes.
- **Sizes:** your cell is drawn at the mockup's 1.6 µm and each bacterium at 1.1–1.6 µm. Their masses are derived
  through the live growth curve. Bacteria stop at your size, so none can engulf you and none wears the warning
  ring. The specks keep the food layer's own size in world units.
- **Randomness:** the scene is seeded through `cosmetic:dive` (`DIVE_SEED`).
- **Reduced motion:** the scene's time stands still.
- **The vent:** the game's dish centre is the warm vent, under your cell. The dive hides the vent sprite
  (`RenderInputs.isVentShown`), so the end of the dive is your cell and not an orange glow.

**The planet is the game's (ticket #800).** From orbit to the shore (the planet band, above zoom 1.35) the planet,
the map and the forest are one shader on the dive's own Pixi app: the mockup's WebGL globe ported, with no second
WebGL context and no copy into a 2D canvas.

- **The band:** `render/dive/dive-planet-band.ts` holds the planet's GPU objects (`planet/dive-planet-mesh.ts`): a
  quad with the planet shader drawn into a render texture (`PixiAppHandle.renderToTexture`), and a sprite that lays
  that texture over the view. Two draw calls a frame.
- **The shader** (`planet/dive-planet-shader.ts`, with `-noise.ts` and `-land.ts`), GLSL ES 3.00:
  - Far out it ray-casts an orthographic sphere that matches `d3.geoOrthographic` turned by the dive's rotation, so
    the labels (`dive-labels.ts`) and the coast in metres sit on it. Close in (below `DIVE_PLANET_PLANE_BELOW_ZOOM`
    4.45) it draws plane metres round the focus.
  - Off the sphere: the dark, a few twinkling stars, and the atmosphere's glow on the lit side.
  - Land comes from signed distance bakes of the Natural Earth coastlines: the sea's shelf and shallows from the
    distance to the coast, the land's biomes by latitude and its deserts, and close in the Salish region's relief
    (its lowlands, the Olympics, the Coast Mountains, the Cascades and their volcanoes), snow, the dry side east of
    the Cascades, the oak meadows round Victoria and a conifer canopy.
  - Clouds drift and cast shadows; the Olympic rain shadow keeps the focus clear. They clear by zoom 6.1.
  - The light is the game's, from the top-left: a soft terminator, a sun glint on the sea, and no lights on the
    night side (no one is here yet).
  - Its fades are the mockup's (`constants/dive-planet.ts`): the clouds, the region's detail, the coast's
    antialiased edge, the crowns and the relief's exaggeration.
- **What it is told each frame:** `planet/dive-planet-frame.ts` works the uniforms out from the camera, and is the
  TypeScript reference of the shader's projection (`divePlanetEarthPointAt`, term for term with its `main`).
  `dive-planet-frame.spec.ts` pins every place name's dot to the sphere at its own place, as the planet turns and
  spins.
- **The coastline bakes** (`planet/dive-planet-bakes.ts`, the mockup's `bakeGlobal` and `bakeRegional`):
  - Each ring set is filled into a land mask by the nonzero rule at texel centres (`planet/land-raster.ts`). It is
    a path context, so `d3.geoPath` draws the world's rings into it after cutting them at the antimeridian. The
    mockup filled a Canvas 2D path and read it back; this needs no canvas.
  - The mask becomes a signed distance in texels (`planet/signed-distance.ts`: Felzenszwalb and Huttenlocher's
    squared distance transform, and the exact distance to the coast's segments within 3 texels of them, so the zero
    line is the vector coast). It is packed in three byte channels: quarter texels, texels and eight texels
    (`DIVE_SDF_LEVELS_PER_TEXEL`). The shader reads back the finest channel that has not saturated.
  - Three bakes, in this order: the world's quick bake (512 × 256), the world's (2048 × 1024) and the Salish
    region's (2048 wide over its rings' box). They bake in slices on the scheduler (`dive-bake-pump.ts`: 8 ms every
    10 ms) before the upper bands' tiles, and the lobby's autoplay waits for them. Measured in Node: about 0.1 s,
    0.5 s and 0.8 s of work, no step longer than 16 ms.
  - The planet never shows without land. On a cold open nothing draws until the quick bake lands; then the planet
    fades in, and when the world's full bake lands its coast comes up over the quick one, each across
    `DIVE_GLOBE_CROSSFADE_MS` (300 ms), or at once under reduced motion (`dive-globe-crossfade.ts`). This replaces
    the mockup's flat fallback globe (`drawGlobeFallback`). Each coastline slot's placeholder is a texel of open sea at
    a real texel's scale, so it never reads as shallows.
  - The finished bakes are kept by the loader, which lives for the page: a planet kept from an earlier open shows at
    once.
- **Resolution** (`planet/dive-planet-resolution.ts`, the mockup's `target` and its guard): the upper bands' ratio,
  at most 1.5× for the sphere's limb and 1× for the forest under the shore. Frames that keep coming more than 24 ms
  apart step it down by 0.8, clamped to no less than 0.55 (`DIVE_PLANET_RESOLUTION_GUARD`). The render texture is made again
  only when its size changes.

**The upper bands below the planet are the mockup's drawing for now.**

- **The module:** `render/dive/mockup/dive-mockup-bands.js` is the mockup's `src/*.js` made into one module. Its
  page globals became module state, its bake timer became the injected `SCHEDULER` (an 8 ms slice every 10 ms until
  every tile is made, as the mockup's `pump`), and its UI went to the panel. Its header and each section name the
  follow-up that deletes them: #801 the coast and shore, #802 the kelp and drop, #803 the slime. Its shore's sea
  depth takes the planet's distance transform (`distanceTransform2d`).
- **What it draws:** one Canvas 2D canvas. Where the planet shows it is cleared and the shore draws over it;
  elsewhere it paints the dark first. `render/dive/dive-macro-band.ts` lays it beside the game's canvas (§1).
- **Not a texture:** the ticket allowed uploading the canvas as a Pixi texture, and that was built first. It was
  dropped: the upload reads the canvas back every frame, and the bands' drawing then took 1,498 ms a frame at zoom
  3.3, against 16 ms on a canvas of their own (§6). The browser compositing two canvases costs no script time.
- **Resolution:** the canvas draws at up to 2× when still and 1.5× while the dive falls.
- **Size:** both canvases follow the stage itself. The panel watches the stage with a `ResizeObserver` and hands its
  size to the session (`DiveHandle.resizeStage`), since Pixi's `resizeTo` measures only on a window resize, which
  can come before the lobby's grid column has settled; the upper bands' canvas takes the app's size each frame
  (ticket #805).
- **Code standards:** it is JavaScript, outside eslint, prettier, jscpd and coverage (`.prettierignore`,
  `.jscpd.json`, `angular.json`). It is never brought up to `CODE-STANDARDS.md`: tickets #801–#803 move each band
  onto the game's renderer (shaders, baked textures, render-to-texture layers) and delete its part of the file.
- **Memory:** `release` shrinks the screen-sized canvases (the view, the layers, the zone layers, the sea grids) to
  nothing; each is made again at its size on the next draw. The tile bakes stay for the page, so a return to the
  lobby does not bake them again.
- **The lazy chunk:** `dive-bundle.spec.ts` pins on the sources that no static import chain from `main.ts` reaches
  the module or the planet's bakes, or names `d3-geo`.
- **Coastline data:** `assets/dive/world-rings.json` and `assets/dive/salish-rings.json` (Natural Earth rings,
  200 KB) and `d3-geo` load with the dive. The module and the planet's bakes are dynamic `import()`s (their own
  chunks), and the JSON is fetched once for both. None of it is in the game bundle.

## 5. Controls and UI

`render/dive/dive-controls.ts` is pure: every call takes the time it happens at, read off the injected clock.

- **Phase buttons:** one per stop (`DIVE_PHASE_STOPS`). A button plays that phase's opening: a 700 ms hold at the
  top, then a cubic in-out fall at 900 ms per power of ten, then the phase flag in the stop's colour.
- **Future phases:** phases 4 and 5 are ideas, drawn dashed and marked "(idea)".
- **Pause:** pauses and resumes. The paused span never plays.
- **Scrub:** the slider runs from Earth (left) to the cell (right), with a tick per power of ten and a mark per
  stop. Dragging stops the opening where the hand is and lowers the flag.
- **Skip:** Space or Esc jumps a playing opening to its stop, only when the dive owns the key: nothing handled it
  first and it was aimed at the page itself or at the dive's stage. A key on a lobby control (a button, a field,
  the slider) is that control's, and the encyclopedia's Esc closes the encyclopedia without skipping the dive. A
  paused or still dive ignores them.
- **Readout:** the field of view, its power of ten and the ladder's line for it (`dive-readout.ts`), on a soft dark
  backing (0.6 alpha) so it reads over your cell's membrane highlight and granules at the dive's bottom. On a stage
  561–700 px wide (the right-hand column at 1024 px) a container query sets it smaller and at most 60 % of the
  stage, so the planet's names stay by their dots; a phone's stage keeps it full size (ticket #805).
- **Scale bar:** the longest 5, 2 or 1 × 10ⁿ inside 18 % of the view.
- **Labels:** an amber dot and a text on a dark box, faded over each label's zoom range (`dive-labels.ts`).
- **Autoplay:** the lobby plays phase 1's opening `DIVE_AUTOPLAY_DELAY_MS` after it opens, once, and not before
  the upper bands' tiles have baked, so it never falls into a band still drawing its placeholder. It does not when
  the reader moved first, or when motion is reduced.
- **Reduced motion:** a button jumps straight to the stop, the ambient motion stands still, and a still dive
  draws a frame only when something changed. Asked for mid-fall, the opening jumps to its stop at once.
- **Off screen:** the panel stops the ticker while its stage is scrolled out of view, including a report that
  comes before the app exists.

## 6. Frame budget and measurement

- **The target:** 60 fps on a laptop's integrated GPU (epic #795), a 16.7 ms frame. Each band gets its budget
  when it moves onto the GPU.
- **The planet band's budget (ticket #800):** at most 2 ms of script and 2 draw calls a frame (the quad into its
  render texture, the sprite over the view), and one full-view fragment pass at most 1.5× (the sphere) or 1× (the
  forest). Its resolution guard steps the pass down when frames keep coming more than 24 ms apart (§4). Measured on
  the evidence box from zoom 7.3 to 5: 0.1–1.5 ms of script (its run-to-run noise is about 1 ms) and 2 draw calls,
  against 0.4–1.2 ms and one GL draw plus a copy into the 2D canvas on the mockup's globe. The fragment pass is the same shader at the same resolution, so on
  the box's software GL a frame's wall time with the GPU work forced to finish is the same within the box's noise
  (about 1.7–2.0 s either way at 1280 × 800).
- **What is measured:** `DiveFrameTimes` keeps the script milliseconds per frame of each part:
  - the upper bands' canvas drawing
  - the planet: its uniforms and its draw into its render texture
  - the game renderer's dish, outside the submit
  - the submit (the game canvas's draw calls)
- **How it is read:** `DiveHandle.takeFrameTimes()` returns the means since the last take, and
  `DiveHandle.probeFrames(zoom, frames)` draws `frames` frames at `zoom` back to back in one task and returns
  theirs. The evidence probe calls them through `ng.getComponent` in a dev build. There is no GPU on the evidence
  box, so script ms is the measure (ticket #208's rule).
- **Why back to back:** on the box's software GL a Canvas 2D call waits for the GPU process once its queue is full,
  so frames drawn one per animation frame charge that wait to the upper bands. Back to back, a band's script ms is
  its own work. The mockup's own `__zoomDbg.time` measures the same way, so the two compare like for like.

## 7. Tests

**Unit (vitest, no WebGL):**

- `dive-camera.spec.ts`: the scale, the dish's width in px per world unit, the planet's turn, its idle spin and the
  slider.
- `dive-bands.spec.ts`: the windows pinned literally, the cuts, the nesting, the crossfade, the 2 px and in-dish
  cuts.
- `dive-controls.spec.ts`: play, hold, fall, arrive, pause re-base, skip, scrub, reduced motion.
- `dive-readout.spec.ts`: `fmtLen`'s cases, the superscripts, the ladder's ends, the scale bar.
- `dive-labels.spec.ts`: the fade, the far side of the planet, Victoria's place, the flip and the clamps, the
  readout's keep-out (408 px, then measured) and the stacking through the handoff at 1280 and 390.
- `dive-micro-scene.spec.ts`: your size, the derived mass, food inside the dish, no warning ring, seeded, the
  tick.
- `dive-session.spec.ts`: over the fake Pixi app:
  - the dish draws only by the table, clipped then unclipped, over the mockup's canvas
  - a still reduced-motion dive draws nothing
  - autoplay plays once
  - `destroy` unbinds and releases
- `dive-session-planet.spec.ts`: the planet draws on the game's canvas from the first frame while the renderer
  bakes; the mockup's canvas lies over it while it shows; neither it nor the dish draws between them; the full
  coast's crossfade over the quick bake, at once under reduced motion; the autoplay held until its coastlines bake.
- `dive-bundle.spec.ts`: the mockup's module, the planet's bakes and `d3-geo` out of every static import chain
  from `main.ts`.
- `dive-session-start.spec.ts`: each half failing at start (the other given back), visibility reported before
  the app, reduced motion mid-fall, the autoplay held until the tiles bake. `dive-session.spec.ts` also: the idle
  spin (turning in orbit; still while paused, under reduced motion and below the turn).
- `dive-globe-crossfade.spec.ts`: the quick bake while the full one bakes, the rise across 300 ms, no fade back, a
  kept planet and reduced motion at once.
- `dive-planet-band.spec.ts`: the bakes in order and kept for the page, a slice stopped at its budget, nothing
  re-baked that was kept, the draw at the sphere's ratio, the crossfade's uniform.
- `dive-bake-pump.spec.ts`: 8 ms slices every 10 ms from 60 ms, the bakers in order, stopped on close.
- `planet/dive-planet-frame.spec.ts`: the fades; the scale; every place name's dot on the shader's sphere at its own
  place as the planet turns and spins; the focus at the centre; plane metres close in.
- `planet/dive-planet-mesh.spec.ts`, `dive-planet-shader.spec.ts`: the slots start as open sea, a bake replaces its
  slot and frees the old, the render texture sized to the resolution and kept while it holds, destroy frees all;
  GLSL ES 3.00, every uniform declared and set, every function defined, the bake's encoding read back.
- `planet/land-raster.spec.ts`, `signed-distance.spec.ts`, `dive-planet-bakes.spec.ts`, `dive-planet-resolution.spec.ts`:
  the nonzero fill at texel centres, the distance transform, the exact coast, the channels, the antimeridian cut,
  the region's box, the resolution's caps and its guard.
- `app.integration.spec.ts`: a room starting closes the dive.
- `dive-panel.component.spec.ts`: over the recording handle: the buttons, the slider, pause, the readout, the
  labels, the flag, Space and Esc but not while typing.
- `dive-panel-observers.spec.ts`: over a recording observer: the stage scrolled out of view, the stage resized on
  its own (no window resize), the labels kept clear of the readout's measured box, the labels kept apart by their
  measured boxes, every label's text laid out once to be measured.

**UI (Playwright, `pnpm --filter @evolution/client smoke`):** `e2e/lobby-dive-layout.spec.ts`: at 1280 × 800 and
1024 × 640 the dive beside Connect, both whole above the fold; at 390 × 844 Connect first, then the dive's whole
stage above the fold; no size scrolls sideways; at 1024 × 640 the readout at most 60 % of the stage; and the
canvases the stage's size after the window shrinks from 1920 to 1024, scrubbed to the shore, where both draw (in
orbit the upper bands' canvas is hidden).

**Visual evidence:**

- The 16 zoom levels of the mockup's `shot.cjs`, beside the mockup's own frames.
- Script ms per frame per band at the same levels (§6).
