// The wild seats (docs/ecology/wild-cells.md §3.3 "Placement and respawn", docs/architecture/entity-model.md §2): `WILD_CELL_COUNT`
// seats hold the world's average made flesh. A seat's cell is placed by the safe-spawn rule plus "no cell centre within
// `WILD_CELL_MIN_SPACING_WU`" from the `spawnPlacement` stream, with a size factor from the `wildCells` stream, at its
// base size for the world of that moment with no growth (docs/ecology/wild-cells.md §3.3.5); the seat count never changes. Placement also draws the seat's first wander heading (used from its first decision on,
// never earlier) and starts its decision countdown (`wild-strategy.ts`).

import { RANDOM_STREAM, worldWholeLevel, type BalanceConfig, type Vec2, type WorldReference } from '@evolution/shared';
import { setCellMass } from '../simulation/cell-mass.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import {
  findSafeSpawnPoint,
  nearestCellDistance,
  threatClearance,
  type SpawnClearance,
} from '../simulation/spawn-placement.js';
import { isPlayerCell, type CellRecord, type WildSeatRecord } from '../world/entities.js';
import type { LiveStreams } from '../world/streams.js';
import type { WorldState } from '../world/world-state.js';
import { bornSeatedCell, createSeatMindRecord } from './seat-mind.js';
import { applyWorldLadder, wildBaseMass, wildSizeFactor } from './wild-settle.js';
import { drawWildHeading, setSeatHeading } from './wild-wander.js';

const FIRST_SEAT_NUMBER = 0;

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
  return { ...createSeatMindRecord(seatNumber), sizeFactor: 1, isStarving: false };
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
  seat.sizeFactor = seating.sizeFactor;
  seat.isStarving = false;
  const baseMass = wildBaseMass(seat, reference);
  const cell = bornSeatedCell(world, seat, {
    centre: seating.centre,
    mass: baseMass,
    level: worldWholeLevel(reference),
  });
  setCellMass(cell, baseMass, world.balance);
  applyWorldLadder(cell, seat, reference, world.balance);
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
 * Takes every wild and giant seat and their cells out of the world (a giant is a wild cell with a species,
 * docs/ecology/giants.md §3.5.2): a placed scenario row (docs/testing/scenario-runner.md §8.1) and the unit-test world
 * keep only the seated cells they place, so no wanderer walks into a placed cell.
 */
export function removeSeatedCells(world: WorldState): void {
  world.cells = world.cells.filter(isPlayerCell);
  world.wildSeats = [];
  world.giantSeats = [];
}

/**
 * World creation: the seats after the players and the giants and before the initial fill (docs/ecology/wild-cells.md
 * §3.3, docs/ecology/giants.md §3.5.9).
 */
export function createWildSeats(world: WorldState, context: WildPlacementContext): void {
  const reference = worldReferenceAt(world, world.tick);
  for (let seatNumber = FIRST_SEAT_NUMBER; seatNumber < context.balance.wildCells.WILD_CELL_COUNT; seatNumber += 1) {
    const seat = createWildSeatRecord(seatNumber);
    world.wildSeats.push(seat);
    placeWildCell(world, seat, context, reference);
  }
}
