// docs/game-design/phases.md §14.4.2 step 8: for `ERA_MOVE_GRACE_SECONDS` after the pool's move no engulf of a player
// cell starts, whoever the predator, and no seat chooses a player as a target; a wild prey is never spared, and both
// rules lift on the grace's last tick. The grace is a tick the move stores, so a world the move never ran in has none.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, GIANT_SPECIES, secondsToTicks } from '@evolution/shared';
import { createEngulfFixture } from '../../testing/engulf-builders.js';
import { seatTestGiantCell, seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestStepContext, createTestWorld } from '../../testing/world-builders.js';
import { decideSeatTargets } from '../wild/wild-strategy.js';
import { setCellMass } from './cell-mass.js';
import { canStartEngulf } from './engulf.js';
import { isMoveGraceOn, isSparedByMoveGrace, startMoveGrace } from './move-grace.js';

const GRACE_TICKS = secondsToTicks(DEFAULT_BALANCE.eras.ERA_MOVE_GRACE_SECONDS);
/** PH4's move tick: the pool's first tick after a round start at 0. */
const MOVE_TICK = 36_000;
/** A giant amoeba hunter and a player inside its window and sight (seat-decision.test.ts's pair). */
const GIANT_AT = { x: 1000, y: 0 };
const GIANT_BORN_MASS = 1200;
const PLAYER_IN_WINDOW_MASS = 400;
const PLAYER_EAST_WU = 400;

describe('startMoveGrace and isMoveGraceOn', () => {
  it('covers the move tick and the next ERA_MOVE_GRACE_SECONDS × 60 − 1 ticks (PH4: through 36 479)', () => {
    const world = createTestWorld();
    world.tick = MOVE_TICK;
    startMoveGrace(world, DEFAULT_BALANCE);
    expect(world.moveGraceEndsAtTick).toBe(MOVE_TICK + GRACE_TICKS);
    expect(isMoveGraceOn(world)).toBe(true);
    world.tick = MOVE_TICK + GRACE_TICKS - 1;
    expect(isMoveGraceOn(world)).toBe(true);
    world.tick += 1;
    expect(isMoveGraceOn(world)).toBe(false);
  });

  it('is off in a world the move has not run in', () => {
    expect(createTestWorld().moveGraceEndsAtTick).toBeNull();
    expect(isMoveGraceOn(createTestWorld())).toBe(false);
  });
});

describe('the grace and the engulf', () => {
  it('starts no engulf of a player cell while it runs, a player predating included, and lets one start after', () => {
    const { world, predator, prey } = createEngulfFixture();
    expect(canStartEngulf(predator, prey, world, DEFAULT_BALANCE)).toBe(true);
    startMoveGrace(world, DEFAULT_BALANCE);
    expect(canStartEngulf(predator, prey, world, DEFAULT_BALANCE)).toBe(false);
    world.tick = world.moveGraceEndsAtTick!;
    expect(canStartEngulf(predator, prey, world, DEFAULT_BALANCE)).toBe(true);
  });

  it('spares only a player’s cell: a wild cell is fair game under the grace', () => {
    const world = createTestWorld();
    const { cell: wild } = seatTestWildCell(world, { at: GIANT_AT });
    startMoveGrace(world, DEFAULT_BALANCE);
    expect(isSparedByMoveGrace(world, world.cells[0]!)).toBe(true);
    expect(isSparedByMoveGrace(world, wild)).toBe(false);
  });
});

describe('the grace and the seats’ hunts', () => {
  /** The giant amoeba due to decide on the next call, a player it would hunt in its window and sight. */
  function hunterBesidePlayer(isGraceOn: boolean) {
    const world = createTestWorld();
    const player = world.cells[0]!;
    const { seat } = seatTestGiantCell(world, {
      species: GIANT_SPECIES.amoeba,
      at: GIANT_AT,
      bornMass: GIANT_BORN_MASS,
    });
    seat.decideInTicks = 1;
    world.tick = 1;
    setCellMass(player, PLAYER_IN_WINDOW_MASS, world.balance);
    player.x = GIANT_AT.x + PLAYER_EAST_WU;
    player.y = GIANT_AT.y;
    if (isGraceOn) startMoveGrace(world, DEFAULT_BALANCE);
    decideSeatTargets(world, createTestStepContext(world));
    return { seat, player };
  }

  it('hunts no player while the grace runs, and the same player without it', () => {
    expect(hunterBesidePlayer(true).seat.huntPreyId).toBeNull();
    const { seat, player } = hunterBesidePlayer(false);
    expect(seat.huntPreyId).toBe(player.id);
  });
});
