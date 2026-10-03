// The opening dive's shore tiles, the sea's (docs/rendering/opening-dive.md §4, ticket #801): each the mockup's
// `BAKES.<name>` with its numbers under the mockup's own names (see `dive-shore-tiles.ts`). Kept out of the
// `render/constants` barrel: only the dive's lazily loaded shore chunk reads it.

/** Sand and fine gravel of a pocket beach (`BAKES.sand`). */
export const SHORE_SAND_TILE = {
  sizePx: 256,
  grain: { frequency: 8, octaves: 4, salt: 91 },
  speckSalt: 93,
  share: 0.8,
  lift: 0.2,
  lightAbove: 0.9,
  light: 0.15,
  darkBelow: 0.08,
  dark: 0.2,
} as const;

/** Wind ripples on the water, neutral grey for soft-light (`BAKES.ripple`). */
export const SHORE_RIPPLE_TILE = {
  sizePx: 256,
  /** `sin(3u + 2v + 1.3 sin 2v)`: the first train, bent along v. */
  first: { u: 3, v: 2, warp: 1.3, warpFrequency: 2, weight: 0.5 },
  /** `sin(5u − 4v + 2)`. */
  second: { u: 5, v: -4, phase: 2, weight: 0.3 },
  /** `sin(2u + 7v + 1.7 sin 3u)`: the third, bent along u. */
  third: { u: 2, v: 7, warp: 1.7, warpFrequency: 3, weight: 0.25 },
  roughness: { frequency: 8, octaves: 3, salt: 97, gain: 1.2 },
  grey: 128,
  amplitude: 42,
} as const;

/** The long swell from the open strait, soft crests, true scale: the tile is 90 m (`BAKES.swell`). */
export const SHORE_SWELL_TILE = {
  sizePx: 256,
  warp: { frequency: 3, octaves: 3, salt: 701 },
  long: { v: 7, u: 1, warp: 1.4, weight: 0.6 },
  short: { v: 11, u: -2, warp: 2, weight: 0.25 },
  chop: { frequency: 12, octaves: 2, salt: 703, weight: 0.5 },
  grey: 128,
  amplitude: 36,
} as const;

/** Sun glints: sparse bright specks, added with `lighter` (`BAKES.glint`). */
export const SHORE_GLINT_TILE = {
  sizePx: 256,
  count: 60,
  radiusPx: { min: 0.6, span: 1.6 },
  glowRadii: 2.5,
  boxRadii: 3,
  core: 'rgba(255,252,235,.95)',
  rim: 'rgba(255,252,235,0)',
} as const;

/** A bull kelp canopy from above: bulbs trailing blades down-current, true scale: the tile is 24 m (`BAKES.kelpbed`). */
export const SHORE_KELPBED_TILE = {
  sizePx: 512,
  tileM: 24,
  count: 120,
  angle: 0.45,
  angleSpan: 0.5,
  blades: 5,
  bladeFan: 0.12,
  bladeLengthM: { min: 1.4, span: 1.6 },
  reachM: 3.2,
  bladeWidthM: 0.1,
  bendPx: 2,
  bladeColours: ['rgba(146,112,44,.8)', 'rgba(120,92,34,.8)'],
  bulbShadowRadiusM: 0.08,
  bulbRadiusM: 0.065,
  bulbShadowOffsetPx: 1,
} as const;

/** Lacy sea foam: a white sheet torn into holes, with loose bubbles, true scale: the tile is 2.4 m (`BAKES.foam`). */
export const SHORE_FOAM_TILE = {
  sizePx: 512,
  grid: 14,
  jitterSalt: 601,
  jitter: { scale: 0.9, offset: 0.05 },
  warp: { frequency: 4, octaves: 2, saltU: 608, saltV: 609, offsetU: 3, amount: 0.06 },
  sheet: { frequency: 5, octaves: 4, salt: 605 },
  edgeFrom: 0.08,
  edgeSpan: 0.5,
  holeFrom: 0.35,
  holeGain: 3,
  sheetFrom: 0.2,
  sheetGain: 2.5,
  rgb: [246, 250, 249],
  alpha: 235,
  bubbles: { count: 420, radiusPx: { min: 0.8, span: 3.2 }, colour: 'rgba(255,255,255,.75)', widthPx: 0.9 },
} as const;

/** The shallow sea floor: sand with ripple marks, cobbles, weed tufts, true scale: the tile is 5 m (`BAKES.seabed`). */
export const SHORE_SEABED_TILE = {
  sizePx: 512,
  ramp: ['#1f2a20', '#3d4a33', '#79784f'],
  rippleWarp: { frequency: 3, octaves: 2, salt: 611, gain: 1.5 },
  ripple: { u: 9, v: 3 },
  floor: { frequency: 6, octaves: 4, salt: 613 },
  floorShare: 0.7,
  rippleShare: 0.3,
  cobbles: {
    count: 90,
    radiusPx: { min: 4, span: 14 },
    patch: { frequency: 3, salt: 617, keepAbove: 0.45 },
    reachRadii: 1.4,
    shadow: { colour: 'rgba(20,20,16,.35)', x: 0.2, y: 0.25 },
    squash: 0.8,
    light: { x: -0.35, y: -0.35, inner: 0.1, midStop: 0.6 },
    ramp: ['#8a8a78', '#56594a', '#2c2f27'],
  },
  tufts: {
    count: 40,
    colours: ['rgba(70,120,50,.8)', 'rgba(120,80,40,.75)'],
    blades: 7,
    lengthPx: { min: 6, span: 14 },
    reachPx: 24,
    widthPx: 2,
    bend: 0.6,
    bendPx: 3,
  },
} as const;

/** A kelp canopy from far off: mottled golden-brown clumps, true scale: the tile is 150 m (`BAKES.kelpbedFar`). */
export const SHORE_KELPBED_FAR_TILE = {
  sizePx: 256,
  ramp: ['#4c3812', '#7c5e22', '#a7843c'],
  cover: { frequency: 12, octaves: 4, salt: 621, from: 0.36, gain: 3 },
  mottle: { frequency: 48, octaves: 2, salt: 623, share: 0.8, lift: 0.1 },
  alpha: 230,
} as const;

/** The caustic net the sun throws on a shallow floor (`BAKES.caustic`): warped Voronoi edges, bright where they meet. */
export const SHORE_CAUSTIC_TILE = {
  sizePx: 512,
  grid: 6,
  jitterSalt: 331,
  jitter: { scale: 0.9, offset: 0.05 },
  warp: { frequency: 3, octaves: 2, saltU: 335, saltV: 336, offsetU: 7, amount: 0.09 },
  light: { frequency: 4, octaves: 3, salt: 337, base: 0.35, gain: 0.65 },
  sharp: { width: 0.11, weight: 0.9 },
  soft: { width: 0.45, weight: 0.12 },
  rgb: [255, 250, 225],
} as const;
