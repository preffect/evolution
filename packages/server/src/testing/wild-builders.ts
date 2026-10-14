// A wild cell and a giant for the simulation tests (docs/testing/tiers-and-builders.md §4): a real seat and a cell
// seated through the simulation's own seating (`seatWildCell`, docs/ecology/wild-cells.md §3.3; `seatGiantCell`,
// docs/ecology/giants.md §3.5.9), so a test of the death or the payout seam meets the record the world makes, `kind`,
// `organismId`, species and seat included, not a player cell with its id blanked.

import {
  AVATAR_INDEX_MIN,
  CELL_KIND,
  DEFAULT_BALANCE,
  ENTITY_KIND,
  FIRST_LEVEL,
  POOL_CREATURE_SPECIES,
  pointOnCircle,
  type GiantSpecies,
  type PoolCreatureCellSpecies,
  type Vec2,
} from '@evolution/shared';
import { worldReferenceAt } from '../game/simulation/round-clock.js';
import { giantSeatOf, seatGiantCell } from '../game/wild/giant-seats.js';
import { createWildSeatRecord, seatWildCell } from '../game/wild/wild-seats.js';
import { bornCellRecord } from '../game/world/cell-record.js';
import type { CellRecord, GiantSeatRecord, PoolCreatureSeatRecord, WildSeatRecord } from '../game/world/entities.js';
import { mintEntityId } from '../game/world/entity-ids.js';
import { mirrorPoolCreatureSeat, poolCreatureSeatNumber } from '../game/world/pool-creature-mirror.js';
import { createSeatMindRecord } from '../game/wild/seat-mind.js';
import type { WorldState } from '../game/world/world-state.js';

const FIRST_SEAT = 0;
/** A mind's heading is a unit vector. */
const HEADING_LENGTH = 1;
/** The world's own mass, unless `mass` asks for another base size. */
const WORLD_SIZE = 1;

export interface TestWildCellOptions {
  readonly seatNumber?: number;
  readonly at: Vec2;
  /** The cell's base size (its size factor is chosen to match), with no growth; left out, the world's mass. */
  readonly mass?: number;
}

export interface TestWildCell {
  readonly seat: WildSeatRecord;
  readonly cell: CellRecord;
}

/** Seats a wild cell at `at` on seat `seatNumber` (created when the world has no such seat). */
export function seatTestWildCell(world: WorldState, options: TestWildCellOptions): TestWildCell {
  const seatNumber = options.seatNumber ?? FIRST_SEAT;
  let seat = world.wildSeats.find((candidate) => candidate.seatNumber === seatNumber);
  if (seat === undefined) {
    seat = createWildSeatRecord(seatNumber);
    world.wildSeats.push(seat);
  }
  const reference = worldReferenceAt(world, world.tick);
  const sizeFactor = options.mass === undefined ? WORLD_SIZE : options.mass / reference.worldMass;
  const cell = seatWildCell(world, seat, { centre: options.at, sizeFactor }, reference);
  return { seat, cell };
}

export interface TestGiantCellOptions {
  readonly species: GiantSpecies;
  readonly at: Vec2;
  readonly bornMass: number;
  /** Growth above the born mass; none when left out. */
  readonly grownMass?: number;
}

export interface TestGiantCell {
  readonly seat: GiantSeatRecord;
  readonly cell: CellRecord;
}

/** Seats the species' giant at `at` in its own seat (created when the world has none). */
export function seatTestGiantCell(world: WorldState, options: TestGiantCellOptions): TestGiantCell {
  const seat = giantSeatOf(world, options.species);
  const seating = { centre: options.at, bornMass: options.bornMass, grownMass: options.grownMass ?? 0 };
  return { seat, cell: seatGiantCell(world, seat, seating) };
}

export interface TestPoolCreatureOptions {
  readonly species: PoolCreatureCellSpecies;
  readonly at: Vec2;
  readonly mass: number;
  readonly isLandmark?: boolean;
  /** The mind's heading, as an angle; due east when left out. */
  readonly headingRadians?: number;
}

export interface TestPoolCreature {
  readonly seat: PoolCreatureSeatRecord;
  readonly cell: CellRecord;
}

/**
 * A vacant roaming rotifer's seat, the first after the giants of a default world (docs/game-design/phases.md §14.6.2):
 * no cell, counting down to its respawn, its mind at rest.
 */
export function createTestPoolCreatureSeat(overrides: Partial<PoolCreatureSeatRecord> = {}): PoolCreatureSeatRecord {
  const seatNumber = poolCreatureSeatNumber(DEFAULT_BALANCE.wildCells.WILD_CELL_COUNT, FIRST_SEAT);
  return {
    ...createSeatMindRecord(seatNumber),
    species: POOL_CREATURE_SPECIES.rotifer,
    isLandmark: false,
    respawnInTicks: 5_400,
    ...overrides,
  };
}

/**
 * Seats a pool creature at `at` in a new seat at the end of `world.poolCreatureSeats` (created when the world has
 * none): a wild cell whose `poolCreature` mirrors the seat (docs/game-design/phases.md §14.6), until the pool's build
 * seats creatures itself (ticket #872).
 */
export function seatTestPoolCreature(world: WorldState, options: TestPoolCreatureOptions): TestPoolCreature {
  const id = mintEntityId(world, ENTITY_KIND.cell);
  const identity = { id, kind: CELL_KIND.wild, playerId: null, organismId: id, avatarIndex: AVATAR_INDEX_MIN };
  const cell = bornCellRecord({ ...identity, level: FIRST_LEVEL }, options.at, options.mass);
  const heading = pointOnCircle(HEADING_LENGTH, options.headingRadians ?? 0);
  const seat = createTestPoolCreatureSeat({
    seatNumber: poolCreatureSeatNumber(world.firstGiantSeatNumber, world.poolCreatureSeats?.length ?? FIRST_SEAT),
    species: options.species,
    isLandmark: options.isLandmark ?? false,
    cellId: id,
    respawnInTicks: 0,
    headingX: heading.x,
    headingY: heading.y,
  });
  mirrorPoolCreatureSeat(seat, cell, world.balance);
  world.cells.push(cell);
  world.poolCreatureSeats = [...(world.poolCreatureSeats ?? []), seat];
  return { seat, cell };
}

/** The wild seats' cells in world order: every wild cell but the giants (docs/ecology/giants.md §3.5.9). */
export function wildSeatCellsOf(cells: readonly CellRecord[]): CellRecord[] {
  return cells.filter((cell) => cell.kind === CELL_KIND.wild && cell.giantSpecies === null);
}
