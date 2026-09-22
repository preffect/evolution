// docs/ecology/acceptance.md §8.1 W2 and docs/ecology/wild-cells.md §3.3 "Placement and respawn": the seats at
// world creation, the spread draw, the tightened placement rule and what a placed cell looks like.
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
import { createWildSeatRecord, drawMassSpreadFactor, placeWildCell, wildSpawnClearance } from './wild-seats.js';

const SEED = 42;
const { wildCells, world: worldBalance, growth, ecology } = DEFAULT_BALANCE;
/** The spread factor and the first heading. */
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

  it('pins each mass to 20 × a spread within [1 − spread, 1 + spread], the radius following', () => {
    for (const [index, cell] of wild.entries()) {
      const seat = world.wildSeats[index]!;
      expect(seat.massSpreadFactor).toBeGreaterThanOrEqual(1 - wildCells.WILD_CELL_MASS_SPREAD);
      expect(seat.massSpreadFactor).toBeLessThanOrEqual(1 + wildCells.WILD_CELL_MASS_SPREAD);
      expect(cell.mass).toBeCloseTo(growth.CELL_STARTING_MASS * seat.massSpreadFactor, 10);
      expect(cell.mass).toBeGreaterThanOrEqual(14);
      expect(cell.mass).toBeLessThanOrEqual(26);
      expect(cell.radius).toBeGreaterThan(0);
    }
    const spreads = new Set(world.wildSeats.map((seat) => seat.massSpreadFactor));
    expect(spreads.size).toBe(wildCells.WILD_CELL_COUNT);
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

  it('draws one spread and one heading per seat from the wildCells stream and the points from spawnPlacement, both stored', () => {
    expect(world.random[RANDOM_STREAM.wildCells].position).toBe(WILD_DRAWS_PER_PLACEMENT * wildCells.WILD_CELL_COUNT);
    // Two draws per candidate, one candidate at least per player and per seat.
    expect(world.random[RANDOM_STREAM.spawnPlacement].position).toBeGreaterThanOrEqual(
      2 * (world.players.length + wildCells.WILD_CELL_COUNT),
    );
  });
});

describe('drawMassSpreadFactor', () => {
  it('maps the unit draw onto [1 − WILD_CELL_MASS_SPREAD, 1 + WILD_CELL_MASS_SPREAD]', () => {
    expect(drawMassSpreadFactor(0, DEFAULT_BALANCE)).toBeCloseTo(1 - wildCells.WILD_CELL_MASS_SPREAD, 10);
    expect(drawMassSpreadFactor(0.5, DEFAULT_BALANCE)).toBeCloseTo(1, 10);
    expect(drawMassSpreadFactor(1, DEFAULT_BALANCE)).toBeCloseTo(1 + wildCells.WILD_CELL_MASS_SPREAD, 10);
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

describe('placeWildCell', () => {
  it('replaces a vacant seat with a fresh spread and a pinned cell, drainedMass and the countdown cleared', () => {
    const world = createTestWorld();
    world.tick = 600;
    const seat = createWildSeatRecord(7);
    seat.respawnInTicks = 3;
    seat.drainedMass = 5;
    world.wildSeats.push(seat);
    const context = createTestStepContext(world);
    const cell = placeWildCell(world, seat, context, worldReferenceAt(world, world.tick));
    expect(seat.cellId).toBe(cell.id);
    expect(seat.respawnInTicks).toBe(0);
    expect(seat.drainedMass).toBe(0);
    expect(world.cells.at(-1)).toBe(cell);
    expect(cell.kind).toBe(CELL_KIND.wild);
    expect(isPlayerCell(cell)).toBe(false);
    // 600 ticks = 10 s: the world's mass is 30, spread by the seat.
    expect(cell.mass).toBeCloseTo(30 * seat.massSpreadFactor, 10);
    expect(distanceBetween(cell, world.cells[0]!)).toBeGreaterThanOrEqual(wildCells.WILD_CELL_MIN_SPACING_WU);
  });

  it('draws the spread, then the heading, from the wildCells stream and the point from spawnPlacement', () => {
    const world = createTestWorld();
    const seat = createWildSeatRecord(0);
    world.wildSeats.push(seat);
    const expectedSpread = drawMassSpreadFactor(
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
    expect(seat.massSpreadFactor).toBeCloseTo(expectedSpread, 10);
  });
});
