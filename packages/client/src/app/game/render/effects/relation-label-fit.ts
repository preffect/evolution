// Where a relation label may sit (docs/ui/hud.md §3.1.5, docs/rendering/own-cell-indicators.md §10). A relation pill
// is long and its ring is small, in a crowd of other ringed cells, so the threat label's centre-offset rule would let
// half a pill lie across a neighbour and pin its word on the wrong cell (PR #566 review). Instead the pill **reaches
// out from its own ring**: its near edge sits `THREAT_LABEL_GAP_PX` off the ring on one of the four axis sides (left,
// right, above, below: a pill beside or over its cell reads as that cell's, one off on a diagonal does not), tried
// most-facing the own cell first, and the first whose box keeps `NEIGHBOUR_CLEARANCE_PX` from every other drawn ring,
// meets no label already placed and stays off the own cell's orbit extent wins. When no side fits the label is dropped
// for the frame: the ring still speaks, and a word on the wrong cell is worse than none. Pure, in screen px; upright.

import type { ScreenPoint } from '../camera';
import { LABEL_PILL_HEIGHT_PX, THREAT_LABEL_GAP_PX } from '../constants';
import { DIAMETER_PER_RADIUS, HALF, boxIntersectsDisc, boxesIntersect, type Disc, type UprightBox } from '../geometry';
import { ladderOrbitExtentPx } from './own-cell-geometry';

export interface RelationLabelFitInput {
  readonly cellCentre: ScreenPoint;
  /** The labelled cell's ring, its outermost line, px. */
  readonly ringPx: number;
  readonly ownCentre: ScreenPoint;
  /** The own cell's on-screen radius, `r_px`. */
  readonly ownRadiusPx: number;
  /** The whole pill: the measured label text plus the pad at each end. */
  readonly pillWidthPx: number;
  /** Every other drawn ring, as the disc it covers. */
  readonly rings: readonly Disc[];
  /** Every label already placed this frame (the threat's first). */
  readonly placed: readonly UprightBox[];
}

const UPWARD: ScreenPoint = { x: 0, y: -1 };
const AXIS_SIDES: readonly ScreenPoint[] = [{ x: -1, y: 0 }, { x: 1, y: 0 }, UPWARD, { x: 0, y: 1 }];
/**
 * How far a pill keeps from any other ring: twice its gap to its own, so the ring it sits nearest is always its own
 * and the word is never read as a neighbour's.
 */
export const NEIGHBOUR_CLEARANCE_PX = THREAT_LABEL_GAP_PX * DIAMETER_PER_RADIUS;

function unitToward(from: ScreenPoint, target: ScreenPoint): ScreenPoint {
  const length = Math.hypot(target.x - from.x, target.y - from.y);
  return length === 0 ? UPWARD : { x: (target.x - from.x) / length, y: (target.y - from.y) / length };
}

/** The four axis sides, the one most facing the own cell first (ties keep left, right, above, below). */
export function relationLabelSides(cellCentre: ScreenPoint, ownCentre: ScreenPoint): readonly ScreenPoint[] {
  const toward = unitToward(cellCentre, ownCentre);
  const facing = (side: ScreenPoint) => side.x * toward.x + side.y * toward.y;
  return [...AXIS_SIDES].sort((first, second) => facing(second) - facing(first));
}

/** The pill on `side`: its box's nearest point along the side is one gap past the ring (a box's support distance). */
export function pillOnSide(input: RelationLabelFitInput, side: ScreenPoint): UprightBox {
  const halfWidth = input.pillWidthPx * HALF;
  const halfHeight = LABEL_PILL_HEIGHT_PX * HALF;
  const support = Math.abs(side.x) * halfWidth + Math.abs(side.y) * halfHeight;
  const offsetPx = input.ringPx + THREAT_LABEL_GAP_PX + support;
  return {
    x: input.cellCentre.x + side.x * offsetPx,
    y: input.cellCentre.y + side.y * offsetPx,
    halfWidth,
    halfHeight,
  };
}

function isClear(box: UprightBox, input: RelationLabelFitInput): boolean {
  const orbit = { ...input.ownCentre, radius: ladderOrbitExtentPx(input.ownRadiusPx) };
  return (
    !boxIntersectsDisc(box, orbit) &&
    input.rings.every((ring) => !boxIntersectsDisc(box, { ...ring, radius: ring.radius + NEIGHBOUR_CLEARANCE_PX })) &&
    input.placed.every((placed) => !boxesIntersect(box, placed))
  );
}

/** The first clear side's pill box, or `null` when every side is blocked and the label is dropped. */
export function relationLabelFit(input: RelationLabelFitInput): UprightBox | null {
  for (const side of relationLabelSides(input.cellCentre, input.ownCentre)) {
    const box = pillOnSide(input, side);
    if (isClear(box, input)) return box;
  }
  return null;
}
