# Evolution — Rendering: the opening dive

Tickets #797, #800, #801 and #802, epic #795. The dive from orbit to the dish on the lobby (main menu), with the mockup's controls. The
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
  - the upper bands' canvas (§4): the mockup's slime, drawn only while the slime band is active
  - the session's Pixi app, which clears to transparent (`PixiAppOptions.isTransparent`). Its stage holds
    `gameRoot`, with a real `GameRenderer` in it (`FrameLoopSession.rendererStage` puts the renderer's layers
    there), the dish clip mask, the planet (§4, ticket #800), the shore's quad over it (§4, ticket #801) and the kelp
    band's meshes over that (§4, ticket #802). The dive keeps one WebGL context. The planet, the shore and the kelp
    are never drawn in the same frame as the dish.
  - **Their order follows the band** (`render/dive/dive-upper-layers.ts`, `DiveMacroBand.stackOverGame`): while the
    planet, the shore or the kelp and the drop show, the upper bands' canvas lies over the Pixi canvas and is left
    clear round the slime, so the slime draws over the drop; otherwise it lies under it, so the game's dish draws over
    the slime.
- **Start:** the app and the upper bands load in parallel (`dive-session-open.ts`). If either fails (no WebGL, a
  missing coastline, the chunk), or the panel closes first, the half that arrived is given back at once and `start`
  answers `false`; the
  stage then says "The opening dive could not load." and the lobby works on. The renderer's textures bake across
  frames (ticket #479) while the upper bands already draw, so the lobby never freezes on the bake. A failed bake
  leaves the dive on its upper bands. They bake at the organelle atlas's highest ratio whatever the screen's
  (`DIVE_BAKE_DEVICE_PIXEL_RATIO`).
- **Teardown:** the panel goes with the lobby, so joining a room destroys the dive before the room's
  `RenderSession` builds. `destroy` frees the planet's, the shore's and the kelp's GPU objects (the planet's quad, program,
  coastline textures and render texture; the shore's quad and its levels' and tiles' textures; the kelp's six meshes,
  five programs and textures), then runs `disposeLoop` in ticket #468's order (unbind, renderer and textures, app). The dive holds one
  WebGL context, the app's (Pixi's own probes, a lost `isWebGLSupported` one and a detached 1 × 1 precision test,
  are there on main too). The mockup's canvas and its baked tiles, the planet's coastline bakes (kept by the
  loader, `diveUpperBandsLoader`) and the kelp's bakes (`kelp/kelp-module.ts`) stay for the page, so a return to the lobby does not bake them again.
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

| Band   | Fades in (zoom) | Stops drawing            | Drawn by                                     |
| ------ | --------------- | ------------------------ | -------------------------------------------- |
| planet | always 1        | at or below 1.35         | **the game's Pixi app**: the planet shader   |
| shore  | 4.85 → 4.4      | at or below −1.42        | **the game's shore band** (§4, ticket #801)  |
| kelp   | 2.4 → 2.1       | at or below −1.42        | **the game's kelp band** (§4, ticket #802)   |
| drop   | 0.35 → 0.05     | at or below −2.96        | **the game's kelp band**: beads, drop, blade |
| slime  | −1.95 → −2.35   | once the view is in dish | mockup: inside the drop, round the dish      |
| dish   | −3.7 → −4.22    | while dish radius < 2 px | **the game's renderer**                      |

- **The dish band:** it is the dark field arriving. While it fades in, the game canvas's CSS opacity is its weight,
  so the browser composites the fade as a group alpha. Above the band the opacity is 0 and the renderer does no
  work at all.
- **The handover:** the mockup's own pocket, its wall and its bacteria in the dish fade out by `1 − weight`.
- **The clip:** while the slime shows, `gameRoot` is clipped to the dish's outer wall (`DISH_RADIUS` plus the wall
  glass), so the slime round the dish stays the mockup's. Once the view lies inside the dish, the clip lifts.
- **Culling:** the mockup's canvas is hidden and not drawn unless the slime is active (below −1.95). Close in (below
  zoom 3) the planet's forest test (`shore/shore-forest-test.ts`, the mockup's `glOn`, which the mockup's canvas ran
  until ticket #802) says whether any of the view lies past the rock band; when none does, the planet is not drawn and
  the shore lays its own flat forest. It builds the shore's coast for the view only while the planet's band is active
  below zoom 3, and then once per 0.3 of zoom for that step's widest view
  (`SHORE_FOREST_TEST.rebuildStepZoom`), where the mockup built it every frame of the shore.
- **Between the drop and the dish** (zoom −2.96 to −3.7) the Pixi canvas draws nothing and its opacity is 0. From 1.35
  to −1.42 it draws the shore and the kelp, and from −1.42 to −2.96 the kelp band's blade, beads and drop.
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

**The coast and the shore are the game's own** (ticket #801). `render/dive/shore/` draws them as one quad on the
dive's own Pixi stage, over the planet and under the kelp band's meshes: one draw call a frame,
in the dive's submit, and no second WebGL context:

- **Levels of detail:** a level every 0.15 zoom from 4.85 down past the −1.42 cut (`shore-lod.ts`). Level k is
  drawn at zoom z_k and covers the view at z_k at the scale of z_k − 0.15, so it is never magnified. Fades and size
  thresholds are judged at the screen's scale (`screenPixelsPerMetre`), the raster at the level's
  (`pixelsPerMetre`). The next level crossfades in through the step, its edge feathered.
- **The snapshot:** each level's coast, forest edge, rock zones, rockweed, tide pools, boulders, kelp beds and far
  surf are drawn once by the mockup's Canvas 2D drawing, ported (`shore-snapshot.ts` and its parts), into a CPU
  canvas (`willReadFrequently`; GPU canvases in SwiftShader stalled for seconds on pattern fills and readbacks).
  Beside it the bake writes the sea data: a grid of signed distances to the coast (6 css px cells, 16 bits, exact
  within two cells of the coast), a stones mask and a per-level ramp of the shallows' colour by distance.
- **Baking:** the tiles, then the levels, bake as generators sliced on the injected `SCHEDULER` (an 8 ms slice
  every 10 ms, from 60 ms after open), each step forcing its raster so no deferred work lands on a frame. The camera's
  level bakes first, then five ahead the way it moves, one behind and the widest level (the anchor, kept always)
  (`shore-levels.ts`, `SHORE_LEVEL_CACHE`). Above the band the camera counts as at its top, so the first levels of the
  fall bake while the planet shows. A bake is dropped only when the camera has turned away from it. Levels the camera
  left are given back at the start of the next frame, once a frame has drawn without them. The levels bake at the
  stage's size, which the band takes from each frame's view.
- **The bake worker (ticket #809):** where the browser has workers and `OffscreenCanvas` with a 2D context, the
  tiles and the levels bake in a module worker (`shore-bake.worker.ts`, its logic in `shore-bake-worker-core.ts`),
  so no bake step lands on the page's thread. The band starts it with the dive and terminates it with the band
  (`ShoreBakeThread`, `shore-bake-thread.ts`). The page opens it once with the land and any tiles it already has
  (as `ImageBitmap`s), then asks for one level at a time; a newer ask replaces the one under way between two steps.
  The worker sends each tile as it bakes, copied into a page canvas for the kelp band and the live sea, and each
  level as `ImageBitmap`s and its data's buffers, all transferred. A level's bake on the page is then a generator
  that yields `SHORE_BAKE_WAITING` until its level lands, so `ShoreLevels` and its drafts, order and stand-ins are
  unchanged and the slices only poll. Upload stays on the page: a bitmap becomes an `ImageSource`, closed when the
  level is given back. Without `OffscreenCanvas` 2D, or once the worker fails (it says so, or its script throws),
  the page bakes in slices as above, the bake under way included. The worker is bundled by the Angular builder from
  `new Worker(new URL('./shore-bake.worker', import.meta.url), { type: 'module' })` in the shore's chunk.
- **Drafts:** each level bakes first at half its resolution (a quarter of the pixels, `SHORE_LEVEL_DRAFT_SCALE`),
  usable at once, and is redrawn at full resolution in place once every wanted level has its draft; a redraw under
  way is dropped for a level the camera needs and has nothing for. A fall waits only on drafts.
- **Stand-ins:** until the level in view lands, the nearest _coarser_ baked level stands in, and is kept until then:
  it covers the whole view, only softer. A finer one never does (it covers only the middle of the view; the rest
  would show the forest under it, or black).
- **The fall waits for its levels:** a level a bake behind costs about 450 ms close in on the evidence box, and the
  autoplay crosses one in about 57 ms. So a play never goes down into a level with no baked level at most two coarser
  than it (`ShoreLevels.fallFloorZoom`, through `DiveUpperLayers` to `DiveControls.tick`'s floor). Near the floor it
  eases in: each frame the gap to it shrinks by e^(−Δt / 120 ms) (`DIVE_FLOOR_EASE`), so it slows rather than stops
  dead, and with frames seconds apart it is just above the floor at once rather than frozen where it was. The play's
  clock is set to the zoom it shows (the ease's inverse), so once the floor drops it goes on from there. Until the tiles and the anchor have
  baked the floor is the band's top edge. A scrub and a skip do not wait: they show the nearest coarser level, softer,
  until theirs lands.
- **The shader** (`shore-shader-*.ts`): under the snapshot the water from the ramp, the seabed and the caustics, and
  the flat forest fill only while the planet does not show (the forest test, `shore/shore-forest-test.ts`); over it
  the swell and
  ripples, the glints, four breakers on iso-distance lines and the swash. These move every frame; the snapshot never
  does. The shader is linked once when the band opens, drawn into a one-pixel render texture of its own, so the link
  never lands mid-fall.
- **Shared with the kelp:** the land in metres (`shore-coast-rings.ts`), the tiles (`shore-tiles.ts`) and the canvas
  factory are made once for the page (`shore-module.ts`, `DiveShoreParts`); the kelp band bakes its coast from the
  same land and draws the rock with the same tiles. The forest test measures the shore's coast. The sea grid's
  distance transform is the planet's (`distanceTransform2d`).
- **The lazy chunk:** the shore's constants are imported from `render/constants/dive-shore*.ts` directly, never
  through the barrel, so all of it stays in the dive's chunk (`dive-bundle.spec.ts`).

**The boulder, the bull kelp, its spray beads and the drop are the game's own** (ticket #802). `render/dive/kelp/`
draws them as six meshes on the dive's own Pixi stage, over the shore's quad, no second WebGL context. Nothing is baked
per view: each part is a shader over geometry made once, with a few textures baked once a page, so any zoom draws its
true picture on the frame it is reached and a fall never waits on the band once it is ready.

- **The meshes,** in the mockup's order (`kelp-meshes.ts`), at most six draw calls a frame, only uniforms changing:
  - **the rock** (`kelp-shader-rock.ts`, `-rock-surface.ts`, `-barnacle.ts`): one quad round the focal rock, the
    shore's boulder (`shore-boulder.ts`) at `SHORE_FOCAL_ROCK`, seed 999. Its outline is the baked signed distance of
    the shore's own `rockPath`, sampled, so the contact shadows, the stone, its rim light and its foam collar are each
    a distance and a band. The stone: the greenstone's lit gradient (Canvas 2D's two-circle radial gradient, solved
    per pixel), its grain in overlay and its crystals at two octaves, the joints (the shore's `boulderJoint`), the
    barnacle cover on its face and the rockweed skirt (each its far tile's mean colour, the far mosaic, the near tile
    masked by it, as `zoneFill`), its volume and light pool. Where the sea is: the stone seen through it, drifting
    caustics added, the collar and the foam's lace. Below 0.45, single barnacles on the mockup's grid, found from the
    pixel's own cell and its neighbours and drawn in its order, under its 5,000-cell cap.
  - **the ribbons** (`kelp-ribbons.ts`, `kelp-ribbon-geometry.ts`, `kelp-shader-ribbon.ts`): the stipe and blades 4
    to 1, then, after the bulb, blade 0, each a strip of quads between its margins after its offset shadow. Each
    vertex carries the ribbon's frame and widths; the vertex shader pushes the strip out by the strokes' reach (a
    pixel count) and the fragment shader paints the mockup's layers past the level of detail it drew each at: fill,
    grain along blade 0, ruffles, midline glow and sheen, margin, lit near rim. The stipe is dimmed by the sea where
    it runs through the water and casts its shadow only on the land and the rock, both read off the baked coast, by
    the nonzero rule the mockup clipped them with (`isRockKeptOnLand`).
  - **the bulb** (`kelp-shader-bulb.ts`): one quad: the apophyses, its shadow, the float on its golden gradient with
    the light gathered at its far edge, growth rings, the window highlight, the glint and the outline.
  - **the blade floor** (`kelp-shader-floor.ts`): below the kelp's cut, a quad over the stage: the blade's colour,
    grain and midline glow through the focus (`fillBladeClose`).
  - **the lenses** (`kelp-shader-lens.ts`): a quad round each spray bead (placed once a page on the mockup's grid,
    on blade 0 and clear of the drop, `kelp-beads.ts`) and the drop last. A small bead is the mockup's sprite look,
    drawn analytically; a big one and the drop are lenses: the blade floor sampled magnified about the centre (the
    refraction, per pixel), the water's tint, the caustic, the sky window and its glint, and the rim; sinking in
    relaxes the drop's magnification and fades its lights.
- **What it is told each frame** (`kelp-frame.ts`): which parts draw, each by the mockup's own test (its size on
  screen, its zoom cut, a grid's cell cap), the two bands' fades, the foam's flicker, the close barnacles' fade and
  how far the camera is inside the drop; `kelp-uniforms.ts` writes it into the five programs (`kelp-programs.ts`).
- **Bakes, once a page** (`kelp-bakes.ts`, kept by `kelp-module.ts`): the blade's grain tile (the mockup's
  `BAKES.blade`), the rock's outline (1 cm texels) and the coast round the rock and the stipe (2 cm texels, the coast
  refined to two of them, filled as the shore fills its land) as signed distances in the planet's encoding, and the
  beads' places. They run on the dive's bake pump after the planet's coastlines (the longest step about 115 ms in
  Node), and the band draws the rock's surface and foam with the shore's own tiles.
- **Ready before the fall:** the band is ready once its bakes and the shore's tiles have landed; until then it draws
  nothing and a fall waits above its band (`fallFloorZoom`, the controls' eased floor), and the autoplay waits for
  it (`isBaked`). Its programs compile and link, and its textures upload, unseen into a pixel of its own while the
  dive is in orbit, so neither lands mid-fall.
- **Fades:** the mockup's alpha leaked between its strokes; the band applies each band's fade to all of its parts.
- **The lazy chunk:** its constants are `render/constants/dive-kelp*.ts`, imported directly, never through the barrel
  (`dive-bundle.spec.ts`).

**The slime is the mockup's drawing for now.**

- **The module:** `render/dive/mockup/dive-mockup-bands.js` is the mockup's `src/*.js` made into one module. Its
  page globals became module state, its bake timer became the injected `SCHEDULER` (an 8 ms slice every 10 ms until
  every tile is made, as the mockup's `pump`), and its UI went to the panel. Ticket #803 deletes it.
- **What it draws:** one Canvas 2D canvas, only while the slime band is active. While the drop still shows under it
  (on the Pixi canvas) it is cleared round the slime; past the drop it paints the dark first.
  `render/dive/dive-macro-band.ts` lays it beside the game's canvas (§1).
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
  onto the game's renderer (shaders, baked textures, render-to-texture layers) and delete its part of the file; #801
  and #802 have.
- **Memory:** `release` shrinks the screen-sized canvas to nothing; each is made again at
  its size on the next draw. The tile bakes stay for the page, so a return to the lobby does not bake them again.
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
- **The shore band's budget (ticket #801):** at most 1 ms of script and one draw call a frame; its bakes run in
  8 ms slices off the frame, a step at most about 100 ms on the evidence box. Measured on SwiftShader at 19 zooms
  from 4.8 to −1.3: 0.2–3.4 ms mean (the means above 1 ms are the box's load; the median is 0.3 ms), against
  8–5,700 ms for the mockup's coast and shore (worst frames 33 s at zoom 0 and 1.1 s at 0.6, its zone layers).
- **The shore's bakes off the main thread (ticket #809):** with the bake worker, a fresh-load autoplay fall on the
  evidence box (SwiftShader over Vulkan, 1280 × 800) spends 44–136 ms of main-thread script on the shore over the
  whole fall (the levels' texture uploads and the tiles' copies), against 3.0–5.2 s when the page bakes; no
  main-thread task over 50 ms comes from a shore bake. The fall takes 11.5–12.0 s at DPR 1 and 12.9–13.8 s at DPR 2
  (11.2 s with no floor), against 13.9–18.5 s and 17.5–20.8 s with the page's bakes, and its longest task is
  58–99 ms, against 102–309 ms (the rest is the mockup's kelp drawing, ticket #802).
- **The kelp band's budget (ticket #802):** at most 1 ms of script and six draw calls a frame (rock, two ribbon
  meshes, bulb, blade floor, lenses), no per-view bake; its once-a-page bakes run in 8 ms slices on the dive's pump,
  a step at most about 115 ms (Node; the coast's build). Measured on SwiftShader at 24 zooms from 2.4 to −2.8:
  0.0–1.2 ms mean (median 0.04 ms; the worst single frame 9.4 ms, the box's load), against 3–78 ms mean and frames
  up to 95 ms for the mockup's canvas over the same zooms (kelp, drop and, then, the forest test's coast build every
  frame of the shore).
- **What is measured:** `DiveFrameTimes` keeps the script milliseconds per frame of each part:
  - the upper bands: the planet's forest test and the mockup's slime canvas
  - the planet: its uniforms and its draw into its render texture
  - the shore band's frame (`shoreMs`)
  - the kelp band's frame (`kelpMs`)
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
- `dive-controls.spec.ts`: play, hold, fall, arrive, pause re-base, skip, scrub, reduced motion; waiting above a
  floor and going on from there, a pause not counted twice, a floor never pulling the dive back up, easing in with
  shrinking steps, and with frames 3 s apart reaching the floor at once and going on the frame after it drops.
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
  bakes; the mockup's canvas lies over the game's while the planet, the shore or the drop shows, and under it at the
  dish; neither the game's upper bands nor the dish draws between the drop and the dish; the full
  coast's crossfade over the quick bake, at once under reduced motion; the autoplay held until its coastlines bake.
- `dive-bundle.spec.ts`: the mockup's module, the planet's bakes, the shore band, the kelp band and `d3-geo` out of
  every static import chain from `main.ts`; the shore's bake worker started in the form the builder bundles, from the
  shore's chunk, with neither Pixi nor Angular in its import graph.
- `shore/shore-fall.spec.ts`: the autoplay's fall against bakes as slow as the evidence box's (450 ms a level), the
  real controls and levels on one simulated main thread: every frame in the band draws its level or one at most two
  coarser and the fall arrives, at 60 fps and with frames 1 s and 3 s apart (the slow-frame cases never arrived
  with the hold that froze at the old zoom), and without the wait it would draw wrong pictures. With the bakes in a
  worker (the same cost beside the main thread), at 60 fps and 1 s and 3 s apart: every frame right, no slice over
  50 ms (on the page the longest is the bake step), and the fall no later.
- `shore/shore-bake-worker-core.spec.ts`, `shore-bake-thread.spec.ts`: the worker's tiles sent once each (the
  page's adopted), the level asked for last sent with its pictures and buffers transferred, a newer ask replacing
  the one under way, a failure said once; on the page a tile adopted into a canvas, a level waited on without
  baking, a stale or untaken one closed, a failed worker's bake finished on the page, no worker without
  `OffscreenCanvas` 2D, the bundled worker started as a module.
- `render/dive/shore/*.spec.ts`: the noise against the mockup's hash bit for bit, the coast's rings and distances,
  the levels' zooms and scales, each tile's bake, the paint helpers, the near strokes and cells, the kelp beds and
  far rim, the land edge, the pools and boulders, the sea grid and ramp, the levels' bake order, stand-ins and
  release after the frame, the quad binding every uniform the GLSL declares, the live frame (sheets, breakers,
  swash), the band's bake and draw over the fake Pixi app, the module's page cache.
- `dive-upper-layers.spec.ts`: the shore's quad on the dive's stage over the planet and the kelp's meshes over it,
  the mockup's canvas over the Pixi canvas while only the shore or only the drop shows, both bakes counted in
  `isBaked`, a fall held at the higher floor, the forest test asked first and the shore told its answer, each band
  timed in its own column.
- `kelp/*.spec.ts`: the splines and ribbons (through the control points, blade 0 through the focus, the taper and
  ruffles), the ribbons' mesh (strips, shadows first, attributes), the rock's sampled outline and the distance bakes
  (+ inside, exact at the outline), the beads (the mockup's grid cell bit for bit, on blade 0, clear of the drop, in
  its order, shown by its tests), the blade's tile, the bakes stepped and kept, the nonzero rule for the rock on the
  land, each part's switch per zoom (`kelp-frame.spec.ts`), the five programs (GLSL ES 3.00, every uniform held and
  declared, every function defined), the meshes' order by identity, the uniforms written, the textures made and
  given back, the band (warm-up, readiness, textures once, parts shown, destroy) and the module's page bakes.
- `kelp/kelp-fall.spec.ts`: a phase played before the kelp's bakes land, on one simulated main thread with the real
  controls and band: no frame shows the band before it is ready and the fall arrives, at 60 fps and with frames 1 s
  and 3 s apart; without the floor it would reach the band unready.
- `shore/shore-forest-test.spec.ts`: off with the planet, on far out, on close in only while part of the view lies
  past the rock band.
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
- `kelp/dive-kelp.integration.spec.ts`: the session, the upper layers and the real kelp band over the fake app: its
  meshes on the dive's one app over the shore's quad, its bakes pumped by the dive and counted before the autoplay,
  its parts shown by the band table with the slime's canvas over the drop, its own frame-time column, given back
  with the dive.
- `shore/dive-shore.integration.spec.ts`: the session, the upper layers, the real shore band, levels and quad over
  the fake app: the quad on the dive's one app over the planet and under the kelp, the mockup's canvas over it, faded in over the
  planet, the crossfade through
  a step, hidden above its band and past its cut, its own frame-time column, given back with the dive.
- `dive-panel.component.spec.ts`: over the recording handle: the buttons, the slider, pause, the readout, the
  labels, the flag, Space and Esc but not while typing.
- `dive-panel-observers.spec.ts`: over a recording observer: the stage scrolled out of view, the stage resized on
  its own (no window resize), the labels kept clear of the readout's measured box, the labels kept apart by their
  measured boxes, every label's text laid out once to be measured.

**UI (Playwright, `pnpm --filter @evolution/client smoke`):** `e2e/lobby-dive-layout.spec.ts`: at 1280 × 800 and
1024 × 640 the dive beside Connect, both whole above the fold; at 390 × 844 Connect first, then the dive's whole
stage above the fold; no size scrolls sideways; at 1024 × 640 the readout at most 60 % of the stage; and the
canvases the stage's size after the window shrinks from 1920 to 1024, scrubbed into the drop, where both draw (above
the slime the upper bands' canvas is hidden).

**Visual evidence:**

- The 16 zoom levels of the mockup's `shot.cjs`, beside the mockup's own frames.
- Script ms per frame per band at the same levels (§6).
