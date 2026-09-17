// The mass sparkline's geometry (docs/ui/overlays.md §3.7): a run of masses turned into the `points` of an SVG
// polyline inside a box. Pure, so the shape is tested without a DOM.
//
// The line is scaled to its own run, not to an absolute mass: the panel's question is "did this cell grow or
// shrink over the last `AFFECTING_MASS_HISTORY_SECONDS`", and a cell that moved between 310 and 314 has to show
// that as movement rather than as a flat line near the top of a 0..CELL_MAX_MASS box. A run with no spread at all
// draws down the middle, because a flat life is a flat line and not a division by zero.

const NO_SPREAD = 0;
const MIDDLE = 0.5;
/** Two points is the fewest that can be a line; one mass is a dot that says nothing about a trend. */
const FEWEST_POINTS = 2;
const POINT_SEPARATOR = ' ';
const COORDINATE_SEPARATOR = ',';
/** Coordinates are rounded to this many decimals: finer than a px at any scale, and it keeps the attribute short. */
const COORDINATE_DECIMALS = 2;

function rounded(value: number): number {
  return Number(value.toFixed(COORDINATE_DECIMALS));
}

/**
 * `points` for a polyline of `masses` (oldest first) inside `widthPx` × `heightPx`, y inverted so a growing mass
 * rises on screen. `null` when there is not enough history to draw a line, which draws nothing at all.
 */
export function sparklinePointsFor(masses: readonly number[], widthPx: number, heightPx: number): string | null {
  if (masses.length < FEWEST_POINTS) return null;
  const lowest = Math.min(...masses);
  const highest = Math.max(...masses);
  const spread = highest - lowest;
  const lastIndex = masses.length - 1;
  return masses
    .map((mass, index) => {
      const x = (index / lastIndex) * widthPx;
      const fromBottom = spread === NO_SPREAD ? MIDDLE : (mass - lowest) / spread;
      return `${rounded(x)}${COORDINATE_SEPARATOR}${rounded(heightPx - fromBottom * heightPx)}`;
    })
    .join(POINT_SEPARATOR);
}
