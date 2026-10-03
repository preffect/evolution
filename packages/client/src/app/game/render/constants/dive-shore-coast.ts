// The opening dive's coast in metres (docs/rendering/opening-dive.md §4, ticket #801): the mockup's refinement of the
// Salish rings below the data's resolution and the rocky point at the focus (`refineSeg`, `warpY`, `buildCoast`).
// Kept out of the `render/constants` barrel: only the dive's lazily loaded shore chunk reads it.

/** A projected point this close to 0 is 0: the focus is a vertex of the data and stays on the waterline. */
export const SHORE_COAST_ZERO_M = 1e-6;
/** A ring needs this many coordinates (three points) to be land. */
export const SHORE_RING_MIN_COORDINATES = 6;
/** The ring through the focus has its land to the north: a probe point this far up the screen (`(0, −50)`). */
export const SHORE_LAND_PROBE_NORTH_M = 50;

/**
 * Midpoint displacement below the data's resolution (`refineSeg`): each child's offset is its parent's hash times
 * `amplitude` of its length (`focusAmplitude` next to the focus), until a segment is `detailPx` long on screen
 * (longer the farther it lies off the view, by `farHalfViews` of half the view), at most `maxDepth` levels deep.
 */
export const SHORE_COAST_REFINE = {
  amplitude: 0.27,
  focusAmplitude: 0.1,
  detailPx: 4,
  farHalfViews: 0.5,
  maxDepth: 46,
  /** A segment farther than this share of its length outside the margin is not refined. */
  reachShare: 0.36,
  /** Next to the focus, a segment shorter than this runs east–west: the boulder sits on a waterline. */
  focusStraightUnderM: 600,
  /** The children's hashes (`mix32(h ^ …)`). */
  firstChildSalt: 0x68e31da4,
  secondChildSalt: 0xb5297a4d,
  /** A ring segment's own hash (`mix32(id × 7919 + i × 104729)`). */
  ringMultiplier: 7919,
  segmentMultiplier: 104729,
} as const;

/**
 * The rocky point at the focus (`POINT`, `warpY`): the shore either side is drawn back `pullM` within `widthM` of
 * the focus, fading out over `lengthM`; past `cutoffSquared` lengths it is untouched. Right at the focus the
 * waterline goes `seawardM` out over `seawardSquaredM` m², so the stranded kelp lies on dry stone.
 */
export const SHORE_ROCKY_POINT = {
  pullM: 90,
  widthM: 240,
  lengthM: 2600,
  cutoffSquared: 9,
  seawardM: 0.6,
  seawardSquaredM: 9,
} as const;

/**
 * The window the coast is built over (`buildCoast`): the view plus a margin of `marginHalfViews` half views, at
 * least `minMarginM`; a ring further than `ringPadShare` of its own size outside it is skipped.
 */
export const SHORE_COAST_WINDOW = { marginHalfViews: 1.5, minMarginM: 90, ringPadShare: 0.05 } as const;
/** The distance queries' spatial hash: this many cells across the window (`gc = (X1 − X0) / 48`). */
export const SHORE_COAST_GRID_CELLS = 48;
/** A grid cell is never smaller than this, so an empty window still has a grid. */
export const SHORE_COAST_MIN_CELL_M = 1e-9;
/** A degenerate segment's squared length (`|| 1e-30`). */
export const SHORE_COAST_TINY_SQUARED = 1e-30;

/** A refined segment's floats in the coast's flat list: where each sits in its run of five. */
export const SHORE_COAST_SEGMENT_FIELD = { startX: 0, startY: 1, endX: 2, endY: 3, landSign: 4 } as const;
