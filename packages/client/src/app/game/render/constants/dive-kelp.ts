// The opening dive's stranded bull kelp and its rock (docs/rendering/opening-dive.md §4, ticket #802): the mockup's
// `BLADE_PTS`, `STIPE_PTS`, `BULB`, `drawBlade`, `drawStipe`, `drawBulb`, `drawFocal` and `closeBarnacles` numbers
// under its own names. Metres round the focus (x east, y south); numbers "of the radius" or "of the width" are
// shares. Kept out of the `render/constants` barrel: only the dive's lazily loaded kelp chunk reads it.

/** One Catmull-Rom control point in metres. */
export type KelpPoint = readonly [number, number];

/** The five blades from the bulb (`BLADE_PTS`); blade 0 runs through the focus, and every close-up lies along it. */
export const KELP_BLADE_POINTS: readonly (readonly KelpPoint[])[] = [
  [
    [0.9, 0.45],
    [0.45, 0.2],
    [0, 0],
    [-0.8, -0.35],
    [-1.6, -0.75],
    [-2.2, -1.1],
  ],
  [
    [0.9, 0.45],
    [0.5, 0.05],
    [0.05, -0.35],
    [-0.6, -0.9],
    [-1.1, -1.6],
  ],
  [
    [0.9, 0.45],
    [0.55, 0.35],
    [-0.1, 0.45],
    [-0.9, 0.4],
    [-1.8, 0.55],
  ],
  [
    [0.9, 0.45],
    [0.7, -0.1],
    [0.55, -0.7],
    [0.3, -1.4],
    [0.2, -2.0],
  ],
  [
    [0.9, 0.45],
    [0.35, 0.55],
    [-0.4, 0.9],
    [-1.2, 1.15],
  ],
];

/** The stipe from its holdfast out in the water to the bulb (`STIPE_PTS`). */
export const KELP_STIPE_POINTS: readonly KelpPoint[] = [
  [11.5, 13.5],
  [8.2, 9.4],
  [6.2, 7.0],
  [4.6, 5.2],
  [3.4, 3.1],
  [2.2, 1.6],
  [1.4, 0.8],
  [0.9, 0.45],
];

/**
 * The Catmull-Rom basis (`spline`'s `f`): row n holds the weights of `[a, b, c, d]` on tⁿ, all times
 * `KELP_CATMULL_ROM_SCALE`, so a span through `b` → `c` passes through both with the tangents its neighbours set.
 */
export const KELP_CATMULL_ROM_BASIS: readonly (readonly [number, number, number, number])[] = [
  [0, 2, 0, 0],
  [-1, 0, 1, 0],
  [2, -5, 4, -1],
  [-1, 3, -3, 1],
];
export const KELP_CATMULL_ROM_SCALE = 0.5;

/** The splines' sample spacing in metres (`spline(pts, step)`), and the fewest samples a span gets. */
export const KELP_SPLINE = { bladeStepM: 0.003, stipeStepM: 0.01, minSamplesPerSpan: 2 } as const;

/** The mockup's full turn in its trigonometry (`6.283`): kept, so every wave lands where it did. */
export const KELP_TURN = 6.283;

/**
 * A blade's outline (`BLADES`): `widthM` wide (blade i > 0 is `otherWidth.base + otherWidth.perBlade × i` of it),
 * narrow at the bulb and tapering to the tip, its two margins ruffled by three waves and a little value noise.
 */
export const KELP_BLADE = {
  widthM: 0.11,
  otherWidth: { base: 0.85, perBlade: 0.1 },
  taper: { baseShare: 0.25, growM: 0.35, tipShare: 0.85, tipM: 0.5 },
  waves: [
    { periodM: 0.045, amplitude: 0.055, perBlade: 1.7, perSide: 2.1 },
    { periodM: 0.071, amplitude: 0.045, perBlade: 2.3, perSide: 4.4 },
    { periodM: 0.16, amplitude: 0.03, perBlade: 1, perSide: 1 },
  ],
  ruffleNoise: { amplitude: 0.05, periodM: 0.018, perBlade: 7, perSide: 3, salt: 551 },
  /** Blade 0's direction at the focus (`BLADE_ANG = atan2(-.2, -.45)`): the close-ups' grain lies along it. */
  directionY: -0.2,
  directionX: -0.45,
} as const;

/** The stipe's half width: `baseM`, swelling by `swellM` over its last `swellOverM` to the bulb. */
export const KELP_STIPE = { baseHalfWidthM: 0.006, swellM: 0.012, swellOverM: 3 } as const;

/** How a blade is drawn (`drawBlade`): its level of detail in px of `widthM` on screen, then each layer. */
export const KELP_BLADE_LOOK = {
  minPx: 1.5,
  detailPx: 8,
  edgeLightPx: 20,
  shadow: { offsetX: 0.014, offsetY: 0.018, colour: [10, 8, 4], alpha: 0.32 },
  fill: { even: '#8a6a2a', odd: '#80622a', alpha: 0.96 },
  surface: { tileM: 0.4, alpha: 0.55, targetPx: 420 },
  ruffles: {
    periodM: 0.045,
    showAbovePx: 36,
    widthShare: 0.3,
    outer: 0.97,
    inner: 0.66,
    bend: 0.3,
    crest: { colour: [240, 206, 130], alpha: 0.12 },
    trough: { colour: [40, 24, 4], alpha: 0.13 },
  },
  midline: { widthShare: 0.34, colour: [214, 170, 84], alpha: 0.2 },
  sheen: { offsetShare: 0.12, widthShare: 0.07, colour: [255, 246, 220], alpha: 0.14 },
  margin: { colour: [46, 30, 6], alpha: 0.55, minPx: 1, widthM: 0.0015 },
  edgeLight: { insetM: 0.002, colour: [250, 220, 150], alpha: 0.35, minPx: 1, widthM: 0.002 },
} as const;

/** How the stipe is drawn (`drawStipe`): hidden under `minPx` of `widthM`, and once the view is past the rock. */
export const KELP_STIPE_LOOK = {
  widthM: 0.03,
  minPx: 1,
  hideAtOrBelowZoom: -0.3,
  shadow: { offsetX: 0.01, offsetY: 0.014, colour: [8, 6, 2], alpha: 0.35 },
  fill: '#5f4418',
  midline: { offsetM: 0.004, widthM: 0.009, colour: [210, 170, 90], alpha: 0.35 },
  margin: { colour: [30, 20, 4], alpha: 0.6, minPx: 1, widthM: 0.0012 },
  /** The sea over the stipe's run through the water (`rgba(PAL.SEA_SHALLOW, .55)`). */
  seaTint: { colour: '#2e8c92', alpha: 0.55 },
} as const;

/** The bulb (`BULB`, `drawBulb`): numbers of its radius unless named in metres. */
export const KELP_BULB = {
  x: 0.9,
  y: 0.45,
  radiusM: 0.065,
  minPx: 1.2,
  apophyses: { blades: [0, 2, 3, 4], alongM: 0.1, reach: 0.7, widthM: 0.014, lightWidthM: 0.004 },
  apophysisLight: { colour: [210, 170, 90], alpha: 0.3 },
  shadow: { x: 0.28, y: 0.36, radiusX: 1.02, radiusY: 0.96, colour: [10, 6, 2], alpha: 0.38 },
  body: {
    lightX: -0.35,
    lightY: -0.4,
    inner: 0.05,
    stops: [0.45, 0.85],
    colours: ['#e5c27a', '#a57c34', '#6a4c1a', '#4f3812'],
  },
  translucency: { x: 0.45, y: 0.5, radius: 0.6, clip: 0.97, colour: [255, 214, 120], alpha: 0.45 },
  rings: {
    fromPx: 30,
    count: 7,
    firstAngle: 0.3,
    angleStep: 0.9,
    span: 0.7,
    radius: 0.35,
    radiusStep: 0.08,
    width: 0.02,
  },
  ringColour: { colour: [60, 40, 10], alpha: 0.25 },
  specular: { x: -0.38, y: -0.44, radiusX: 0.24, radiusY: 0.13, turn: -0.7, colour: [255, 252, 240], alpha: 0.55 },
  glint: { x: -0.46, y: -0.5, radius: 0.055, colour: [255, 255, 255], alpha: 0.95 },
  outline: { width: 0.02, minPx: 1, colour: [40, 24, 4], alpha: 0.5 },
} as const;

/** The focal rock (`drawFocalRock`): the shore's boulder at `SHORE_FOCAL_ROCK`, its seed and its height up the shore. */
export const KELP_FOCAL_ROCK = { seed: 999, heightM: 4.2 } as const;

/** The barnacle cover on the focal rock's face (`zoneFill('barnacle', .6)` while `d < 11`), of its radius. */
export const KELP_ROCK_BARNACLE_COVER = {
  belowM: 11,
  x: 0.05,
  y: 0.2,
  radiusX: 1.05,
  radiusY: 0.7,
  alpha: 0.6,
} as const;

/** A world-stable grid's salts past its own (`forCells`): the point's x and y, and the cell's two rolls. */
export const KELP_GRID_SALT = { x: 0, y: 1, first: 2, second: 3 } as const;

/**
 * Single barnacles on the focal rock (`closeBarnacles`): below `showBelowZoom`, fading in to `fullBelowZoom`, on a
 * `cellM` grid (`forCells(.028, 241, …, 5000)`), half the cells, none below `belowShare` of the radius under its
 * centre; each `radius.min + radius.span × b` metres, turned by its roll × `turnPerRoll`.
 */
export const KELP_CLOSE_BARNACLES = {
  showBelowZoom: 0.45,
  fullBelowZoom: 0.05,
  cellM: 0.028,
  salt: 241,
  maxCells: 5000,
  keepAtOrBelow: 0.5,
  belowShare: 0.35,
  radiusM: { min: 0.003, span: 0.006 },
  turnPerRoll: 7,
} as const;

/** One barnacle (`barnacle(g, X, Y, rr, t)`): numbers of its radius; `t` turns it by `turn` and wobbles its plates. */
export const KELP_BARNACLE_LOOK = {
  shadow: { x: 0.22, y: 0.28, radiusX: 1.05, radiusY: 1, colour: [20, 18, 14], alpha: 0.35 },
  shell: { lightX: -0.35, lightY: -0.4, inner: 0.1, middleStop: 0.6, plates: 6, base: 0.9, wobble: 0.1 },
  shellWobble: { perPlate: 2.7, perTurn: 9 },
  turn: 3,
  ribs: { inner: 0.35, outer: 0.92, width: 0.07, colour: [70, 64, 52], alpha: 0.5 },
  opening: { radiusX: 0.3, radiusY: 0.17, colour: '#3c372e' },
  lip: { from: Math.PI, to: Math.PI * 1.7, width: 0.06, colour: [240, 236, 224], alpha: 0.7 },
} as const;

/**
 * The focal rock's outline as a signed distance (ticket #802): its smooth path sampled `samplesPerCurve` times a
 * curve, over a box `reachRadii` of its radius every way (its shadows, foam collar and their lookups), a texel each
 * `metresPerTexel`.
 */
export const KELP_ROCK_DISTANCE = { samplesPerCurve: 8, reachRadii: 1.6, metresPerTexel: 0.01 } as const;

/**
 * The coast round the rock and the stipe as a signed distance (+ land): over `box` (`[minX, minY, maxX, maxY]`
 * metres), a texel each `metresPerTexel`, the coast refined to segments `refineTexels` texels long (the bake measures
 * its exact distance to them, so the line between stays the vector coast). The kelp clips its sea tint and its foam
 * collar to it, as the mockup clipped them to its sea path.
 */
export const KELP_SEA_DISTANCE = { box: [-2.5, -2.5, 12.5, 14.5], metresPerTexel: 0.02, refineTexels: 2 } as const;

/**
 * How far a ribbon's strip is pushed out past its margins each frame: past the widest stroke that leaves it (the
 * stipe's midline, `strokeM` beyond its thinnest margin) and `px` css px for the antialiasing.
 */
export const KELP_RIBBON_REACH = { strokeM: 0.003, px: 1.5 } as const;

/** The quads round the rock (radii of it), round the bulb (metres) and round each lens (radii of it). */
export const KELP_QUAD_REACH = { rockRadii: 1.4, bulbM: 0.1 } as const;

/** What a ribbon is drawn as: the ribbon shader's `kind`. */
export const KELP_RIBBON_KIND = { bladeEven: 0, bladeOdd: 1, stipe: 2 } as const;

/** Where each mean colour sits in the rock shader's `uMeans`. */
export const KELP_ROCK_MEAN = { barnacleFar: 0, rockweedFar: 1, foam: 2 } as const;

/** A uniform vector's lanes, for the kelp's packed uniforms. */
export const KELP_VECTOR_LANE = { x: 0, y: 1, z: 2, w: 3 } as const;
