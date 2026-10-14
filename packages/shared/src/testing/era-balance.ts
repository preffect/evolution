// The eras in play for tests (docs/game-design/phases.md §14.2.4): the shipping balance is the dish alone, so a test
// about a later era states the eras it plays through this helper, as a private stack patches `eras.ERAS_IN_PLAY`.
// Server and client tests alike import it from the shared barrel.

import { DEFAULT_BALANCE, type BalanceConfig } from '../constants/balance.js';
import type { GameEra } from '../types/game.js';

/** A copy of `balance` whose `ERAS_IN_PLAY` is `erasInPlay`; every other domain is the input's own (read, never written). */
export function withErasInPlay(
  erasInPlay: readonly GameEra[],
  balance: BalanceConfig = DEFAULT_BALANCE,
): BalanceConfig {
  const eras = { ...balance.eras };
  eras.ERAS_IN_PLAY = [...erasInPlay];
  return { ...balance, eras };
}
