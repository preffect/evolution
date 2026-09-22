// docs/testing/scenario-runner.md §8.1 `.placeWildCell` on a live world: the seat's spread, a cell at the anchor at
// rest, the replacement of a seated cell without detritus, the abort of its engulf, and the decision countdown a
// placed seat starts (docs/ecology/acceptance.md §8.1 W4, W6).
import { describe, expect, it } from 'vitest';
import { CELL_KIND, CELL_STATE, DEFAULT_BALANCE, WORLD_ORGANISM_ID, secondsToTicks } from '@evolution/shared';
import { setCellMass } from '../../game/simulation/cell-mass.js';
import { beginEngulf } from '../../game/simulation/engulf-state.js';
import { decisionIntervalTicks } from '../../game/wild/wild-strategy.js';
import { createTestWorld } from '../world-builders.js';
import { ScenarioSetupError } from './errors.js';
import { applyPlacedWildCell } from './evolution-wild-fixtures.js';
import { placeWildCell } from './fixtures.js';
import { BROTH_POINT } from './placement.js';

const { growth, wildCells } = DEFAULT_BALANCE;
const SEAT = 0;
const SPREAD = 5;
/** W6: a fixture acting after tick 21 599 seats a cell that decides on tick 21 600, the next tick ≡ 0 (mod 30). */
const TICK_BEFORE_HUNTING = 21_599;

function seededWorld() {
  return createTestWorld({ hasWildSeats: true });
}

describe('applyPlacedWildCell', () => {
  it("seats seat 0's cell at the centre at rest, pinned to the world at the spread, and clears the seat's residue", () => {
    const world = seededWorld();
    const seat = world.wildSeats[SEAT]!;
    seat.drainedMass = 3;
    seat.respawnInTicks = 100;
    const cell = applyPlacedWildCell(
      world,
      placeWildCell({ seat: SEAT, spreadFactor: SPREAD }, undefined),
      BROTH_POINT,
    );
    expect(seat.cellId).toBe(cell.id);
    expect(seat.massSpreadFactor).toBe(SPREAD);
    expect(seat.drainedMass).toBe(0);
    expect(seat.respawnInTicks).toBe(0);
    expect([cell.x, cell.y, cell.targetX, cell.velocityX, cell.velocityY]).toEqual([
      BROTH_POINT.x,
      BROTH_POINT.y,
      null,
      0,
      0,
    ]);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS * SPREAD);
    expect(cell.kind).toBe(CELL_KIND.wild);
    expect(cell.organismId).toBe(WORLD_ORGANISM_ID);
    expect(world.cells.filter((candidate) => candidate.kind === CELL_KIND.wild)).toHaveLength(
      wildCells.WILD_CELL_COUNT,
    );
  });

  it('withdraws the cell the seat had without detritus, aborting the engulf it was in', () => {
    const world = seededWorld();
    const seat = world.wildSeats[SEAT]!;
    const previous = world.cells.find((cell) => cell.id === seat.cellId)!;
    const player = world.cells[0]!;
    setCellMass(player, 100, world.balance);
    beginEngulf({ predator: player, prey: previous });
    applyPlacedWildCell(world, placeWildCell({ seat: SEAT, spreadFactor: 1 }, undefined), BROTH_POINT);
    expect(world.cells).not.toContain(previous);
    expect(world.food).toEqual([]);
    expect(player.engulfingCellId).toBeNull();
    expect(player.states).not.toContain(CELL_STATE.engulfing);
    expect(world.effects.map((effect) => effect.kind)).toEqual(['cell_released']);
  });

  it('seats a vacant seat afresh, deciding on the next tick of its cadence (W6)', () => {
    const world = seededWorld();
    const seat = world.wildSeats[SEAT]!;
    world.cells = world.cells.filter((cell) => cell.id !== seat.cellId);
    seat.cellId = null;
    seat.respawnInTicks = secondsToTicks(wildCells.WILD_CELL_RESPAWN_SECONDS);
    world.tick = TICK_BEFORE_HUNTING;
    applyPlacedWildCell(world, placeWildCell({ seat: SEAT, spreadFactor: 1 }, undefined), BROTH_POINT);
    expect(seat.cellId).not.toBeNull();
    expect(seat.decideInTicks).toBe(1);
    expect(seat.decideInTicks).toBeLessThan(decisionIntervalTicks(world.balance));
  });

  it('creates the seat record on demand in a placed row, which has no seeded seats, in seat order', () => {
    const world = createTestWorld();
    expect(world.wildSeats).toEqual([]);
    applyPlacedWildCell(world, placeWildCell({ seat: 3, spreadFactor: 1 }, undefined), BROTH_POINT);
    const cell = applyPlacedWildCell(
      world,
      placeWildCell({ seat: SEAT, spreadFactor: SPREAD }, undefined),
      BROTH_POINT,
    );
    expect(world.wildSeats.map((seat) => seat.seatNumber)).toEqual([SEAT, 3]);
    expect(world.wildSeats[0]).toMatchObject({ cellId: cell.id, massSpreadFactor: SPREAD });
    expect(world.cells.filter((candidate) => candidate.kind === CELL_KIND.wild)).toHaveLength(2);
  });

  it('refuses a seat number the dish has not', () => {
    const fixture = placeWildCell({ seat: wildCells.WILD_CELL_COUNT, spreadFactor: 1 }, undefined);
    expect(() => applyPlacedWildCell(seededWorld(), fixture, BROTH_POINT)).toThrow(ScenarioSetupError);
    expect(() => applyPlacedWildCell(createTestWorld(), fixture, BROTH_POINT)).toThrow(/seats 0 to 23/);
  });
});
