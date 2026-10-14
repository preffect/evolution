// docs/game-design/phases.md §14.2.1 (the era table and its rules), §14.2.4 (the eras in play, a negative
// `roundStartTick`): the era clock over the round clock's elapsed seconds.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { TICK_HZ } from '../constants/network.js';
import { withErasInPlay } from '../testing/era-balance.js';
import { ticksToSeconds } from '../time/units.js';
import { GAME_ERA, GAME_ERA_ORDER, type GameEra } from '../types/game.js';
import {
  eraAt,
  eraBalanceProblems,
  eraStartTicks,
  eraStartedAtTick,
  isEraAfter,
  isEraReachable,
  type EraClockBalance,
} from './era-clock.js';
import { worldElapsedSeconds } from './world-clock.js';

/** The round lengths of §14.2.3: today's game, the pool on, the colonies on. */
const DISH_ONLY_ROUND_SECONDS = 600;
const POOL_ON_ROUND_SECONDS = 1020;
const COLONIES_ON_ROUND_SECONDS = 1500;
/**
 * The pool's first tick after a round start at 0 (§14.2.1), and PH19's jump at tick 600 to the pool (§14.2.4): the next
 * step, 601, is the pool's first tick, so the round start is 601 − 36 000.
 */
const POOL_FIRST_TICK = 36_000;
const PH19_JUMP_TICK = 600;
const PH19_MOVE_TICK = PH19_JUMP_TICK + 1;
const PH19_ROUND_START_TICK = -35_399;
const A_TICK_IN_SECONDS = ticksToSeconds(1);
/** A start on a whole tick whose `ticks × (1 / TICK_HZ)` reads a hair under `ticks / TICK_HZ` (600.3166… s). */
const FLOAT_SHY_POOL_START_TICK = 36_019;
/** A start between two ticks: 36 000.3 ticks (the review's probe). */
const BETWEEN_TICKS_POOL_START_SECONDS = 600.005;

const POOL_ON = withErasInPlay([GAME_ERA.dish, GAME_ERA.pool]);
const COLONIES_ON = withErasInPlay(GAME_ERA_ORDER);

function withStarts(
  starts: Partial<Record<GameEra, number>>,
  balance: EraClockBalance = DEFAULT_BALANCE,
): EraClockBalance {
  const eras = { ...balance.eras };
  eras.ERA_START_SECONDS = { ...eras.ERA_START_SECONDS, ...starts };
  return { eras };
}

describe('eraAt with the shipping balance (ERAS_IN_PLAY = dish)', () => {
  it.each([0, 599, 600, 1020, 1499, 1500])('is the dish at %s s of a 1500 s round: today’s game', (seconds) => {
    expect(eraAt(seconds, COLONIES_ON_ROUND_SECONDS, DEFAULT_BALANCE)).toBe(GAME_ERA.dish);
  });
});

describe('eraAt with every era in play (§14.2.1)', () => {
  it.each<[number, GameEra]>([
    [0, GAME_ERA.dish],
    [600 - A_TICK_IN_SECONDS, GAME_ERA.dish],
    [600, GAME_ERA.pool],
    [1020 - A_TICK_IN_SECONDS, GAME_ERA.pool],
    [1020, GAME_ERA.colonies],
    [1500, GAME_ERA.colonies],
  ])('at %s s of a 1500 s round is %s', (seconds, era) => {
    expect(eraAt(seconds, COLONIES_ON_ROUND_SECONDS, COLONIES_ON)).toBe(era);
  });

  it('opens an era only if it starts before the round’s end: a 1020 s round ends in the pool', () => {
    expect(eraAt(POOL_ON_ROUND_SECONDS, POOL_ON_ROUND_SECONDS, COLONIES_ON)).toBe(GAME_ERA.pool);
  });

  it('keeps a 600 s round the dish throughout, its frozen results second included', () => {
    expect(eraAt(DISH_ONLY_ROUND_SECONDS, DISH_ONLY_ROUND_SECONDS, COLONIES_ON)).toBe(GAME_ERA.dish);
  });

  it('never reaches an era that is not in play, however late', () => {
    expect(eraAt(COLONIES_ON_ROUND_SECONDS, COLONIES_ON_ROUND_SECONDS, POOL_ON)).toBe(GAME_ERA.pool);
  });
});

describe('eraAt over the round clock’s ticks', () => {
  const eraAtTick = (tick: number, roundStartTick: number) =>
    eraAt(worldElapsedSeconds(tick, roundStartTick, COLONIES_ON_ROUND_SECONDS), COLONIES_ON_ROUND_SECONDS, COLONIES_ON);

  it('moves to the pool on tick 36 000 after the round start, not a tick before', () => {
    expect(eraAtTick(POOL_FIRST_TICK - 1, 0)).toBe(GAME_ERA.dish);
    expect(eraAtTick(POOL_FIRST_TICK, 0)).toBe(GAME_ERA.pool);
  });

  it('reads a negative roundStartTick like any other (PH19: a jump at tick 600 to the pool)', () => {
    expect(PH19_MOVE_TICK - POOL_FIRST_TICK).toBe(PH19_ROUND_START_TICK);
    expect(eraAtTick(PH19_JUMP_TICK, PH19_ROUND_START_TICK)).toBe(GAME_ERA.dish);
    expect(eraAtTick(PH19_MOVE_TICK, PH19_ROUND_START_TICK)).toBe(GAME_ERA.pool);
  });
});

describe('eraStartedAtTick', () => {
  it('is the round start plus the era’s start ticks: tick 36 000 for the pool of a round started at 0', () => {
    expect(eraStartedAtTick(GAME_ERA.dish, 0, DEFAULT_BALANCE)).toBe(0);
    expect(eraStartedAtTick(GAME_ERA.pool, 0, DEFAULT_BALANCE)).toBe(POOL_FIRST_TICK);
  });

  it('is the jump’s first tick after a debug_set_era jump (PH19: tick 601 after the jump at 600)', () => {
    expect(eraStartedAtTick(GAME_ERA.pool, PH19_ROUND_START_TICK, DEFAULT_BALANCE)).toBe(PH19_MOVE_TICK);
  });

  it('reads a patched start', () => {
    const balance = withStarts({ [GAME_ERA.pool]: 60 });
    expect(eraStartedAtTick(GAME_ERA.pool, PH19_JUMP_TICK, balance)).toBe(PH19_JUMP_TICK + 60 * TICK_HZ);
  });
});

describe('eraAt reads ticks, not seconds', () => {
  it('opens an era on its start tick even when that tick, in seconds, reads a hair under the start', () => {
    const balance = withStarts({ [GAME_ERA.pool]: FLOAT_SHY_POOL_START_TICK / TICK_HZ }, POOL_ON);
    expect(ticksToSeconds(FLOAT_SHY_POOL_START_TICK)).toBeLessThan(FLOAT_SHY_POOL_START_TICK / TICK_HZ);
    expect(eraStartTicks(GAME_ERA.pool, balance)).toBe(FLOAT_SHY_POOL_START_TICK);
    const eraAtTick = (tick: number) => eraAt(ticksToSeconds(tick), COLONIES_ON_ROUND_SECONDS, balance);
    expect(eraAtTick(FLOAT_SHY_POOL_START_TICK - 1)).toBe(GAME_ERA.dish);
    expect(eraAtTick(FLOAT_SHY_POOL_START_TICK)).toBe(GAME_ERA.pool);
  });
});

describe('isEraReachable', () => {
  it('needs the era in play and starting before the round’s end', () => {
    expect(isEraReachable(GAME_ERA.dish, DISH_ONLY_ROUND_SECONDS, DEFAULT_BALANCE)).toBe(true);
    expect(isEraReachable(GAME_ERA.pool, COLONIES_ON_ROUND_SECONDS, DEFAULT_BALANCE)).toBe(false);
    expect(isEraReachable(GAME_ERA.pool, COLONIES_ON_ROUND_SECONDS, POOL_ON)).toBe(true);
    expect(isEraReachable(GAME_ERA.pool, DISH_ONLY_ROUND_SECONDS, POOL_ON)).toBe(false);
    expect(isEraReachable(GAME_ERA.colonies, POOL_ON_ROUND_SECONDS, COLONIES_ON)).toBe(false);
  });
});

describe('isEraAfter', () => {
  it('orders the eras dish, pool, colonies and is strict', () => {
    expect(isEraAfter(GAME_ERA.pool, GAME_ERA.dish)).toBe(true);
    expect(isEraAfter(GAME_ERA.colonies, GAME_ERA.pool)).toBe(true);
    expect(isEraAfter(GAME_ERA.dish, GAME_ERA.pool)).toBe(false);
    expect(isEraAfter(GAME_ERA.pool, GAME_ERA.pool)).toBe(false);
  });
});

describe('eraBalanceProblems', () => {
  it('finds none in the shipping balance', () => {
    expect(eraBalanceProblems(DEFAULT_BALANCE)).toEqual([]);
  });

  it('refuses a dish that does not start at the round’s start', () => {
    expect(eraBalanceProblems(withStarts({ [GAME_ERA.dish]: 5 }))).toEqual([
      "dish starts at 5 s, not at the round's start",
    ]);
  });

  it('refuses a start that is not a whole number of ticks (600.005 s is 36 000.3 ticks)', () => {
    expect(eraBalanceProblems(withStarts({ [GAME_ERA.pool]: BETWEEN_TICKS_POOL_START_SECONDS }))).toEqual([
      'pool starts at 600.005 s, not on a whole tick',
    ]);
  });

  it.each<[string, Partial<Record<GameEra, number>>, string]>([
    ['after the colonies', { [GAME_ERA.pool]: 1100 }, 'colonies starts at 1020 s, not after pool at 1100 s'],
    ['with the colonies', { [GAME_ERA.pool]: 1020 }, 'colonies starts at 1020 s, not after pool at 1020 s'],
    ['with the dish', { [GAME_ERA.pool]: 0 }, 'pool starts at 0 s, not after dish at 0 s'],
  ])('refuses a pool that starts %s', (_label, starts, problem) => {
    expect(eraBalanceProblems(withStarts(starts))).toEqual([problem]);
  });
});
