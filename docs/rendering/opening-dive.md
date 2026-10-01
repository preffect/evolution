# Evolution — Rendering: the opening dive

Ticket #797, epic #795. The dive from orbit to the dish on the lobby (main menu), with the mockup's controls. The
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
  preview's. The panel's stage element holds two canvases, bottom to top:
  - the upper bands' canvas (§4), first in the stage
  - the session's Pixi app, which clears to transparent (`PixiAppOptions.isTransparent`). Its stage holds
    `gameRoot`, with a real `GameRenderer` in it (`FrameLoopSession.rendererStage` puts the renderer's layers
    there), and the dish clip mask.
- **Start:** the app and the upper bands load in parallel. If either fails (no WebGL, a missing coastline, the
  chunk), or the panel closes first, the half that arrived is given back at once and `start` answers `false`; the
  stage then says "The opening dive could not load." and the lobby works on. The renderer's textures bake across
  frames (ticket #479) while the upper bands already draw, so the lobby never freezes on the bake. A failed bake
  leaves the dive on its upper bands. They bake at the organelle atlas's highest ratio whatever the screen's
  (`DIVE_BAKE_DEVICE_PIXEL_RATIO`).
- **Teardown:** the panel goes with the lobby, so joining a room destroys the dive before the room's
  `RenderSession` builds. `destroy` runs `disposeLoop` in ticket #468's order (unbind, renderer and textures, app)
  and gives the planet's WebGL context back. The mockup's canvas and its baked tiles stay for the page, so a return
  to the lobby does not bake them again.
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
  readout's longest line on the 1280 stage (408 px). Two labels whose boxes would overlap stack: taken top first,
  each moves down under a box already set (`stackDiveLabels`), so the dish and a diatom in the same spot, or two
  labels pushed under the readout, both read. Their dots stay put (ticket #805).
- **Slider:** its `aria-valuetext` is the field of view. Under 560 px the tick row shows every second power of
  ten.

## 3. The bands

Each band draws in its own metres round the focus. It fades in over its window on the way down and stops drawing
once the view has passed it. `render/dive/dive-bands.ts` turns a camera into every band's `{ weight, isActive }`.
That table is the one place the windows live: the mockup's canvas and the game's renderer both read it.

| Band   | Fades in (zoom) | Stops drawing            | Drawn by                                        |
| ------ | --------------- | ------------------------ | ----------------------------------------------- |
| planet | always 1        | at or below 1.35         | mockup: WebGL globe, map and forest             |
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
- **Culling:** the mockup's canvas is hidden and not drawn when no mockup band is active.
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

**The upper bands are the mockup's drawing for now.**

- **The module:** `render/dive/mockup/dive-mockup-bands.js` is the mockup's `src/*.js` made into one module. Its
  page globals became module state, its bake timer became the injected `SCHEDULER` (an 8 ms slice every 10 ms until
  every tile is made, as the mockup's `pump`), and its UI went to the panel. The world's and the region's coastline
  bakes go in the same sliced queue rather than being drained on the spot; until the world's lands the planet draws
  as the flat fallback globe. When it lands, the full planet (its stars, rim and clouds) comes up over the fallback
  over `DIVE_GLOBE_CROSSFADE_MS` (300 ms) instead of in one frame, or at once under reduced motion (ticket #805). Its header and each section name the follow-up that deletes them: ticket #800 the
  planet, #801 the coast and shore, #802 the kelp and drop, #803 the slime.
- **What it draws:** one Canvas 2D canvas, with the planet's WebGL canvas drawn into it.
  `render/dive/dive-macro-band.ts` puts that canvas first in the stage, under the game's.
- **Not a texture:** the ticket allowed uploading the canvas as a Pixi texture, and that was built first. It was
  dropped: the upload reads the canvas back every frame, and the bands' drawing then took 1,498 ms a frame at zoom
  3.3, against 16 ms on a canvas of their own (§6). The browser compositing two canvases costs no script time.
- **Resolution:** the canvas draws at up to 2× when still and 1.5× while the dive falls.
- **Code standards:** it is JavaScript, outside eslint, prettier, jscpd and coverage (`.prettierignore`,
  `.jscpd.json`, `angular.json`). It is never brought up to `CODE-STANDARDS.md`: tickets #800–#803 move each band
  onto the game's renderer (shaders, baked textures, render-to-texture layers) and delete its part of the file.
- **Memory:** `release` gives back the planet's WebGL context and shrinks the screen-sized canvases (the view, the
  layers, the zone layers, the sea grids) to nothing; each is made again at its size on the next draw. The tile and
  coastline bakes stay for the page, so a return to the lobby does not bake them again.
- **The lazy chunk:** `dive-bundle.spec.ts` pins on the sources that no static import chain from `main.ts` reaches
  the module or names `d3-geo`.
- **Coastline data:** `assets/dive/world-rings.json` and `assets/dive/salish-rings.json` (Natural Earth rings,
  200 KB) and `d3-geo` load with the dive. The module is a dynamic `import()` (its own chunk), and the JSON is
  fetched. None of it is in the game bundle.

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
  backing so it reads over your cell's membrane highlight at the dive's bottom (ticket #805).
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

- **The target:** 60 fps on a laptop's integrated GPU (epic #795). This ticket ports; the budget per band and the
  quality governor belong to the follow-ups that move each band onto the GPU.
- **What is measured:** `DiveFrameTimes` keeps the script milliseconds per frame of each part:
  - the upper bands' canvas drawing
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
  - the upper bands draw while the renderer bakes
  - the dish draws only by the table, clipped then unclipped
  - a still reduced-motion dive draws nothing
  - autoplay plays once
  - `destroy` unbinds and releases
- `dive-bundle.spec.ts`: the mockup's module and `d3-geo` out of every static import chain from `main.ts`.
- `dive-session.spec.ts` also: each half failing at start (the other given back), visibility reported before the
  app, reduced motion mid-fall, the autoplay held until the tiles bake, the idle spin (turning in orbit; still while
  paused, under reduced motion and below the turn) and the planet's crossfade.
- `app.integration.spec.ts`: a room starting closes the dive.
- `dive-panel.component.spec.ts`: over the recording handle: the buttons, the slider, pause, the readout, the
  labels, the flag, Space and Esc but not while typing, and the labels kept clear of the readout's measured box.

**UI (Playwright, `pnpm --filter @evolution/client smoke`):** `e2e/lobby-dive-layout.spec.ts`: at 1280 × 800 and
1024 × 640 the dive beside Connect, both whole above the fold; at 390 × 844 Connect first, then the dive's whole
stage above the fold; no size scrolls sideways.

**Visual evidence:**

- The 16 zoom levels of the mockup's `shot.cjs`, beside the mockup's own frames.
- Script ms per frame per band at the same levels (§6).
