// docs/game-design/phases.md §14.2.1 (the era table and its rules), §14.2.4 (the eras in play, a negative
// `roundStartTick`): the era clock over the round clock's elapsed seconds.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { withErasInPlay } from '../testing/era-balance.js';
import { GAME_ERA, GAME_ERA_ORDER, type GameEra } from '../types/game.js';
import { eraAt, eraBalanceProblems, isEraAfter, isEraReachable, type EraClockBalance } from './era-clock.js';
import { worldElapsedSeconds } from './world-clock.js';

/** The round lengths of §14.2.3: today's game, the pool on, the colonies on. */
const DISH_ONLY_ROUND_SECONDS = 600;
const POOL_ON_ROUND_SECONDS = 1020;
const COLONIES_ON_ROUND_SECONDS = 1500;
/** The pool's first tick after a round start at 0 (§14.2.1), and PH19's jump at tick 600 to the pool (§14.2.4). */
const POOL_FIRST_TICK = 36_000;
const PH19_JUMP_TICK = 600;
const PH19_ROUND_START_TICK = -35_400;
const A_TICK_IN_SECONDS = 1 / 60;

const POOL_ON = withErasInPlay([GAME_ERA.dish, GAME_ERA.pool]);
const COLONIES_ON = withErasInPlay(GAME_ERA_ORDER);

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
    expect(PH19_JUMP_TICK - POOL_FIRST_TICK).toBe(PH19_ROUND_START_TICK);
    expect(eraAtTick(PH19_JUMP_TICK - 1, PH19_ROUND_START_TICK)).toBe(GAME_ERA.dish);
    expect(eraAtTick(PH19_JUMP_TICK, PH19_ROUND_START_TICK)).toBe(GAME_ERA.pool);
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
  const withStarts = (starts: Partial<Record<GameEra, number>>): EraClockBalance => {
    const eras = { ...DEFAULT_BALANCE.eras };
    eras.ERA_START_SECONDS = { ...eras.ERA_START_SECONDS, ...starts };
    return { eras };
  };

  it('finds none in the shipping balance', () => {
    expect(eraBalanceProblems(DEFAULT_BALANCE)).toEqual([]);
  });

  it('refuses a dish that does not start at the round’s start', () => {
    expect(eraBalanceProblems(withStarts({ [GAME_ERA.dish]: 5 }))).toEqual([
      "dish starts at 5 s, not at the round's start",
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
