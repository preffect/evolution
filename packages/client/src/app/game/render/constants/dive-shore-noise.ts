// The opening dive's shore noise (docs/rendering/opening-dive.md §4, ticket #801): the mockup's own hashes and
// lattice, so every rock, pool and boulder sits where the mockup puts it (`hash`, `mix32`, `pnoise`, `vor`). Kept out
// of the `render/constants` barrel: only the dive's lazily loaded shore chunk reads it.

/** The coordinate hash's odd multipliers and its finishing mix (`hash`). */
export const SHORE_HASH = {
  xMultiplier: 374761393,
  yMultiplier: 668265263,
  saltMultiplier: 2147483647,
  mixMultiplier: 1274126177,
  firstShift: 13,
  secondShift: 16,
} as const;

/** The 32-bit finaliser (`mix32`, MurmurHash3's fmix32). */
export const SHORE_MIX = {
  firstMultiplier: 0x85ebca6b,
  secondMultiplier: 0xc2b2ae35,
  firstShift: 16,
  middleShift: 13,
  lastShift: 16,
} as const;

/** 2^32: an unsigned 32-bit hash over this is in [0, 1). */
export const SHORE_UINT32_RANGE = 4294967296;

/** The periodic lattice's table of seeded values (`LAT`, 2^16 entries) and its index multipliers (`lat`). */
export const SHORE_LATTICE = {
  size: 65536,
  saltMultiplier: 40503,
  yMultiplier: 2749,
  xMultiplier: 7919,
} as const;

/** Each octave of a fractal sum doubles the frequency and halves the weight, starting at half (`pfbm`). */
export const SHORE_FBM = { firstWeight: 0.5, lacunarity: 2, gain: 0.5, saltStep: 17 } as const;

/** The Voronoi search: the 3 × 3 neighbouring cells, with no site yet nearer than this (`vor`'s `9`). */
export const SHORE_VORONOI_FAR = 9;
