// Oriented boxes and the gap between two of them (docs/RENDERING.md §10): the ladder orbit's items
// are straight sprites laid tangent to a circle, so the clearance between two of them is measured
// between the rectangles as drawn, not along the arc their centres sit on. Pure, screen px.

export interface OrientedBox {
  /** The box's centre. */
  readonly x: number;
  readonly y: number;
  /** Screen radians of the box's long axis. */
  readonly rotation: number;
  readonly halfLength: number;
  readonly halfHeight: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

type Segment = readonly [Point, Point];

/** The four corners, in order around the box. */
export function boxCorners(box: OrientedBox): Point[] {
  const along = { x: Math.cos(box.rotation), y: Math.sin(box.rotation) };
  const across = { x: -along.y, y: along.x };
  const corner = (lengthSign: number, heightSign: number): Point => ({
    x: box.x + along.x * box.halfLength * lengthSign + across.x * box.halfHeight * heightSign,
    y: box.y + along.y * box.halfLength * lengthSign + across.y * box.halfHeight * heightSign,
  });
  return [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
}

function edgesOf(corners: readonly Point[]): Segment[] {
  return corners.map((start, index): Segment => [start, corners[(index + 1) % corners.length] ?? start]);
}

function distanceToSegment(point: Point, [start, end]: Segment): number {
  const edgeX = end.x - start.x;
  const edgeY = end.y - start.y;
  const lengthSquared = edgeX * edgeX + edgeY * edgeY;
  const along = lengthSquared === 0 ? 0 : ((point.x - start.x) * edgeX + (point.y - start.y) * edgeY) / lengthSquared;
  const clamped = Math.min(1, Math.max(0, along));
  return Math.hypot(point.x - (start.x + edgeX * clamped), point.y - (start.y + edgeY * clamped));
}

/** Whether some edge normal of either box separates the two (the separating axis test for convex quads). */
function isSeparated(first: readonly Point[], second: readonly Point[]): boolean {
  return [first, second].some((corners) =>
    edgesOf(corners).some(([start, end]) => {
      const normal = { x: start.y - end.y, y: end.x - start.x };
      const project = (points: readonly Point[]): number[] =>
        points.map((point) => point.x * normal.x + point.y * normal.y);
      const firstProjection = project(first);
      const secondProjection = project(second);
      return (
        Math.max(...firstProjection) < Math.min(...secondProjection) ||
        Math.max(...secondProjection) < Math.min(...firstProjection)
      );
    }),
  );
}

/** The shortest distance between the two boxes' outlines; 0 when they touch or overlap. */
export function orientedBoxGapPx(first: OrientedBox, second: OrientedBox): number {
  const firstCorners = boxCorners(first);
  const secondCorners = boxCorners(second);
  if (!isSeparated(firstCorners, secondCorners)) return 0;
  const pairs: [readonly Point[], readonly Point[]][] = [
    [firstCorners, secondCorners],
    [secondCorners, firstCorners],
  ];
  let gap = Number.POSITIVE_INFINITY;
  for (const [corners, other] of pairs) {
    for (const corner of corners) {
      for (const edge of edgesOf(other)) gap = Math.min(gap, distanceToSegment(corner, edge));
    }
  }
  return gap;
}
