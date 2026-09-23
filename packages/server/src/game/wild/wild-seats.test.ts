// docs/ecology/acceptance.md §8.1 W2 and docs/ecology/wild-cells.md §3.3 "Placement and respawn": the seats at
// world creation, the size factor draw, the tightened placement rule and what a placed cell looks like.
import { describe, expect, it } from 'vitest';
import {
  CELL_KIND,
  CELL_STAGE,
  DEFAULT_BALANCE,
  FIRST_LEVEL,
  RANDOM_STREAM,
  WORLD_ORGANISM_ID,
  createSeededRandomFromState,
  createTestSessionConfig,
  playerId,
  distanceBetween,
} from '@evolution/shared';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { isInsideAnyCell } from '../simulation/spawn-point.js';
import { worldReferenceAt } from '../simulation/round-clock.js';
import { createWorld } from '../world/create-world.js';
import { isPlayerCell, type CellRecord } from '../world/entities.js';
import { decisionIntervalTicks, ticksUntilDecision } from './wild-strategy.js';
import { createWildSeatRecord, placeWildCell, seatWildCell, wildSpawnClearance } from './wild-seats.js';
import { wildSizeFactor } from './wild-settle.js';

const SEED = 42;
const { wildCells, world: worldBalance, growth, ecology } = DEFAULT_BALANCE;
/** The size factor and the first heading. */
const WILD_DRAWS_PER_PLACEMENT = 2;

/** W2: seed 42, one player, the seeded world at tick 0. */
function seededWorld() {
  return createWorld({
    seed: SEED,
    config: createTestSessionConfig({ seed: SEED }),
    balance: DEFAULT_BALANCE,
    players: [{ playerId: playerId('p1'), playerName: 'Alice', avatarIndex: 0 }],
  });
}

function wildCellsOf(cells: readonly CellRecord[]): CellRecord[] {
  return cells.filter((cell) => cell.kind === CELL_KIND.wild);
}

describe('createWildSeats (W2)', () => {
  const world = seededWorld();
  const wild = wildCellsOf(world.cells);

  it('seats exactly WILD_CELL_COUNT wild protocells of the world organism after the player', () => {
    expect(world.wildSeats).toHaveLength(wildCells.WILD_CELL_COUNT);
    expect(wild).toHaveLength(wildCells.WILD_CELL_COUNT);
    expect(world.wildSeats.map((seat) => seat.seatNumber)).toEqual(wild.map((_unused, index) => index));
    expect(world.wildSeats.map((seat) => seat.cellId)).toEqual(wild.map((cell) => cell.id));
    expect(world.cells.findIndex((cell) => cell.kind === CELL_KIND.wild)).toBe(1);
    for (const cell of wild) {
      expect(cell.playerId).toBeNull();
      expect(cell.organismId).toBe(WORLD_ORGANISM_ID);
      expect(cell.level).toBe(FIRST_LEVEL);
      expect(cell.traits).toEqual([]);
      expect(cell.stage).toBe(CELL_STAGE.protocell);
      expect(cell.targetX).toBeNull();
      expect(cell.velocityX).toBe(0);
    }
  });

  it('seats each cell at its base size 20 × a size within [0.5, 2.0], no growth, the radius following', () => {
    for (const [index, cell] of wild.entries()) {
      const seat = world.wildSeats[index]!;
      expect(seat.sizeFactor).toBeGreaterThanOrEqual(wildCells.WILD_CELL_SIZE_FACTOR_MIN);
      expect(seat.sizeFactor).toBeLessThanOrEqual(wildCells.WILD_CELL_SIZE_FACTOR_MAX);
      expect(cell.mass).toBeCloseTo(growth.CELL_STARTING_MASS * seat.sizeFactor, 10);
      expect(cell.mass).toBeGreaterThanOrEqual(10);
      expect(cell.mass).toBeLessThanOrEqual(40);
      expect([seat.grownMass, seat.fullMass]).toEqual([0, cell.mass]);
      expect(cell.radius).toBeGreaterThan(0);
    }
    const sizes = new Set(world.wildSeats.map((seat) => seat.sizeFactor));
    expect(sizes.size).toBe(wildCells.WILD_CELL_COUNT);
  });

  it('keeps every cell centre, wild or player, at least WILD_CELL_MIN_SPACING_WU apart and inside the spawn disc', () => {
    const reach = worldBalance.DISH_RADIUS - worldBalance.SPAWN_EDGE_MARGIN;
    for (const cell of wild) {
      expect(Math.hypot(cell.x, cell.y)).toBeLessThanOrEqual(reach);
    }
    for (const [index, cell] of world.cells.entries()) {
      for (const other of world.cells.slice(index + 1)) {
        expect(distanceBetween(cell, other)).toBeGreaterThanOrEqual(wildCells.WILD_CELL_MIN_SPACING_WU);
      }
    }
  });

  it('places the seats before the fill: the E1 counts hold and no mote lies inside any wild cell', () => {
    const foodCap = ecology.FOOD_CAP_BASE + ecology.FOOD_CAP_PER_PLAYER;
    const fragmentCap = ecology.DNA_FRAGMENT_CAP_BASE + ecology.DNA_FRAGMENT_CAP_PER_PLAYER;
    expect(world.food).toHaveLength(Math.floor(ecology.FOOD_INITIAL_FILL_FRACTION * foodCap));
    expect(world.dnaFragments).toHaveLength(Math.floor(ecology.DNA_FRAGMENT_INITIAL_FILL_FRACTION * fragmentCap));
    for (const mote of [...world.food, ...world.dnaFragments]) {
      expect(isInsideAnyCell(mote, wild)).toBe(false);
    }
  });

  it('draws one size factor and one heading per seat from the wildCells stream and the points from spawnPlacement, both stored', () => {
    expect(world.random[RANDOM_STREAM.wildCells].position).toBe(WILD_DRAWS_PER_PLACEMENT * wildCells.WILD_CELL_COUNT);
    // Two draws per candidate, one candidate at least per player and per seat.
    expect(world.random[RANDOM_STREAM.spawnPlacement].position).toBeGreaterThanOrEqual(
      2 * (world.players.length + wildCells.WILD_CELL_COUNT),
    );
  });
});

describe('wildSpawnClearance', () => {
  it('is the smaller of the threat clearance and the spacing clearance', () => {
    const world = createTestWorld();
    const cell = world.cells[0]!;
    // A protocell is no threat: only the spacing counts.
    const nearPoint = { x: cell.x + 50, y: cell.y };
    expect(wildSpawnClearance(nearPoint, world.cells, DEFAULT_BALANCE)).toBeCloseTo(
      50 - wildCells.WILD_CELL_MIN_SPACING_WU,
      6,
    );
    // A threat 500 wu away: the safe-spawn radius (600) is the binding rule, not the spacing (200).
    cell.mass = worldBalance.SAFE_SPAWN_THREAT_MASS_RATIO * growth.CELL_STARTING_MASS;
    const farPoint = { x: cell.x + 500, y: cell.y };
    expect(wildSpawnClearance(farPoint, world.cells, DEFAULT_BALANCE)).toBeCloseTo(
      500 - worldBalance.SAFE_SPAWN_RADIUS,
      6,
    );
    expect(wildSpawnClearance(farPoint, [], DEFAULT_BALANCE)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('seatWildCell', () => {
  it('seats a cell at the given centre and size, drawing nothing, with the countdown to the next decision tick', () => {
    const world = createTestWorld();
    world.tick = 21_599;
    const seat = createWildSeatRecord(0);
    seat.headingX = 1;
    world.wildSeats.push(seat);
    const context = createTestStepContext(world);
    const wildBefore = context.streams[RANDOM_STREAM.wildCells].getState().position;
    const seating = { centre: { x: 1500, y: 0 }, sizeFactor: 5 };
    const cell = seatWildCell(world, seat, seating, worldReferenceAt(world, world.tick));
    expect(context.streams[RANDOM_STREAM.wildCells].getState().position).toBe(wildBefore);
    expect(seat).toMatchObject({
      cellId: cell.id,
      sizeFactor: 5,
      headingX: 1,
      respawnInTicks: 0,
      grownMass: 0,
      fullMass: cell.mass,
    });
    expect(seat.decideInTicks).toBe(ticksUntilDecision(world.tick, 0, decisionIntervalTicks(DEFAULT_BALANCE)));
    expect([cell.x, cell.y, cell.targetX, cell.velocityX]).toEqual([1500, 0, null, 0]);
    // 21 599 ticks: the world's mass is 20 + 359.983, times the size.
    expect(cell.mass).toBeCloseTo(worldReferenceAt(world, world.tick).worldMass * 5, 10);
    expect(cell.level).toBe(2);
    expect(world.cells.at(-1)).toBe(cell);
  });
});

describe('placeWildCell', () => {
  it('replaces a vacant seat with a fresh size and a cell at its base size, growth and the countdown cleared', () => {
    const world = createTestWorld();
    world.tick = 600;
    const seat = createWildSeatRecord(7);
    seat.respawnInTicks = 3;
    seat.grownMass = 5;
    seat.fullMass = 50;
    world.wildSeats.push(seat);
    const context = createTestStepContext(world);
    const cell = placeWildCell(world, seat, context, worldReferenceAt(world, world.tick));
    expect(seat.cellId).toBe(cell.id);
    expect(seat.respawnInTicks).toBe(0);
    expect([seat.grownMass, seat.fullMass]).toEqual([0, cell.mass]);
    expect(world.cells.at(-1)).toBe(cell);
    expect(cell.kind).toBe(CELL_KIND.wild);
    expect(isPlayerCell(cell)).toBe(false);
    // 600 ticks = 10 s: the world's mass is 30, times the seat's size.
    expect(cell.mass).toBeCloseTo(30 * seat.sizeFactor, 10);
    expect(distanceBetween(cell, world.cells[0]!)).toBeGreaterThanOrEqual(wildCells.WILD_CELL_MIN_SPACING_WU);
  });

  it('draws the size factor, then the heading, from the wildCells stream and the point from spawnPlacement', () => {
    const world = createTestWorld();
    const seat = createWildSeatRecord(0);
    world.wildSeats.push(seat);
    const expectedSize = wildSizeFactor(
      createSeededRandomFromState(world.random[RANDOM_STREAM.wildCells]).nextFloat(),
      DEFAULT_BALANCE,
    );
    const context = createTestStepContext(world);
    const wildBefore = context.streams[RANDOM_STREAM.wildCells].getState().position;
    const placementBefore = context.streams[RANDOM_STREAM.spawnPlacement].getState().position;
    placeWildCell(world, seat, context, worldReferenceAt(world, world.tick));
    expect(context.streams[RANDOM_STREAM.wildCells].getState().position).toBe(wildBefore + WILD_DRAWS_PER_PLACEMENT);
    expect(Math.hypot(seat.headingX, seat.headingY)).toBeCloseTo(1, 10);
    expect(context.streams[RANDOM_STREAM.spawnPlacement].getState().position).toBeGreaterThanOrEqual(
      placementBefore + 2,
    );
    expect(seat.sizeFactor).toBeCloseTo(expectedSize, 10);
  });
});
