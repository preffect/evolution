// The era clock (docs/game-design/phases.md §14.2.1, §14.2.4): which era a round is in, read from the same inputs as the
// round clock (`worldElapsedSeconds`, world-clock.ts). The server's step, the bloom and the HUD all ask `eraAt`, so they
// cannot disagree; the era is derived, never stored. Pure: it reads only the balance it is given.

import type { BalanceConfig } from '../constants/balance.js';
import { GAME_ERA, GAME_ERA_ORDER, type GameEra } from '../types/game.js';

/** The era every round starts in; `ERAS_IN_PLAY` always begins with it (`isErasInPlayList`). */
const FIRST_ERA: GameEra = GAME_ERA.dish;
/** The first era's start: the round's own start. */
const FIRST_ERA_START_SECONDS = 0;

/** What the era clock reads: the era starts and the eras in play. */
export interface EraClockBalance {
  eras: Pick<BalanceConfig['eras'], 'ERA_START_SECONDS' | 'ERAS_IN_PLAY'>;
}

/** True when `era` opens in a round of `roundDurationSeconds`: it is in play and it starts before the round's end. */
export function isEraReachable(era: GameEra, roundDurationSeconds: number, balance: EraClockBalance): boolean {
  return balance.eras.ERAS_IN_PLAY.includes(era) && balance.eras.ERA_START_SECONDS[era] < roundDurationSeconds;
}

/**
 * The era at `elapsedSeconds` into a round of `roundDurationSeconds` (`worldElapsedSeconds`): the last reachable era
 * whose start has come. With `ERAS_IN_PLAY` = `['dish']`, or a round that ends before the pool's start, it is the dish
 * throughout.
 */
export function eraAt(elapsedSeconds: number, roundDurationSeconds: number, balance: EraClockBalance): GameEra {
  let current = FIRST_ERA;
  for (const era of balance.eras.ERAS_IN_PLAY) {
    const hasStarted = balance.eras.ERA_START_SECONDS[era] <= elapsedSeconds;
    if (hasStarted && isEraReachable(era, roundDurationSeconds, balance)) current = era;
  }
  return current;
}

/** True when `era` comes after `other` in `GAME_ERA_ORDER`: the only direction a round moves. */
export function isEraAfter(era: GameEra, other: GameEra): boolean {
  return GAME_ERA_ORDER.indexOf(era) > GAME_ERA_ORDER.indexOf(other);
}

/**
 * Why the era starts cannot drive the clock: the dish must start at the round's start and each later era strictly
 * after the one before it, so `eraAt` never skips an era. Empty when they can. `debug_set_balance` refuses a patch that
 * makes any; the constants test pins none on `DEFAULT_BALANCE`.
 */
export function eraBalanceProblems(balance: Pick<EraClockBalance, 'eras'>): string[] {
  const starts = balance.eras.ERA_START_SECONDS;
  const problems: string[] = [];
  if (starts[FIRST_ERA] !== FIRST_ERA_START_SECONDS) {
    problems.push(`${FIRST_ERA} starts at ${starts[FIRST_ERA]} s, not at the round's start`);
  }
  for (const [index, era] of GAME_ERA_ORDER.entries()) {
    const previous = GAME_ERA_ORDER[index - 1];
    if (previous !== undefined && starts[era] <= starts[previous]) {
      problems.push(`${era} starts at ${starts[era]} s, not after ${previous} at ${starts[previous]} s`);
    }
  }
  return problems;
}
