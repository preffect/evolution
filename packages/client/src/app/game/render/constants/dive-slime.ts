// The opening dive's slime band inside the drop (docs/rendering/opening-dive.md §4, ticket #803): the mockup's
// `drawMicro`, `drawSlime`, `drawFloorDiatoms`, `drawDish`, `drawBacteria` and `drawFrame` numbers under its own names.
// Metres round the focus (x east, y south); an object's numbers are of its own size. Every `salt` is a hash salt of
// the world-stable scatter (`forCells(cell, salt, …)` hashes `salt` to `salt + 3`). Kept out of the
// `render/constants` barrel: only the dive's lazily loaded slime chunk reads it.

/** The slime's own colours (the mockup's `PAL` beyond the game's palette). */
export const SLIME_PALETTE = {
  cellWall: '#e3c98a',
  cellBase: '#9c7a34',
  cellDark: '#6e5220',
  cellLight: '#b48d44',
  phaeo: '#6b4f16',
  phaeoLight: '#b98c38',
  waterTint: '#7fc9cf',
  slime: '#d6e6c8',
  /** What the slime paints first once the drop has gone (`drawFrame`'s fill). */
  dark: '#02060a',
} as const;

/** The dish the slime opens round: a 40 µm pocket of clear water (`POCKET_R`). */
export const SLIME_POCKET_RADIUS_M = 20e-6;

/** Inside the drop the slime is clipped to it and the blade outside darkens, while the zoom is above this (`edgeOn`). */
export const SLIME_EDGE_ABOVE_ZOOM = -3.7;

/** The blade's wet skin round the drop, darker (`rgba(20,12,2,.28 × inA)`). */
export const SLIME_EDGE_SHADE = { rgb: [20, 12, 2], alpha: 0.28 } as const;

/**
 * The floor inside the drop (`drawMicro`): the kelp's surface cells, fading in between `cells.fadeIn` and out between
 * `cells.fadeOut` (zooms), laid along the blade; two caustic sheets drifting against each other (`tileM`, drift in
 * tiles a second × `driftShare`, alpha), from `caustic.fadeIn`; the water's tint; and as the dish's dark field arrives,
 * the game's field over it with the dark cells' walls added faintly. The cells' tile is sampled `lodBias` mip levels
 * sharper than its size on screen asks: the mockup's pattern was not mipmapped, and its walls read as a fine grain.
 */
export const SLIME_FLOOR = {
  cells: { tileM: 100e-6, fadeIn: [-2.4, -2.95], fadeOut: [-5.25, -4.8], lodBias: -2 },
  caustic: {
    fadeIn: [-2, -2.5],
    turn: 0.3,
    driftShare: 0.05,
    sheets: [
      { tileM: 0.42e-3, driftX: 1, driftY: 0.4, alpha: 0.13 },
      { tileM: 0.27e-3, driftX: -0.6, driftY: 0.9, alpha: 0.1 },
    ],
  },
  tint: { alpha: 0.08 },
  darkField: { alpha: 0.86, wallGlow: 0.22 },
} as const;

/**
 * The slime's gel (`drawSlime`): a soft cloud on every cell of a `cellM` grid, none within `clearRadii` pocket radii of
 * the focus, `radiusM.min + radiusM.span × b`, alpha `alpha.min + alpha.span × a`, dimmed by `darkFieldDim` of the dark
 * field. Drawn while `minSizeM` spans `minPx`, under the scatter's cell cap.
 */
export const SLIME_CLOUDS = {
  cellM: 30e-6,
  salt: 81,
  maxCells: 6000,
  clearRadii: 1.3,
  radiusM: { min: 22e-6, span: 22e-6 },
  alpha: { min: 0.1, span: 0.12 },
  darkFieldDim: 0.78,
  minSizeM: 25e-6,
  minPx: 3,
} as const;

/**
 * A soft round glow (`glowSprite`): the colour at full alpha in the middle, `middleAlpha` at `middleStop` of the radius,
 * nothing at the edge; drawn from a `sizePx` sprite.
 */
export const SLIME_GLOW = { middleStop: 0.35, middleAlpha: 0.45, sizePx: 64 } as const;

/**
 * The diatoms on the floor (`drawFloorDiatoms`): a `cellM` grid, none within `clearOfFocusM`, a cell kept when its roll
 * is at or under `keepAtOrBelow`, inside the drop while the edge shows; `lengthM.min + lengthM.span × a` long. Under
 * `dotBelowPx` a diatom is a golden speck (`dotRadius` of its length, `dotAlpha`), none under `hideBelowPx`. Drawn
 * while `minSizeM` spans `minPx`, under the scatter's cell cap. `kindRolls` split the kinds: cocconeis, pennate,
 * licmophora, each drawn at `lengthShares` of the length.
 */
export const SLIME_FLOOR_DIATOMS = {
  cellM: 150e-6,
  salt: 91,
  maxCells: 4000,
  clearOfFocusM: 1.3e-4,
  keepSalt: 97,
  keepAtOrBelow: 0.7,
  kindSalt: 95,
  lengthM: { min: 30e-6, span: 55e-6 },
  dotBelowPx: 7,
  hideBelowPx: 2.5,
  dotRadius: 0.4,
  dotAlpha: 0.45,
  dotSizePx: 32,
  minSizeM: 40e-6,
  minPx: 3,
  kindRolls: [0.45, 0.8],
  lengthShares: [0.6, 1, 0.8],
} as const;

/**
 * The mockup's pocket (`drawDish`): a 40 µm disc of clear water, its fill, the glass's ring `ringWidth` of the radius
 * (at least `ringPx`), the lit rim and the accent arc, handing over to the game's dish as the dark field arrives.
 * Drawn while its radius spans `minPx`.
 */
export const SLIME_POCKET = {
  minPx: 2,
  water: { rgb: [170, 215, 210], alpha: 0.1 },
  field: { alpha: 0.85 },
  ring: {
    width: 0.08,
    widthPx: 8,
    stops: [0, 0.4, 1],
    alphas: [
      { base: 0.12, darkField: 0.8 },
      { base: 0.08, darkField: 0.65 },
    ],
  },
  rim: { width: 0.006, widthPx: 1.6, stops: [1, 0.6, 0.38], alpha: 0.6, darkField: 0.4 },
  accent: { width: 0.035, widthPx: 7, alpha: 0.2, fromTurns: 0.95, toTurns: 1.55 },
  /** Beyond the wall the field falls away darker (`BG_DEEP` at `alpha` of the dark field, outside `reachRadii`). */
  outside: { alpha: 0.5, reachRadii: 1.07 },
} as const;

/** The drop's skin seen from inside, near its edge: a bright line and a soft warm band inside it. */
export const SLIME_DROP_SKIN = {
  line: { rgb: [235, 250, 255], alpha: 0.7, widthPx: 3, widthRadii: 0.006 },
  band: { rgb: [255, 240, 200], alpha: 0.22, widthPx: 14, widthRadii: 0.03, insetPx: 10, insetRadii: 0.02 },
} as const;

/**
 * The plankton's moving strokes as straight pieces: a quadratic curve in `curve` pieces, a circle in `circle`; the
 * mockup's `t <= 1.001` loops step a whole flagellum with `stepSlack` of headroom.
 */
export const SLIME_STROKE_PIECES = { curve: 8, circle: 16, stepSlack: 0.001 } as const;

/**
 * The plankton's and diatoms' sprites are drawn once a page at a ladder of sizes, `step` apart from `minPx`, each
 * drawn as the mockup draws the object at that size (its details switching on, its lines never under 1.1 css px); a
 * frame takes the smallest at least as big as the object, so a sprite is never magnified below the ladder's top and
 * shrinks by at most `step`. Each ladder stops at its kind's `maxPx` (css px of the object's length).
 */
export const SLIME_SPRITE_LADDER = {
  step: Math.SQRT2,
  minPx: 4,
  maxPx: { diatoms: 256, nauplius: 512, ciliate: 384, dino: 128, pennate: 1024 },
  /** The atlas's width in px; its height grows by shelves to the next power of two. */
  atlasWidthPx: 2048,
  /** Clear px round every sprite in an atlas, so a filtered sample never reads its neighbour. */
  gutterPx: 2,
} as const;

/**
 * How far round the focus each scatter is made once a page (metres): the clouds as far as the widest view under their
 * cell cap reaches (a stage up to 4:1), and within the drop; the rods likewise under theirs. A cell past these never
 * shows: its view would be over the cap, or outside the drop while the slime is clipped to it.
 */
export const SLIME_SCATTER_REACH_M = { clouds: 2.4e-3, rods: 0.3e-3, stageAspect: 4 } as const;

/** Css px a quad reaches past what it draws, so its antialiased edge is never cut. */
export const SLIME_PICTURE_REACH_PX = 2;

/**
 * Room for the plankton's moving strokes a frame, in straight pieces: under their bodies (the larva's limbs and setae,
 * the ciliates' cilia, the trailing flagella) and over them (the tail, the vacuoles and membranelles, the girdles').
 */
export const SLIME_STROKES_CAPACITY = { under: 320, over: 160 } as const;
