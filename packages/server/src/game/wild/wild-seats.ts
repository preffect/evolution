// The wild seats (docs/ecology/wild-cells.md §3.3 "Placement and respawn", docs/architecture/entity-model.md §2): `WILD_CELL_COUNT`
// seats hold the world's average made flesh. A seat's cell is placed by the safe-spawn rule plus "no cell centre within
// `WILD_CELL_MIN_SPACING_WU`" from the `spawnPlacement` stream, with a size factor from the `wildCells` stream, at its
// base size for the world of that moment with no growth (docs/ecology/wild-cells.md §3.3.5); the seat count never changes. Placement also draws the seat's first wander heading (used from its first decision on,
// never earlier) and starts its decision countdown (`wild-strategy.ts`).

import {
  AVATAR_INDEX_MIN,
  CELL_KIND,
  ENTITY_KIND,
  RANDOM_STREAM,
  worldWholeLevel,
  type BalanceConfig,
  type Vec2,
  type WorldReference,
} from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import {
  findSafeSpawnPoint,
  nearestCellDistance,
  threatClearance,
  type SpawnClearance,
} from '../simulation/spawn-placement.js';
import { bornCellRecord } from '../world/cell-record.js';
import { isPlayerCell, type CellRecord, type WildSeatRecord } from '../world/entities.js';
import { mintEntityId } from '../world/entity-ids.js';
import type { LiveStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { applyWorldLadder, wildBaseMass, wildSizeFactor } from './wild-settle.js';
import { decisionIntervalTicks, ticksUntilDecision } from './wild-strategy.js';
import { drawWildHeading, setSeatHeading } from './wild-wander.js';

/** A wild cell wears no player palette: the renderer keys its wild ramp off `kind`, and the index is the first. */
const WILD_CELL_AVATAR_INDEX = AVATAR_INDEX_MIN;
const FIRST_SEAT_NUMBER = 0;
/** At rest until placed: no heading and no decision pending. */
const AT_REST = 0;

/** What placing a seat's cell draws from: the two streams and the live balance. */
export interface WildPlacementContext {
  readonly streams: LiveStreams;
  readonly balance: BalanceConfig;
}

/** The safe-spawn rule tightened by the wild spacing: both clearances must hold, the smaller decides. */
export const wildSpawnClearance: SpawnClearance = (point, cells, balance) =>
  Math.min(
    threatClearance(point, cells, balance),
    nearestCellDistance(point, cells) - balance.wildCells.WILD_CELL_MIN_SPACING_WU,
  );

export function createWildSeatRecord(seatNumber: number): WildSeatRecord {
  return {
    seatNumber,
    cellId: null,
    sizeFactor: 1,
    grownMass: 0,
    fullMass: 0,
    isStarving: false,
    respawnInTicks: 0,
    headingX: AT_REST,
    headingY: AT_REST,
    decideInTicks: AT_REST,
  };
}

/** Where a seat's new cell goes and how heavy it runs: the streams' choice in play, a fixture's in a scenario. */
export interface WildSeating {
  readonly centre: Vec2;
  readonly sizeFactor: number;
}

/**
 * Seats a fresh cell for `seat` at `seating`: the size factor, the countdown to the seat's next decision tick
 * (`ticksUntilDecision` from `world.tick`, the tick in progress or the one a fixture acts after), then the cell at its
 * base size at `reference` with no growth (`fullMass` = mass: no wound) and the world's ladder, under the world's live
 * balance. The seat's target and velocity are those of a new cell (none), as a respawn requires. The seat's
 * heading is left as it is: the wild placement draws one, a fixture keeps the seat's own
 * (docs/testing/scenario-runner.md §8.1, `.placeWildCell`).
 */
export function seatWildCell(
  world: WorldState,
  seat: WildSeatRecord,
  seating: WildSeating,
  reference: WorldReference,
): CellRecord {
  const { balance } = world;
  seat.sizeFactor = seating.sizeFactor;
  seat.decideInTicks = ticksUntilDecision(world.tick, seat.seatNumber, decisionIntervalTicks(balance));
  const id = mintEntityId(world, ENTITY_KIND.cell);
  const identity = {
    id,
    kind: CELL_KIND.wild,
    playerId: null,
    organismId: id,
    avatarIndex: WILD_CELL_AVATAR_INDEX,
    level: worldWholeLevel(reference),
  };
  const baseMass = wildBaseMass(seat, reference);
  const cell = bornCellRecord(identity, seating.centre, baseMass);
  seat.cellId = id;
  seat.respawnInTicks = 0;
  seat.grownMass = 0;
  seat.fullMass = baseMass;
  seat.isStarving = false;
  setCellMass(cell, baseMass, balance);
  applyWorldLadder(cell, seat, reference, balance);
  world.cells.push(cell);
  return cell;
}

/**
 * Places (or replaces) the seat's cell from the streams: a fresh size factor and heading from `wildCells`, a
 * safe point from `spawnPlacement`, then `seatWildCell`.
 */
export function placeWildCell(
  world: WorldState,
  seat: WildSeatRecord,
  context: WildPlacementContext,
  reference: WorldReference,
): CellRecord {
  const { streams, balance } = context;
  const wildStream = streams[RANDOM_STREAM.wildCells];
  const sizeFactor = wildSizeFactor(wildStream.nextFloat(), balance);
  setSeatHeading(seat, drawWildHeading(wildStream));
  const centre = findSafeSpawnPoint(streams[RANDOM_STREAM.spawnPlacement], world.cells, balance, wildSpawnClearance);
  return seatWildCell(world, seat, { centre, sizeFactor }, reference);
}

/**
 * Takes every wild seat and its cell out of the world: a placed scenario row (docs/testing/scenario-runner.md §8.1)
 * and the unit-test world keep only the wild cells they place, so no wanderer walks into a placed cell.
 */
export function removeWildSeats(world: WorldState): void {
  world.cells = world.cells.filter(isPlayerCell);
  world.wildSeats = [];
}

/** World creation: the seats after the players and before the initial fill (docs/ecology/wild-cells.md §3.3). */
export function createWildSeats(world: WorldState, context: WildPlacementContext): void {
  const reference = worldReferenceAt(world, world.tick);
  for (let seatNumber = FIRST_SEAT_NUMBER; seatNumber < context.balance.wildCells.WILD_CELL_COUNT; seatNumber += 1) {
    const seat = createWildSeatRecord(seatNumber);
    world.wildSeats.push(seat);
    placeWildCell(world, seat, context, reference);
  }
}
