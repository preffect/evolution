// The opening dive's shore tiles (docs/rendering/opening-dive.md §4, ticket #801): code-drawn tiles at true scale,
// baked once a page, each the mockup's `BAKES.<name>` with its numbers here under the mockup's own names. Every
// `salt` is a lattice salt (`pfbm(…, k)`) or a hash salt (`hash(x, y, k)`); every `frequency` is lattice cells across
// the tile. Kept out of the `render/constants` barrel: only the dive's lazily loaded shore chunk reads it.

/** The shore's materials (`PAL`, the shore and kelp rows): a natural-history ramp per material. */
export const SHORE_PALETTE = {
  seaDeep: '#0d3a52',
  seaMid: '#145068',
  foam: '#eef8f6',
  rockDark: '#4a463f',
  rockBase: '#7a756a',
  rockLight: '#a39d8e',
  lichenBlack: '#1f1e1c',
  lichenOrange: '#d88a2c',
  lichenGrey: '#a9ad96',
  barnacleLight: '#e2dccb',
  barnacleBase: '#b3ab98',
  barnacleDark: '#5d574b',
  rockweedDark: '#3a3013',
  rockweedBase: '#62531f',
  rockweedLight: '#9a8636',
  musselDark: '#141a26',
  musselSheen: '#5a6784',
  coralline: '#c98c9b',
  corallineLight: '#ecc0c9',
  surfgrass: '#3f9a45',
  sandBase: '#b9a57d',
  sandLight: '#d9c9a3',
  sandWet: '#8c7c5c',
  driftBase: '#a8a194',
  driftLight: '#d8d2c4',
  driftDark: '#6c665b',
  kelpDark: '#4f3812',
  kelpBase: '#8a6a2a',
  kelpLight: '#c29a48',
  kelpGlow: '#e5c27a',
} as const;

/** A pixel bake yields after this many rows (`imgBakeG`'s `(y & 7) === 7`). */
export const SHORE_PIXEL_ROWS_PER_SLICE = 8;
/** A scatter bake yields after this many items. */
export const SHORE_SCATTER_ITEMS_PER_SLICE = 60;

/** Bedrock: diorite and greenstone, glacially smoothed, speckled, cracked (`BAKES.rock`). */
export const SHORE_ROCK_TILE = {
  sizePx: 512,
  base: { frequency: 6, octaves: 5, salt: 11 },
  fine: { frequency: 40, octaves: 2, salt: 23 },
  contrast: 1.7,
  baseShare: 0.8,
  fineShare: 0.2,
  speckSalt: 7,
  darkSpeckAbove: 0.94,
  darkSpeck: 0.22,
  lightSpeckBelow: 0.04,
  lightSpeck: 0.18,
  cracks: { count: 9, steps: 14, stepPx: 14, wander: 0.9, salt: 'rock-cracks' },
  crackShadow: { colour: 'rgba(25,22,18,.35)', widthPx: 1.2 },
  crackLight: { colour: 'rgba(210,205,190,.25)', widthPx: 0.8, offsetPx: 1 },
} as const;

/** Crystals in the stone: dark grains, pale feldspar, a few glints, on transparent (`BAKES.grain`). */
export const SHORE_GRAIN_TILE = {
  sizePx: 512,
  count: 2600,
  perSlice: 400,
  radiusPx: { min: 0.6, span: 3.2 },
  stretch: 1.4,
  reachRadii: 2,
  darkBelow: 0.45,
  paleBelow: 0.85,
  colours: { dark: 'rgba(18,18,14,.75)', pale: 'rgba(225,220,205,.55)', warm: 'rgba(150,120,95,.5)' },
} as const;

/** Black tar lichen of the splash zone, mottled, holed (`BAKES.lichenBlack`). */
export const SHORE_LICHEN_TILE = {
  sizePx: 512,
  cover: { frequency: 16, octaves: 4, salt: 41 },
  mottle: { frequency: 64, octaves: 2, salt: 43 },
  mottleRgb: [40, 36, 30],
  coverFrom: 0.42,
  coverGain: 4,
  alphaBase: 150,
  alphaMottle: 90,
} as const;

/** Acorn barnacles, true scale: the tile is 0.24 m (`BAKES.barnacle`). */
export const SHORE_BARNACLE_TILE = {
  sizePx: 1024,
  count: 520,
  clump: { frequency: 5, salt: 3 },
  sparseBelow: 0.38,
  sparseKeep: 0.8,
  radiusPx: { min: 10, span: 28, clumpBase: 0.6, clumpGain: 0.6 },
  /** Four baked shells, turned and scaled (`spr`): drawn `spriteRadiusPx` in a `spritePx` square. */
  shells: 4,
  shellTurn: 0.23,
  spritePx: 96,
  spriteCentrePx: 44,
  spriteRadiusPx: 36,
  reachRadii: 1.4,
} as const;

/** One barnacle shell (`barnacle()`): its shadow, plates, sutures, opening and lit lip, in radii. */
export const SHORE_BARNACLE_SHELL = {
  shadow: { colour: 'rgba(20,18,14,.35)', x: 0.22, y: 0.28, radiusX: 1.05 },
  light: { x: -0.35, y: -0.4, inner: 0.1, baseStop: 0.6 },
  plates: 6,
  plateTurn: 3,
  plateWobble: { base: 0.9, span: 0.1, frequency: 2.7, phase: 9 },
  suture: { colour: 'rgba(70,64,52,.5)', minWidth: 0.6, width: 0.07, from: 0.35, to: 0.92 },
  opening: { colour: '#3c372e', radiusX: 0.3, radiusY: 0.17 },
  lip: { colour: 'rgba(240,236,224,.7)', minWidth: 0.5, width: 0.06, from: 1, to: 1.7 },
} as const;

/** Rockweed: forked olive fronds with swollen tips, true scale: the tile is 0.9 m (`BAKES.rockweed`). */
export const SHORE_ROCKWEED_TILE = {
  sizePx: 512,
  clumps: 44,
  fronds: 3,
  frondTurn: 2.1,
  frondJitter: 0.5,
  lengthPx: { min: 16, span: 10 },
  widthPx: 9,
  bend: 0.12,
  bladderChance: 0.5,
  forkTurn: { min: 0.32, span: 0.2 },
  forkLength: 0.85,
  forkWidth: 0.9,
  maxDepth: 3,
  reachPx: 140,
  shadow: { colour: 'rgba(0,0,0,.3)', extraWidth: 3, x: 2, y: 3 },
  edge: { extraWidth: 1.6 },
  sheen: { colour: 'rgba(210,190,110,.35)', widthPx: 1 },
  bladder: {
    offset: 0.28,
    lightPx: 1,
    coreRadius: 0.5,
    gradientRadius: 0.32,
    radiusX: 0.34,
    radiusY: 0.26,
    light: '#d8c27a',
  },
  tip: { colour: '#b3a04c', radiusX: 0.8, radiusY: 0.55 },
} as const;

/** Blue mussels in clumps, true scale: the tile is 0.5 m (`BAKES.mussel`). */
export const SHORE_MUSSEL_TILE = {
  sizePx: 512,
  count: 420,
  clump: { frequency: 4, octaves: 1, salt: 9 },
  keepAbove: 0.45,
  lengthPx: { min: 16, span: 22 },
  shadow: { colour: 'rgba(0,0,0,.4)', x: 2, y: 3, radiusX: 0.5, radiusY: 0.26 },
  shellMid: '#26304a',
  shell: { top: 0.25, backX: 0.2, backY: 0.3, tipY: 0.05, bellyX: 0.1 },
  sheenLine: { fromX: 0.3, fromY: 0.08, controlY: 0.2, toX: 0.35, toY: 0.07 },
  sheenStop: 0.35,
  sheen: { colour: 'rgba(180,195,220,.35)', widthPx: 1 },
} as const;

/** The low zone: pink coralline crusts and bright surfgrass, true scale: the tile is 0.7 m (`BAKES.lowzone`). */
export const SHORE_LOWZONE_TILE = {
  sizePx: 512,
  crust: { frequency: 6, octaves: 4, salt: 81 },
  mottle: { frequency: 24, octaves: 2, salt: 83 },
  coverFrom: 0.42,
  coverGain: 4,
  alpha: 230,
  grass: {
    count: 160,
    frequency: 3,
    salt: 87,
    keepAbove: 0.5,
    angle: 0.6,
    angleSpan: 0.6,
    lengthPx: { min: 30, span: 50 },
  },
  grassBendPx: 6,
  grassWidthPx: 2.2,
  grassBright: '#57b44f',
} as const;
