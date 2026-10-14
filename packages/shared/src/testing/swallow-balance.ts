// The swallow switch for tests (docs/game-design/early-life.md §15.8.5): a test about the engulf process, not about who
// may swallow, states its swallow stage through this helper, so its protocell predators keep swallowing when the
// shipping `SWALLOW_FROM_STAGE` flips to `eukaryote`. Server and client tests alike import it from the shared barrel.

import { DEFAULT_BALANCE, type BalanceConfig } from '../constants/balance.js';
import { CELL_STAGE, type CellStage } from '../types/game.js';

/** A copy of `balance` whose swallow switch is `stage`; every other domain is the input's own (read, never written). */
export function withSwallowFromStage(stage: CellStage, balance: BalanceConfig = DEFAULT_BALANCE): BalanceConfig {
  const absorption = { ...balance.absorption };
  absorption.SWALLOW_FROM_STAGE = stage;
  return { ...balance, absorption };
}

/** A copy of `balance` in which every cell swallows from the start, as before the early-life build. */
export function withSwallowFromProtocell(balance: BalanceConfig = DEFAULT_BALANCE): BalanceConfig {
  return withSwallowFromStage(CELL_STAGE.protocell, balance);
}
