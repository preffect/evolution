// The kelp's surface cells inside the drop (docs/rendering/opening-dive.md §4, ticket #803): the mockup's `cellGeom`,
// `cellFieldG`, `plastids`, `BAKES.cells` and `BAKES.cellsDark` numbers under its own names. A tile is `sizePx` px and
// 100 µm (`SLIME_FLOOR.cells.tileM`) across; a site's numbers are in tile units. Kept out of the `render/constants`
// barrel: only the dive's lazily loaded slime chunk reads it.

/**
 * The cells: `columns` along the blade × `rows`, every other row (`rowCycle`) offset half a cell, each site jittered (`jitterX`,
 * `jitterY` of a cell, by its salt) and given a shade roll; the field's x distances count `stretchX` more, so the
 * cells run along the blade. Each pixel looks at the rows either side and `columnsBefore` / `columnsAfter` columns.
 */
export const SLIME_CELL_GEOMETRY = {
  sizePx: 1024,
  columns: 8,
  rows: 9,
  rowOffset: 0.5,
  rowCycle: 2,
  jitterX: 0.5,
  jitterY: 0.35,
  salts: { x: 311, y: 312, shade: 313 },
  stretchX: 1.12,
  columnsBefore: 2,
  columnsAfter: 1,
  rowsStep: 8,
} as const;

/**
 * The cells in bright field (`BAKES.cells`): a body shaded by its roll and darker away from its site, a bright wall
 * within `wall.px` of the next cell and a groove round `groove.atPx` inside it.
 */
export const SLIME_CELLS_BRIGHT = {
  shade: { base: 0.35, roll: 0.4, falloff: 2.2 },
  wall: { px: 3.2 },
  groove: { atPx: 4.5, halfWidthPx: 2.5, depth: 0.35 },
} as const;

/** The cells in dark field (`BAKES.cellsDark`): the walls glowing over the dark, `glow × w + base` per channel. */
export const SLIME_CELLS_DARK = {
  sharp: { px: 2.2, weight: 0.9 },
  soft: { px: 9, weight: 0.12 },
  glow: [227, 190, 120],
  base: [11, 22, 38],
} as const;

/**
 * Each cell's plastids (`plastids`): `count.min + ⌊roll × count.span⌋` brown discs round its site, and its nucleus; in
 * bright field each disc lit from the top-left, in dark field a faint gold.
 */
export const SLIME_CELL_PLASTIDS = {
  count: { min: 6, span: 6 },
  salts: { angle: 321, reach: 322, radius: 323 },
  fullTurn: 6.28,
  reach: { min: 0.018, span: 0.03 },
  radius: { min: 0.008, span: 0.005 },
  squash: 0.8,
  light: { offset: 0.3, core: 0.1 },
  darkColour: 'rgba(227,190,110,.35)',
  nucleus: { reach: 0.03, radius: 0.018, bright: 'rgba(230,210,160,.3)', dark: 'rgba(230,210,160,.08)' },
} as const;
