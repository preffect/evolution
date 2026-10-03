// The opening dive's shore band (docs/rendering/opening-dive.md §4, ticket #801): the mockup's `drawShore` numbers
// under its own names, and the band's levels of detail. Kept out of the `render/constants` barrel: only the dive's
// lazily loaded shore chunk reads it.

/** A tile's mean colour is sampled from every 7th pixel (`finishTex`'s `i += 4 * 7`). */
export const SHORE_TILE_AVERAGE_STRIDE = 7;

/** Self-similar tiles step by this ratio between octaves and come to about `targetPx` on screen (`octaves`). */
export const SHORE_OCTAVE = { ratio: 4, targetPx: 380 } as const;

/** A true-size tile comes up from its mean colour between these sizes on screen (`trueStyle`'s `sstep(40, 90)`). */
export const SHORE_TRUE_TILE_PX = { from: 40, to: 90 } as const;

/**
 * The sea's distance grid (`seaDistance`): `cellPx` CSS px a cell, `padCells` past the view, `padFineCells` more to
 * measure land just past the edge exactly; the coarse grid is `coarseFactor` (doubling) cells to one, at most
 * `coarseMaxCells`; no ramp reaches past `marginShare` of the coast's margin or `widestStrokeM`.
 */
export const SHORE_SEA_GRID = {
  cellPx: 6,
  padCells: 4,
  padFineCells: 8,
  coarseFactor: 4,
  coarseGrowth: 2,
  coarseMaxCells: 12000,
  marginShare: 0.9,
  widestStrokeM: 9000,
} as const;

/** The ramps' lookup table: at most this many entries, a quarter cell apart (`LUT_MAX`, `rampLut`). */
export const SHORE_RAMP_TABLE = { maxEntries: 4096, entriesPerCell: 4 } as const;

/**
 * The shallows (`drawShallows`): `strokes` round-joined strokes of the coast, widest first, from `farHalfWidthM` down
 * to `nearHalfWidthM` on a log scale, coloured from `far` to `near`, at `alphaBase + alphaGain × t`.
 */
export const SHORE_SHALLOWS = {
  strokes: 28,
  farHalfWidthM: 9000,
  nearHalfWidthM: 3,
  far: '#134660',
  near: '#22716c',
  alphaBase: 0.045,
  alphaGain: 0.13,
  alphaDecimals: 3,
} as const;

/** How much sea floor shows: six strokes, each keeping `1 − share` of what is under it (`DMASK_W`, `depthMask`). */
export const SHORE_DEPTH_MASK = { halfWidthsM: [34, 25, 18, 12, 7, 3.5], share: 0.26 } as const;

/**
 * The sea floor through the shallows (z < 2.9): it fades in over `fadeFromZoom → fadeToZoom` at up to `alpha`, the
 * floor's tile `tileM` across (`seabed`, 5 m).
 */
export const SHORE_SEABED = { fadeFromZoom: 2.9, fadeToZoom: 2.4, alpha: 0.42, tileM: 5 } as const;

/** The view-sized layers are this many CSS px larger on each side, so a scaled-up edge never shows (`- 2`, `+ 4`). */
export const SHORE_LAYER_BLEED_PX = 2;

/** Far out (z > 3.6) the surf is a bright rim along the coast, `max(2.4 px, 8 m)` wide, fading in 4.8 → 4.3. */
export const SHORE_FAR_SURF = {
  aboveZoom: 3.6,
  minWidthPx: 2.4,
  widthM: 8,
  alpha: 0.45,
  fadeFromZoom: 4.8,
  fadeToZoom: 4.3,
} as const;

/** The flat forest the shore lays under its land when the planet's forest is not drawn (`'#1c3320'`). */
export const SHORE_LAND_FILL = '#1c3320';

/** The kelp beds the mockup places by hand near the focus: `[x, y, radius]` metres (`KELP_PATCHES`). */
export const SHORE_KELP_PATCHES: readonly (readonly [number, number, number])[] = [
  [180, 70, 30],
  [-140, 95, 38],
  [420, 120, 44],
  [-420, 60, 26],
  [40, 150, 32],
  [760, 180, 54],
  [-800, 150, 48],
];

/**
 * Kelp beds offshore (`kelpBeds`, `drawKelpBeds`): drawn below `showBelowZoom`, fading in to `fullBelowZoom`. Below
 * `scatterBelowZoom` more beds scatter on a `cellM` grid (half the cells, not within `clearOfFocusM` of the focus,
 * `radiusM` across), at most `maxCells`; a bed lies at least `half its radius + clearOfCoastM` out, at most
 * `farthestM`, and each is `lobes` ellipses.
 */
export const SHORE_KELP_BEDS = {
  showBelowZoom: 4.1,
  fullBelowZoom: 3.6,
  scatterBelowZoom: 3.8,
  cellM: 150,
  maxCells: 900,
  keepBelow: 0.5,
  clearOfFocusM: 1200,
  radiusM: { min: 22, span: 50 },
  seed: { x: 7, column: 31 },
  salts: { keep: 141, x: 142, y: 143, radius: 144, lobeAngle: 151, lobeRadius: 152, lobeDistance: 153 },
  visibleRadii: 1.6,
  queryM: 400,
  clearOfCoastRadii: 0.5,
  clearOfCoastM: 10,
  farthestM: 380,
  lobes: 13,
  lobeRadius: { min: 0.2, span: 0.35 },
  lobeDistance: 0.75,
  lobeSquash: 0.6,
  lobeWidth: 1.3,
  lobeHeight: 0.8,
  lobeTurn: 0.5,
  fill: { rgb: '60,48,20', alpha: 0.22 },
  edge: { widthRadii: 0.15, alpha: 0.1 },
  farTile: { tileM: 150, alpha: 0.9 },
  nearTile: { tileM: 24, alpha: 0.95 },
} as const;

/**
 * Single plants in a bed (`kelpPlants`), below `showBelowZoom`, fading in to `fullBelowZoom`: on a `cellM` grid, 60 %
 * of the cells, inside 0.8 of the bed's ellipse, each a bulb and `blades` blades streaming down-current. Drawn still:
 * the sway the mockup gives them is at its rest (the snapshot's clock is 0).
 */
export const SHORE_KELP_PLANTS = {
  showBelowZoom: 2.3,
  fullBelowZoom: 1.9,
  cellM: 2.4,
  maxCells: 2500,
  bedReach: { x: 1.4, y: 1 },
  bedSquash: { x: 1.3, y: 0.8 },
  insideBed: 0.8,
  keepBelow: 0.6,
  visibleM: 3,
  salts: { keep: 161, x: 162, y: 163, bladeAngle: 164, bladeLength: 170 },
  sway: { rate: 0.8, column: 0.7, row: 1.3, amount: 0.12 },
  blades: 6,
  bladeAngle: 0.5,
  bladeMiddle: 2.5,
  bladeFan: 0.11,
  bladeJitter: 0.2,
  bladeLengthM: { min: 1.2, span: 1.8 },
  bladeBendM: { x: 0.15, y: -0.1 },
  bladeWidthM: 0.11,
  bladeColours: ['#937030', '#7a5d22'],
  shadow: { colour: 'rgba(20,14,4,.5)', x: 0.03, y: 0.04, radiusM: 0.075 },
  bulb: { radiusM: 0.065, lightX: -0.025, lightY: -0.03, coreM: 0.005, baseStop: 0.6 },
} as const;

/** A near stroke's path is thinned to this share of its narrowest width, never under `toleranceMinPx` (`strokeNearPath`). */
export const SHORE_NEAR_STROKE = { toleranceShare: 0.015, toleranceMinPx: 0.35 } as const;

/**
 * The zones' far tiles (`FAR`): each zone's near tile is `tileM` across and its far tile `farScale` times that. The
 * far tile comes up between `farFromPx` and `farToPx` of far tile on screen, the near one between `nearFromPx` and
 * `nearToPx` of near tile; under `nearMinWeight` the near layer is not drawn.
 */
export const SHORE_ZONE_TILES = {
  barnacle: { farScale: 25, tileM: 0.24 },
  mussel: { farScale: 12, tileM: 0.5 },
  rockweed: { farScale: 8, tileM: 0.9 },
  lowzone: { farScale: 8, tileM: 0.7 },
} as const;
export const SHORE_ZONE_FADE = {
  farFromPx: 24,
  farToPx: 70,
  nearFromPx: 60,
  nearToPx: 130,
  nearMinWeight: 0.02,
} as const;

/** The intertidal zones from the forest's edge down to the water, as half-widths up the shore in metres (`ZONE`). */
export const SHORE_ZONE_REACH_M = {
  band: 16,
  lichen: 12.5,
  barnacle: 8,
  mussel: 6.2,
  rockweed: 4.6,
  low: 1.7,
} as const;

/**
 * The land's edge (`drawShore`'s second half): the forest's shadow on the upper shore (two strokes past the rock
 * band), then the bare rock band. While the band is under `simpleUnderPx` across it is one stroke of `simpleColour`,
 * at least `simpleMinPx` wide; past that each zone reaches up the shore a distance that wanders with two noise octaves
 * (`reach`), and is filled inside its band. The forest's edge throws its shade down onto the rock, and the rock is wet
 * at the waterline.
 */
export const SHORE_LAND_EDGE = {
  forestShadows: [
    { pastBandM: 4, colour: 'rgba(6,12,6,.55)' },
    { pastBandM: 1.5, colour: 'rgba(18,26,14,.5)' },
  ],
  simpleUnderPx: 3,
  simpleMinPx: 1.6,
  simpleColour: '#8d887b',
  reachNoise: { broadM: 38, broadWeight: 0.5, fineM: 7, fineWeight: 0.22 },
  offsetWindow: 3,
  /** A zone can reach this many of its half-widths up the shore: the box its fills stay in. */
  boxReach: 1.72,
  salts: { band: 401, lichen: 411, barnacle: 421, mussel: 431, rockweed: 441, low: 451 },
  rockFills: [
    { tileM: 8, alpha: 1, targetPx: 700 },
    { tileM: 30, alpha: 0.35, targetPx: 1400 },
  ],
  edgeShades: [
    { halfWidthM: 3.5, colour: 'rgba(8,14,6,.4)' },
    { halfWidthM: 1.5, colour: 'rgba(8,14,6,.35)' },
  ],
  lichen: { tileM: 10, alpha: 0.65, targetPx: 900 },
  barnacleUnder: 'rgba(40,36,30,.18)',
  zoneAlphas: { barnacle: 0.95, mussel: 0.7, rockweed: 0.95, lowzone: 0.95 },
  wetRock: { halfWidthM: 0.5, colour: 'rgba(30,34,32,.45)' },
} as const;

/**
 * The live sea's data (`shore-sea-data.ts`): the signed distance to the coast on the sea's distance grid, in cells
 * (`cellSteps` steps a cell, offset so the 16 bits are unsigned); cells within `exactWithinCells` of the coast take the
 * exact distance to the refined coast. The stones in the water are drawn one texel every `stonesCellPx` CSS px.
 */
export const SHORE_SEA_DATA = {
  cellSteps: 16,
  offset: 32768,
  maxValue: 65535,
  exactWithinCells: 2,
  stonesCellPx: 2,
} as const;

/**
 * The band's levels of detail (`shore-lod.ts`): one snapshot every `stepZoom` from `topZoom` (where the shore starts
 * to fade in) to the band's cut. A level is drawn `10^stepZoom` larger than the stage, so it covers the views a step
 * wider than its own and is never magnified; it bakes at most at `maxDevicePixelRatio`.
 */
export const SHORE_LOD = { topZoom: 4.85, cutZoom: -1.42, stepZoom: 0.15, maxDevicePixelRatio: 1.5 } as const;

/** A tile drawn under this share of its baked size is shrunk to the size it is drawn at before it fills (`patternAt`). */
export const SHORE_PATTERN_SHRINK_BELOW = 0.8;

/**
 * The levels kept near the camera: its own, `ahead` more the way it is going, and one behind; the `anchor` level (the
 * widest, cheap to bake) is kept always, so any view has a coarser stand-in. A fall waits above a level until one at
 * most `standInSteps` coarser than it has baked: a coarser level covers the view, only softer.
 */
export const SHORE_LEVEL_CACHE = { ahead: 5, anchor: 0, standInSteps: 2 } as const;

/**
 * Each level bakes first at this share of its resolution (a quarter of the pixels), usable at once and redrawn at full
 * resolution in place once every level wanted has its draft: a fall waits only on drafts.
 */
export const SHORE_LEVEL_DRAFT_SCALE = 0.5;

/**
 * The planet's forest test (the mockup's `glOn` in `drawFrame`): below `belowZoom` the planet's forest shows under the
 * shore only where some of the view lies past the rock band, measured at the view's corners, edges' middles and
 * centre to `reachBands` bands plus half the view, more than `insetM` short of the band's top.
 */
export const SHORE_FOREST_TEST = { belowZoom: 3, reachBands: 3, insetM: 2 } as const;
