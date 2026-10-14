// The pool creatures' shapes (docs/game-design/phases.md §14.6.4): the simulation's contact, the spatial hash and the
// interest cull assume one centre and one radius, and two creatures are not circles. The nematode is a chain of
// circles laid along its heading, and its cell's radius is the chain's bounding radius; the copepod has no body, only
// the strip of its lane its head crosses on each tick, which the hash is queried with by its bounding box. One home
// for the server's contact and sweep, the hash query, the interest reach and the renderer. Every size is read from the
// live balance.

import type { BalanceConfig } from '../constants/balance.js';
import { ticksToSeconds } from '../time/units.js';
import type { Vec2 } from '../types/common.js';
import type { CellView } from '../types/game.js';
import { POOL_CREATURE_SPECIES, type CopepodLaneView, type PoolCreatureView } from '../types/pool.js';
import { eraLandmarkRadius, type EraScaleBalance } from './era-scale.js';
import { radiusForMass, type GrowthBalance } from './mass-curves.js';
import { pointOnCircle } from './vector-math.js';

/** A circle's radius is half its width; a centred chain or strip reaches half its length or width each way. */
const HALF = 0.5;
/** A chain of one circle sits on the centre: it has no gaps to space. */
const SINGLE_SEGMENT = 1;

export type NematodeShapeBalance = {
  poolCreatures: Pick<
    BalanceConfig['poolCreatures'],
    'NEMATODE_LENGTH' | 'NEMATODE_THICKNESS' | 'NEMATODE_SEGMENT_COUNT'
  >;
};

/** Each of the nematode's contact circles has half its thickness as its radius. */
export function nematodeSegmentRadius(balance: Pick<NematodeShapeBalance, 'poolCreatures'>): number {
  return balance.poolCreatures.NEMATODE_THICKNESS * HALF;
}

/** The nematode's bounding radius: half its length, the chain's outer rims reaching that far each way. */
export function nematodeBoundingRadius(balance: NematodeShapeBalance): number {
  return balance.poolCreatures.NEMATODE_LENGTH * HALF;
}

/**
 * The centres of the nematode's `NEMATODE_SEGMENT_COUNT` contact circles, tail to head along `headingRadians`, evenly
 * spaced so the end circles' rims touch the bounding radius. Its wave is the path the heading swings along as it
 * thrashes (§14.6.1), so the chain itself is straight.
 */
export function nematodeSegmentCentres(centre: Vec2, headingRadians: number, balance: NematodeShapeBalance): Vec2[] {
  const creatures = balance.poolCreatures;
  const count = creatures.NEMATODE_SEGMENT_COUNT;
  const span = count === SINGLE_SEGMENT ? 0 : creatures.NEMATODE_LENGTH - creatures.NEMATODE_THICKNESS;
  const spacing = count === SINGLE_SEGMENT ? 0 : span / (count - 1);
  const firstOffset = -span * HALF;
  return Array.from({ length: count }, (_unused, index) => {
    const offset = pointOnCircle(firstOffset + index * spacing, headingRadians);
    return { x: centre.x + offset.x, y: centre.y + offset.y };
  });
}

/** What a cell's radius reads: its mass, and its creature's species when it is one. */
export type CellRadiusBalance = { growth: Pick<GrowthBalance, 'CELL_RADIUS_SCALE'> } & EraScaleBalance &
  NematodeShapeBalance;

/**
 * A cell's radius, the one the spatial hash, the interest cull and an ordinary contact read: its mass's
 * (`radiusForMass`), except a creature's that is not a circle of its mass (§14.6.3, §14.6.4): the landmark rotifer's is
 * `ERA_LANDMARK_RADIUS` and the nematode's its bounding radius.
 */
export function cellRadiusOf(cell: Pick<CellView, 'mass' | 'poolCreature'>, balance: CellRadiusBalance): number {
  const creature: PoolCreatureView | null = cell.poolCreature;
  if (creature?.isLandmark === true) return eraLandmarkRadius(balance);
  if (creature?.species === POOL_CREATURE_SPECIES.nematode) return nematodeBoundingRadius(balance);
  return radiusForMass(cell.mass, balance.growth);
}

export type CopepodShapeBalance = {
  poolCreatures: Pick<BalanceConfig['poolCreatures'], 'COPEPOD_SPEED' | 'COPEPOD_LANE_WIDTH'>;
};

/** The copepod's head on `tick`: the lane's start point on `startedAtTick`, then along its direction at `COPEPOD_SPEED`. */
export function copepodHeadAt(lane: CopepodLaneView, tick: number, balance: CopepodShapeBalance): Vec2 {
  const travelled = ticksToSeconds(tick - lane.startedAtTick) * balance.poolCreatures.COPEPOD_SPEED;
  return { x: lane.startX + lane.directionX * travelled, y: lane.startY + lane.directionY * travelled };
}

/** The part of the lane the head crosses on one tick: a rectangle `halfWidth` either side of the segment `from`–`to`. */
export interface CopepodStrip {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly halfWidth: number;
}

/** The strip the copepod's head crosses on `tick`: from where it was on the tick before to where it is on `tick`. */
export function copepodStripAt(lane: CopepodLaneView, tick: number, balance: CopepodShapeBalance): CopepodStrip {
  return {
    from: copepodHeadAt(lane, tick - 1, balance),
    to: copepodHeadAt(lane, tick, balance),
    halfWidth: balance.poolCreatures.COPEPOD_LANE_WIDTH * HALF,
  };
}

export interface AxisAlignedBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * The strip's axis-aligned bounding box, what the spatial hash is queried with (§14.6.4): the segment's box grown by the
 * half width each way, which holds the rectangle at any angle.
 */
export function copepodStripBounds(strip: CopepodStrip): AxisAlignedBox {
  return {
    minX: Math.min(strip.from.x, strip.to.x) - strip.halfWidth,
    minY: Math.min(strip.from.y, strip.to.y) - strip.halfWidth,
    maxX: Math.max(strip.from.x, strip.to.x) + strip.halfWidth,
    maxY: Math.max(strip.from.y, strip.to.y) + strip.halfWidth,
  };
}
