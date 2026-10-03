// The opening dive's shore boulders (docs/rendering/opening-dive.md §4, ticket #801): the mockup's `rockPath`,
// `boulder` and `drawBoulders` numbers under its own names. Every `salt` is a hash salt (`hash(seed, k, salt)`). Kept
// out of the `render/constants` barrel: only the dive's lazily loaded shore chunk reads it.

/** A stone's outline (`rockPath`): `points` points, each lobe two points wide, wobbling by `wobble`. */
export const SHORE_ROCK_SHAPE = {
  points: 24,
  pointsPerLobe: 2,
  base: 0.84,
  lobe: 0.26,
  wobble: 0.05,
  lobeSalt: 5,
  wobbleSalt: 6,
  defaultSquash: 0.84,
} as const;

/**
 * Boulders (`drawBoulders`): below `showBelowZoom`, fading in to `fullBelowZoom`, on a `cellM` grid from `seaM` out
 * in the water to `belowBandM` under the rock band's top, kept more often on the lower shore, clear of the focal rock
 * and the fixed pool.
 */
export const SHORE_BOULDER_SCATTER = {
  showBelowZoom: 2.45,
  fullBelowZoom: 2.15,
  cellM: 4.2,
  seaM: -5,
  belowBandM: 2,
  salt: 231,
  maxCells: 2500,
  keepInSea: 0.25,
  keepLow: 0.55,
  keepHigh: 0.35,
  lowUnderM: 6,
  clearOfRockM: 3.6,
  clearOfPool: { squashX: 1.3, radiusM: 5 },
  radiusM: { min: 0.35, span: 1.4 },
  seed: { column: 7 },
} as const;

/** One boulder (`boulder`): numbers in radii of the stone unless named otherwise. */
export const SHORE_BOULDER = {
  visibleRadii: 1.5,
  minRadiusPx: 1.5,
  squash: { base: 0.8, span: 0.1, salt: 9, saltIndex: 1 },
  contactShadows: [
    { x: 0.12, y: 0.16, radius: 1.02, colour: 'rgba(8,8,6,.22)' },
    { x: 0.05, y: 0.07, radius: 1, colour: 'rgba(8,8,6,.3)' },
  ],
  wet: { fromM: 4, toM: 0, colour: '14,16,14', alpha: 0.3 },
  greenstone: { below: 0.45, salt: 9, saltIndex: 3, focalSeed: 999 },
  greenRamp: ['#8d958a', '#535b52', '#20251e'],
  paleRamp: ['#b3ad9e', '#7a756a', '#4a463f'],
  body: { lightX: -0.38, lightY: -0.42, core: 0.08, centreX: 0.05, centreY: 0.05, outer: 1.08, middleStop: 0.55 },
  detailFromPx: 14,
  rock: { tileRadii: 3, greenAlpha: 0.55, paleAlpha: 0.42, targetPx: 380 },
  grain: { tileRadii: 0.8, greenAlpha: 0.5, paleAlpha: 0.4, targetPx: 260 },
  joints: {
    fromPx: 120,
    count: 2,
    salts: { angle: 241, x: 242, y: 243, length: 244, wander: 245 },
    length: { min: 0.35, span: 0.5 },
    step: 0.08,
    wanderScale: 3,
    wanderPerJoint: 5,
    wander: 0.12,
    colour: 'rgba(8,8,6,.4)',
    minPx: 1.2,
    width: 0.008,
  },
  coverBox: 1.15,
  rockweed: { belowM: 5, x: 0.05, y: 0.85, radiusX: 1.12, radiusY: 0.45, alpha: 0.92 },
  lowzone: { belowM: 1.6, y: 0.98, radiusX: 1, radiusY: 0.28, alpha: 0.85 },
  lichens: {
    aboveM: 9,
    fromPx: 30,
    count: 7,
    salts: { angle: 221, reach: 222, radius: 223 },
    reach: { min: 0.1, span: 0.45 },
    radius: { min: 0.06, span: 0.12 },
    squash: 0.8,
    lift: 0.2,
    greyEvery: 3,
    orangeAlpha: 0.7,
    greyAlpha: 0.6,
  },
  volume: {
    lightX: -0.3,
    lightY: -0.35,
    inner: 0.35,
    outer: 1.1,
    stops: ['rgba(0,0,0,0)', 'rgba(10,10,8,.16)', 'rgba(10,10,8,.45)'],
    middleStop: 0.6,
  },
  lightPool: { x: -0.4, y: -0.45, radius: 0.9, colour: 'rgba(255,250,235,.22)', clear: 'rgba(255,250,235,0)' },
  sheen: {
    x: -0.42,
    y: -0.46,
    radius: 0.45,
    core: '255,255,250',
    coreAlpha: 0.5,
    rim: '230,240,240',
    rimAlpha: 0.18,
    rimStop: 0.3,
  },
  rimLight: { to: 0.3, colour: 'rgba(240,236,224,.5)', clear: 'rgba(240,236,224,0)', minPx: 1.5, width: 0.06 },
  waterline: {
    belowM: 0.6,
    underwater: 'rgba(28,104,104,.38)',
    caustic: { tileM: 0.7, alpha: 0.1, turn: 0.3, reach: 1.1, driftX: 0.05, driftY: 0.02 },
    collar: { radius: 1.08, width: 0.22, alpha: 0.1 },
    foam: { radius: 1.05, tileM: 1.3, minPx: 1.5, width: 0.12, maxM: 0.14, alpha: 0.75, flicker: 0.2, rate: 1.4 },
  },
} as const;
