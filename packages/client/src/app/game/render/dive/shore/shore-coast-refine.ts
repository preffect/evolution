// The coast below the data's resolution (docs/rendering/opening-dive.md §4, ticket #801): deterministic midpoint
// displacement (`refineSeg`). Each child's offset comes from its parent's hash, never from the zoom, so the same
// infinite coastline appears at every scale and the focus vertex stays on the waterline. Then the rocky point's warp
// (`warpY`) and the cut to the window (`clipEdge`, Sutherland–Hodgman), so a fill never sees huge coordinates.

import { SHORE_COAST_REFINE, SHORE_ROCKY_POINT } from '../../constants/dive-shore-coast';
import { SHORE_UINT32_RANGE } from '../../constants/dive-shore-noise';
import { HALF } from '../../geometry';
import { mixHash } from './shore-noise';
import { pointCount, pointX, pointY } from './shore-points';

/** The window a coast is built for: the view in metres round the focus, its margin, and its scale. */
export interface CoastWindow {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly marginM: number;
  readonly halfWidthM: number;
  readonly pixelsPerMetre: number;
}

export interface RefineSegment {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly hash: number;
  readonly depth: number;
  /** Whether the segment starts or ends on the focus vertex. */
  readonly isFocusStart: boolean;
  readonly isFocusEnd: boolean;
}

/** How far outside the view a point lies, as a factor: 1 on it, more the farther off (coarser detail there). */
function farFactor(window: CoastWindow, x: number, y: number): number {
  const outsideX = Math.max(0, window.minX - x, x - window.maxX);
  const outsideY = Math.max(0, window.minY - y, y - window.maxY);
  return 1 + Math.max(outsideX, outsideY) / (window.halfWidthM * SHORE_COAST_REFINE.farHalfViews);
}

function isDone(window: CoastWindow, segment: RefineSegment, length: number): boolean {
  const midX = (segment.startX + segment.endX) * HALF;
  const midY = (segment.startY + segment.endY) * HALF;
  const isShortOnScreen = length * window.pixelsPerMetre < SHORE_COAST_REFINE.detailPx * farFactor(window, midX, midY);
  return isShortOnScreen || segment.depth > SHORE_COAST_REFINE.maxDepth;
}

function isOutside(window: CoastWindow, segment: RefineSegment, length: number): boolean {
  const reach = length * SHORE_COAST_REFINE.reachShare;
  const margin = window.marginM;
  return (
    Math.max(segment.startX, segment.endX) + reach < window.minX - margin ||
    Math.min(segment.startX, segment.endX) - reach > window.maxX + margin ||
    Math.max(segment.startY, segment.endY) + reach < window.minY - margin ||
    Math.min(segment.startY, segment.endY) - reach > window.maxY + margin
  );
}

/** The displaced midpoint: east–west next to the focus below ~600 m, the data's own shape above it. */
function midpoint(segment: RefineSegment, length: number): readonly [number, number] {
  const roll = segment.hash / SHORE_UINT32_RANGE - HALF;
  const isNearFocus = segment.isFocusStart || segment.isFocusEnd;
  if (isNearFocus && length < SHORE_COAST_REFINE.focusStraightUnderM) {
    const direction = segment.isFocusStart ? Math.sign(segment.endX) || 1 : Math.sign(segment.startX) || 1;
    return [direction * length * HALF, roll * SHORE_COAST_REFINE.focusAmplitude * length];
  }
  const deltaX = segment.endX - segment.startX;
  const deltaY = segment.endY - segment.startY;
  return [
    (segment.startX + segment.endX) * HALF - deltaY * roll * SHORE_COAST_REFINE.amplitude,
    (segment.startY + segment.endY) * HALF + deltaX * roll * SHORE_COAST_REFINE.amplitude,
  ];
}

/** Appends the refined segment's points after its start (its end last) to `out`. */
export function refineSegment(window: CoastWindow, segment: RefineSegment, out: number[]): void {
  const length = Math.hypot(segment.endX - segment.startX, segment.endY - segment.startY);
  if (isDone(window, segment, length) || isOutside(window, segment, length)) {
    out.push(segment.endX, segment.endY);
    return;
  }
  const [midX, midY] = midpoint(segment, length);
  const depth = segment.depth + 1;
  refineSegment(
    window,
    {
      startX: segment.startX,
      startY: segment.startY,
      endX: midX,
      endY: midY,
      hash: mixHash(segment.hash ^ SHORE_COAST_REFINE.firstChildSalt),
      depth,
      isFocusStart: segment.isFocusStart,
      isFocusEnd: false,
    },
    out,
  );
  refineSegment(
    window,
    {
      startX: midX,
      startY: midY,
      endX: segment.endX,
      endY: segment.endY,
      hash: mixHash(segment.hash ^ SHORE_COAST_REFINE.secondChildSalt),
      depth,
      isFocusStart: false,
      isFocusEnd: segment.isFocusEnd,
    },
    out,
  );
}

/** The rocky point: the shore drawn back near the focus, and pushed a little seaward right at it (`warpY`). */
export function warpRockyPoint(x: number, y: number): number {
  const point = SHORE_ROCKY_POINT;
  const lengthsSquared = (x * x + y * y) / (point.lengthM * point.lengthM);
  if (lengthsSquared > point.cutoffSquared) return y;
  const pull = point.pullM * (1 - Math.exp(-(x * x) / (point.widthM * point.widthM))) * Math.exp(-lengthsSquared);
  return y - pull + point.seawardM * Math.exp(-(x * x + y * y) / point.seawardSquaredM);
}

/** One edge of the window for `clipToEdge`: keep the side of `value` on `axis` (0 x, 1 y) below or above it. */
export interface ClipEdge {
  readonly axis: 0 | 1;
  readonly value: number;
  readonly isKeepingBelow: boolean;
}

function isInside(points: readonly number[], index: number, edge: ClipEdge): boolean {
  const coordinate = edge.axis === 0 ? pointX(points, index) : pointY(points, index);
  return edge.isKeepingBelow ? coordinate <= edge.value : coordinate >= edge.value;
}

/** Sutherland–Hodgman against one axis-aligned edge (`clipEdge`). */
export function clipToEdge(points: readonly number[], edge: ClipEdge): number[] {
  const out: number[] = [];
  const count = pointCount(points);
  for (let index = 0; index < count; index += 1) {
    const previous = (index + count - 1) % count;
    const isCurrentInside = isInside(points, index, edge);
    if (isCurrentInside !== isInside(points, previous, edge)) {
      const startX = pointX(points, previous);
      const startY = pointY(points, previous);
      const endX = pointX(points, index);
      const endY = pointY(points, index);
      const fromValue = edge.axis === 0 ? startX : startY;
      const span = edge.axis === 0 ? startX - endX : startY - endY;
      const fraction = (fromValue - edge.value) / (span || Number.MIN_VALUE);
      out.push(startX + (endX - startX) * fraction, startY + (endY - startY) * fraction);
    }
    if (isCurrentInside) out.push(pointX(points, index), pointY(points, index));
  }
  return out;
}
