// The opening dive's spray beads and the 5 mm drop on the kelp's blade (docs/rendering/opening-dive.md §4, ticket
// #802): the mockup's `DROP`, `drawBeads`, `bead`, `dropSprite`, `lens` and `fillBladeClose` numbers under its own
// names. Metres round the focus; a lens's numbers are of its radius. Kept out of the `render/constants` barrel: only
// the dive's lazily loaded kelp chunk reads it.

/** The drop the dive sinks into (`DROP`), magnifying `magnification`× until the camera is inside it. */
export const KELP_DROP = {
  x: 0.0014,
  y: 0.0009,
  radiusM: 0.0025,
  magnification: 1.28,
  /** The camera sinks in between these zooms: the magnification relaxes and the surface lights fade. */
  insideFromZoom: -1.9,
  insideToZoom: -2.35,
  /** Drawn while it is more than this many px across in radius and the zoom is above `hideAtOrBelowZoom`. */
  minPx: 1.5,
  hideAtOrBelowZoom: -2.4,
} as const;

/**
 * Spray beads on blade 0 (`drawBeads`, `forCells(.009, 51, …, 7000)`): half the cells, inside `onBladeShare` of the
 * blade's width from its midline (measured to every `sampleStride`-th sample), clear of the drop; each
 * `radiusM.min + radiusM.span × b²`. Drawn while `pxPerMm` css px span a millimetre and the zoom is above
 * `hideAtOrBelowZoom`; a bead under `minPx` across in radius is skipped, and one over `lensAbovePx` is a full lens.
 */
export const KELP_BEADS = {
  cellM: 0.009,
  salt: 51,
  maxCells: 7000,
  keepAtOrBelow: 0.5,
  radiusM: { min: 0.0006, span: 0.0024 },
  clearOfDropM: 0.0008,
  onBladeShare: 0.4,
  sampleStride: 6,
  pxPerMm: 1.2,
  hideAtOrBelowZoom: -2.45,
  minPx: 0.8,
  lensAbovePx: 110,
  magnification: 1.18,
  /** How far round its centre a bead (and the drop) is drawn: its shadow and lights reach this many radii. */
  reachRadii: 1.4,
} as const;

/** A world-stable grid's scatter (`forCells`) visits this many cells past the view on each side. */
export const KELP_GRID_PAD_CELLS = 1;

/** The scatter's own range: beads are placed once inside this many metres of the focus, past any view they show in. */
export const KELP_BEAD_FIELD_M = 1.2;

/** A small bead (`dropSprite`): a soft shadow, a clear body darkening to a bright rim, the caustic and two lights. */
export const KELP_BEAD_LOOK = {
  shadow: { x: 0.16, y: 0.2, radiusX: 1.02, radiusY: 0.98, colour: [20, 12, 2], alpha: 0.28 },
  body: {
    inner: 0.2,
    stops: [0, 0.72, 0.92, 1],
    colours: [
      [255, 236, 190],
      [120, 90, 40],
      [40, 28, 8],
      [255, 245, 220],
    ],
    alphas: [0.08, 0.12, 0.45, 0.55],
  },
  caustic: { x: 0.38, y: 0.42, radius: 0.55, colour: [255, 238, 170], alpha: 0.8 },
  highlight: { x: -0.38, y: -0.42, radiusX: 0.22, radiusY: 0.12, turn: -0.7, colour: [255, 255, 255], alpha: 0.85 },
  glint: { x: -0.45, y: -0.47, radius: 0.06, colour: [255, 255, 255], alpha: 1 },
} as const;

/**
 * A lens (`lens`): its shadow, the blade magnified inside it, the water's tint darkening to a bright rim, the caustic
 * the light gathers into (added), the sky window and its glint, and the rim; `inside` fades the surface lights.
 */
export const KELP_LENS_LOOK = {
  shadow: { x: 0.14, y: 0.18, inner: 0.9, outer: 1.12, colour: [30, 18, 4], alpha: 0.35 },
  water: {
    centreX: -0.1,
    centreY: -0.1,
    inner: 0.2,
    stops: [0, 0.6, 0.88, 0.975, 1],
    colours: [
      [190, 225, 220],
      [60, 50, 30],
      [35, 22, 6],
      [30, 20, 6],
      [250, 240, 215],
    ],
    alphas: [0.08, 0.06, 0.22, 0.34, 0.75],
  },
  caustic: { x: 0.34, y: 0.4, radius: 0.62, middleStop: 0.45, colour: [255, 232, 150], alphas: [0.34, 0.1], fade: 0.6 },
  window: { x: -0.36, y: -0.4, turn: -0.72, squash: 0.5, radius: 0.3, middleStop: 0.55, alphas: [0.7, 0.35] },
  glint: { x: -0.44, y: -0.48, radius: 0.07, middleStop: 0.4, alphas: [1, 0.8], halfBox: 0.08 },
  fleck: { x: 0.5, y: 0.56, radiusX: 0.1, radiusY: 0.04, turn: -0.72, alpha: 0.18 },
  rim: { colour: [250, 244, 225], alpha: 0.5, insideAlpha: 0.25, minPx: 1.3, width: 0.008 },
} as const;

/**
 * The blade under everything once the view is inside its margins (`fillBladeClose`, at and below the kelp band's cut,
 * where the mockup left a gap at the cut itself with nothing behind the beads): its
 * colour, its grain at two octaves along blade 0, and the translucent midline glow `halfWidthShare` of the blade's
 * width either side of the focus, flat once it is `flatAboveViews` view diagonals wide.
 */
export const KELP_BLADE_FLOOR = {
  showAtOrBelowZoom: -1.42,
  colour: '#8a6a2a',
  glow: { halfWidthShare: 0.3, colour: [214, 170, 84], alpha: 0.2, flatAboveViews: 4 },
} as const;

/** The blade's grain tile (`BAKES.blade`): streaks along x, mottling and specks, on the mockup's golden-olive ramp. */
export const KELP_BLADE_TILE = {
  sizePx: 512,
  streaks: { frequencyX: 2, frequencyY: 26, octaves: 3, salt: 301 },
  mottle: { frequency: 5, octaves: 4, salt: 303 },
  speck: { salt: 305, above: 0.985, lift: 0.25 },
  streakShare: 0.6,
  mottleShare: 0.4,
  ramp: ['#5c421a', '#94702e', '#caa154'],
  alpha: 200,
} as const;
