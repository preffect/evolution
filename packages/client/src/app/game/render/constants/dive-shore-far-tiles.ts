// The opening dive's shore tiles, the zones seen from afar (docs/rendering/opening-dive.md §4, ticket #801): each the mockup's
// `BAKES.<name>` with its numbers under the mockup's own names (see `dive-shore-tiles.ts`). Kept out of the
// `render/constants` barrel: only the dive's lazily loaded shore chunk reads it.

/** A zone's cover from farther off: its own bake at a larger true size, kept in slow-noise patches (`FAR`, `patch`). */
export const SHORE_PATCH = { frequency: 6, octaves: 5, gain: 6 } as const;

/** Barnacles from afar (`BAKES.barnacleFar`). */
export const SHORE_BARNACLE_FAR_TILE = {
  sizePx: 512,
  patchSalt: 501,
  cover: 0.62,
  speckSalt: 503,
  speckAbove: 0.82,
  grain: { frequency: 96, octaves: 2, salt: 505 },
  grainShare: 0.8,
  grainLift: 0.3,
  alpha: 245,
} as const;

/** Mussels from afar (`BAKES.musselFar`). */
export const SHORE_MUSSEL_FAR_TILE = {
  sizePx: 512,
  cover: { frequency: 8, octaves: 4, salt: 521, from: 0.56, gain: 14 },
  grain: { frequency: 64, octaves: 2, salt: 523, share: 0.35 },
  sheenSalt: 525,
  sheenAbove: 0.88,
  sheen: 0.7,
  alpha: 240,
} as const;

/** Rockweed mats from afar: strands lying downslope, golden at the tips (`BAKES.rockweedFar`). */
export const SHORE_ROCKWEED_FAR_TILE = {
  sizePx: 512,
  patchSalt: 511,
  cover: 0.72,
  warp: { frequency: 4, octaves: 2, salt: 513, gain: 5 },
  strands: { u: 36, v: 14, octaves: 3, salt: 515 },
  clumps: { frequency: 16, octaves: 4, salt: 517 },
  glintSalt: 519,
  glintAbove: 0.985,
  glint: 0.5,
  strandContrast: 1.8,
  strandLift: 0.3,
  clumpShare: 0.35,
  clumpFrom: 0.3,
  clumpGain: 4,
  alpha: 245,
} as const;

/** The low zone from afar: bright surfgrass streaks and pink coralline crust (`BAKES.lowzoneFar`). */
export const SHORE_LOWZONE_FAR_TILE = {
  sizePx: 512,
  patchSalt: 531,
  cover: 0.72,
  grass: { u: 60, v: 8, octaves: 3, salt: 533 },
  pink: { frequency: 10, octaves: 3, salt: 535, above: 0.7 },
  pinkGrain: { frequency: 40, octaves: 2, salt: 537, share: 0.5 },
  grassShade: { base: 0.5, gain: 0.45, blueBase: 0.55, blueGain: 0.4 },
  dim: 0.8,
  lift: [14, 12, 14],
  pinkAlpha: 110,
  grassAlphaGain: 1.6,
  grassAlphaFrom: 0.3,
  grassAlpha: 225,
} as const;
