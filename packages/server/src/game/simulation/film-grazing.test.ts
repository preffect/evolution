// docs/game-design/phases.md §14.5.2: a player cell moving at under half its top speed over a bacteria film gains
// `POOL_FILM_GRAZE_MASS_PER_SECOND`, reported as the mass flow's `graze` (docs/ui/hud.md §3.1.5); only in the pool.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  GAME_ERA,
  MASS_RATE_CAUSE,
  TICK_INTERVAL_S,
  createTestPoolLayout,
  entityId,
} from '@evolution/shared';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorldInEras } from '../../testing/world-builders.js';
import { isPlayerCell, type PlayerCellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { setCellMass } from './cell-mass.js';
import { FILM_GRAZE_MAX_SPEED_SHARE, grazeFilm, isGrazingFilm } from './film-grazing.js';
import { metabolise } from './metabolism.js';
import { speedCapOf } from './movement.js';

const { growth, pool } = DEFAULT_BALANCE;
const DIGITS = 9;
const GAIN_PER_TICK = pool.POOL_FILM_GRAZE_MASS_PER_SECOND * TICK_INTERVAL_S;
/** The test layout's one film. */
const FILM = createTestPoolLayout().films[0]!;
/** Just under the speed share, as a fraction of it. */
const JUST_UNDER = 0.999;

/** A world moved into the pool, the test layout's film under its player's idle cell at the starting mass (no decay). */
function grazingWorld(): { world: WorldState; cell: PlayerCellRecord } {
  const world = createTestWorldInEras();
  world.eraMovedInto = GAME_ERA.pool;
  world.poolLayout = createTestPoolLayout();
  const cell = world.cells.find(isPlayerCell)!;
  cell.x = FILM.x;
  cell.y = FILM.y;
  setCellMass(cell, growth.CELL_STARTING_MASS, DEFAULT_BALANCE);
  return { world, cell };
}

/** Sets the cell swimming east at `share` of its speed cap. */
function swimAtShareOfCap(cell: PlayerCellRecord, world: WorldState, share: number): void {
  cell.velocityX = share * speedCapOf(cell, world, DEFAULT_BALANCE);
  cell.velocityY = 0;
}

describe('isGrazingFilm', () => {
  it('is true for a still cell over a film, and for one just under half its top speed', () => {
    const { world, cell } = grazingWorld();
    expect(isGrazingFilm(cell, world, DEFAULT_BALANCE)).toBe(true);
    swimAtShareOfCap(cell, world, FILM_GRAZE_MAX_SPEED_SHARE * JUST_UNDER);
    expect(isGrazingFilm(cell, world, DEFAULT_BALANCE)).toBe(true);
  });

  it('is false at half its top speed and above', () => {
    const { world, cell } = grazingWorld();
    swimAtShareOfCap(cell, world, FILM_GRAZE_MAX_SPEED_SHARE);
    expect(isGrazingFilm(cell, world, DEFAULT_BALANCE)).toBe(false);
  });

  it('is false off the films', () => {
    const { world, cell } = grazingWorld();
    cell.x = FILM.x + pool.POOL_FILM_RADIUS + 1;
    expect(isGrazingFilm(cell, world, DEFAULT_BALANCE)).toBe(false);
  });

  it('is false in the dish, though the layout is drawn from the round’s start', () => {
    const { world, cell } = grazingWorld();
    world.eraMovedInto = GAME_ERA.dish;
    expect(isGrazingFilm(cell, world, DEFAULT_BALANCE)).toBe(false);
  });

  it('is false for a cell held in an engulf as prey', () => {
    const { world, cell } = grazingWorld();
    cell.engulfedByCellId = entityId('c-99');
    expect(isGrazingFilm(cell, world, DEFAULT_BALANCE)).toBe(false);
  });
});

describe('grazeFilm', () => {
  it('adds one tick of POOL_FILM_GRAZE_MASS_PER_SECOND to a grazing cell, and nothing to one that is not', () => {
    const { world, cell } = grazingWorld();
    grazeFilm(cell, world, DEFAULT_BALANCE);
    expect(cell.mass).toBeCloseTo(growth.CELL_STARTING_MASS + GAIN_PER_TICK, DIGITS);
    swimAtShareOfCap(cell, world, FILM_GRAZE_MAX_SPEED_SHARE);
    grazeFilm(cell, world, DEFAULT_BALANCE);
    expect(cell.mass).toBeCloseTo(growth.CELL_STARTING_MASS + GAIN_PER_TICK, DIGITS);
  });
});

describe('metabolise in the pool, over a film', () => {
  it('grazes after the light and reports the gain as the graze cause, not the light', () => {
    const { world, cell } = grazingWorld();
    metabolise(world, createTestStepContext(world));
    const record = world.massFlow.metabolismByPlayer[cell.playerId]!;
    expect(cell.mass).toBeCloseTo(growth.CELL_STARTING_MASS + GAIN_PER_TICK, DIGITS);
    expect(record.ratesPerSecond[MASS_RATE_CAUSE.graze]).toBeCloseTo(pool.POOL_FILM_GRAZE_MASS_PER_SECOND, DIGITS);
    expect(record.ratesPerSecond[MASS_RATE_CAUSE.light]).toBe(0);
  });

  it('feeds no wild cell: its size is its seat’s', () => {
    const { world } = grazingWorld();
    const { cell: wild } = seatTestWildCell(world, { at: FILM });
    const massBefore = wild.mass;
    metabolise(world, createTestStepContext(world));
    expect(wild.mass).toBe(massBefore);
  });

  it('reports no graze for a cell swimming at half its top speed', () => {
    const { world, cell } = grazingWorld();
    swimAtShareOfCap(cell, world, FILM_GRAZE_MAX_SPEED_SHARE);
    metabolise(world, createTestStepContext(world));
    expect(world.massFlow.metabolismByPlayer[cell.playerId]!.ratesPerSecond[MASS_RATE_CAUSE.graze]).toBe(0);
    expect(cell.mass).toBe(growth.CELL_STARTING_MASS);
  });
});
