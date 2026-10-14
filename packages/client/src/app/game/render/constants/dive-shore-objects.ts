// The opening dive's shore objects (docs/rendering/opening-dive.md §4, ticket #801): beaches, tide pools, driftwood and
// boulders, each the mockup's with its numbers here under the mockup's names (`drawBeaches`, `pool`, `drawDriftwood`,
// `boulder`). Every `salt` is a hash salt (`hash(seed, k, salt)`). Kept out of the `render/constants` barrel: only the
// dive's lazily loaded shore chunk reads it.

/** The stranded kelp's rock (`FOCAL_ROCK`) and the tide pool the mockup places by hand (`FIXED_POOL`), metres. */
export const SHORE_FOCAL_ROCK = { x: 0.15, y: -0.55, radiusM: 1.6 } as const;
export const SHORE_FIXED_POOL = { x: -9, y: -6, radiusXM: 3.2, radiusYM: 2, seed: 77 } as const;

/**
 * Sand coves where a slow noise says so, never within `clearOfFocusM` of the focus (`drawBeaches`): a broad noise
 * (`broadM`, offset) and a finer one, weighted, above `above`. Three strokes along them: the sand, its tile and a
 * shade over it, then the drift line and the wet sand.
 */
export const SHORE_BEACHES = {
  broad: { scaleM: 520, offsetX: 11.3, offsetY: 4.1, salt: 131, weight: 0.75 },
  fine: { scaleM: 130, salt: 133, weight: 0.25 },
  above: 0.66,
  clearOfFocusM: 350,
  sand: { halfWidthM: 11, shade: 'rgba(60,44,20,.18)', tileM: 2, tileFromPx: 4 },
  driftLine: { halfWidthM: 3, alpha: 0.75 },
  wetLine: { halfWidthM: 1, colour: 'rgba(60,52,40,.35)' },
} as const;

/**
 * Block-culled scatter near the coast (`nearCoastCells`): `blockCells` × `blockCells` cells a block, a block tested
 * once against the coast; a cell whose roll is above `skipAbove` is empty; a cell is in view `visibleCells` cells
 * out.
 */
export const SHORE_NEAR_CELLS = { blockCells: 4, skipAbove: 0.999, visibleCells: 2, blockBudget: 4 } as const;

/** A smooth closed blob round a centre through `points` points (`poolShape`, `rockPath`). */
export const SHORE_POOL_SHAPE = { points: 12, radius: { min: 0.78, span: 0.36 }, salt: 181, squash: 0.65 } as const;

/**
 * Tide pools (`drawPools`, `pool`): below `showBelowZoom`, fading in to `fullBelowZoom`, on a `cellM` grid between
 * `nearM` and `farM` up the shore, 30 % of the cells, clear of the focal rock and the fixed pool.
 */
export const SHORE_POOLS = {
  showBelowZoom: 2.9,
  fullBelowZoom: 2.5,
  cellM: 7,
  nearM: 1.8,
  farM: 10,
  salt: 201,
  maxCells: 1500,
  keepBelow: 0.3,
  clearOfRockM: 4,
  clearOfPoolM: 6,
  radiusM: { min: 0.5, span: 2.6 },
  squash: { min: 0.5 },
  seed: { column: 131 },
  minRadiusPx: 1.2,
  rim: { radius: 1.12, colour: 'rgba(28,30,28,.55)' },
  crust: { radius: 1.04, alpha: 0.75 },
  water: { lightX: -0.15, lightY: -0.1, core: 0.05, stops: ['#0d3f4a', '#1b5d63', '#3a8584'], middleStop: 0.7 },
  detailFromPx: 25,
  floorTile: { radius: 1.6, alpha: 0.45 },
  bottom: {
    count: 9,
    weeds: 4,
    spreadX: 1.3,
    spreadY: 1.2,
    radius: { min: 0.03, span: 0.05 },
    salts: { x: 191, y: 192, radius: 193 },
    weed: { colour: 'rgba(90,170,80,.55)', radiusX: 2.4, radiusY: 1.3 },
    anemone: {
      colour: 'rgba(70,150,110,.7)',
      tentacles: 12,
      colourTentacle: 'rgba(150,220,170,.6)',
      width: 0.18,
      from: 0.5,
      to: 1.25,
    },
  },
  sky: {
    from: { x: -1, y: -1 },
    to: { x: 0.2, y: 0.4 },
    stops: ['rgba(200,235,240,.32)', 'rgba(200,235,240,.06)', 'rgba(200,235,240,0)'],
    box: { x: -1.2, y: -1, width: 2.4, height: 2 },
  },
  edge: { colour: 'rgba(215,240,240,.5)', minPx: 1, width: 0.02 },
  glint: { rate: 1.7, alpha: 0.55, rgb: '255,255,245', x: -0.45, y: -0.3, radiusX: 0.09, radiusY: 0.035, turn: -0.5 },
} as const;

/** Driftwood on the upper shore (`drawDriftwood`): below `showBelowZoom`, fading in to `fullBelowZoom`. */
export const SHORE_DRIFTWOOD = {
  showBelowZoom: 2.6,
  fullBelowZoom: 2.25,
  cellM: 40,
  belowBandM: { near: 5, far: 1 },
  salt: 211,
  maxCells: 400,
  keepBelow: 0.5,
  slopeProbeM: 1,
  slopeQueryM: 30,
  turnJitter: 0.5,
  lengthM: { min: 3, span: 9 },
  widthM: { min: 0.35, span: 0.9 },
  shadow: { colour: 'rgba(10,10,8,.4)', x: 0.35, y: 0.5, radiusY: 0.62 },
  middleStop: 0.45,
  grainFromPx: 6,
  grain: {
    colour: 'rgba(90,82,70,.5)',
    minPx: 0.8,
    width: 0.03,
    lines: 5,
    spread: 0.7,
    inset: 0.4,
    sixth: 6,
    bow: 0.06,
  },
  end: { colour: '#c9c1b0', inset: 0.12, radiusX: 0.12, radiusY: 0.48 },
  ring: { colour: 'rgba(110,100,86,.8)', radiusX: 0.06, radiusY: 0.26 },
} as const;
