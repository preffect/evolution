// The swallow switch for tests (docs/game-design/early-life.md §15.8.5, §15.11): a test about the engulf process, not
// about who may swallow, states its switch through this helper, so its predators keep swallowing when the shipping
// `SWALLOW_GATE_TRAITS` flips to `['cytoskeleton']`. Server and client tests alike import it from the shared barrel.

import { DEFAULT_BALANCE, type BalanceConfig } from '../constants/balance.js';
import type { TraitId } from '../types/game.js';

/** A copy of `balance` whose swallow gate is `traitIds`; every other domain is the input's own (read, never written). */
export function withSwallowGateTraits(
  traitIds: readonly TraitId[],
  balance: BalanceConfig = DEFAULT_BALANCE,
): BalanceConfig {
  const absorption = { ...balance.absorption };
  absorption.SWALLOW_GATE_TRAITS = [...traitIds];
  return { ...balance, absorption };
}

/** A copy of `balance` in which every cell swallows from the start (no gate), as before the early-life build. */
export function withEveryCellSwallowing(balance: BalanceConfig = DEFAULT_BALANCE): BalanceConfig {
  return withSwallowGateTraits([], balance);
}
