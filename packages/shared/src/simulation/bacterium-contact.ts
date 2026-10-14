// What a player cell's touch does to a bacterium (docs/game-design/early-life.md §15.5.1, §15.4.1): the one answer the
// server's eating step and the bots' mote filter both read, so they never disagree. A swallow outranks a latch, so at
// the shipping switch (`SWALLOW_FROM_STAGE` = `protocell`) every touch swallows, today's eating rule exactly. Wild cells
// and giants never latch: the eating step asks this of a player cell only.

import type { BalanceConfig } from '../constants/balance.js';
import type { ValueOf } from '../types/common.js';
import type { CellStage } from '../types/game.js';
import { hasReachedStage } from './stage-of.js';

/** Eaten whole on touch (today's rule), taken onto the rim to bond, or passed under. */
export const BACTERIUM_CONTACT_OUTCOME = { swallow: 'swallow', latch: 'latch', pass: 'pass' } as const;
export type BacteriumContactOutcome = ValueOf<typeof BACTERIUM_CONTACT_OUTCOME>;

/** The switch and the latch's leaves the answer reads. */
export interface BacteriumContactBalance {
  readonly absorption: Pick<BalanceConfig['absorption'], 'SWALLOW_FROM_STAGE'>;
  readonly earlyLife: Pick<BalanceConfig['earlyLife'], 'LATCH_FROM_STAGE' | 'LATCH_MAX_HELD'>;
}

/**
 * `swallow` from `SWALLOW_FROM_STAGE` on; below it `latch` from `LATCH_FROM_STAGE` on while the cell holds fewer than
 * `LATCH_MAX_HELD`; otherwise `pass`. Contact (the reach) and the sprint are the eating step's, not this answer's.
 */
export function bacteriumContactOutcome(
  stage: CellStage,
  heldCount: number,
  balance: BacteriumContactBalance,
): BacteriumContactOutcome {
  if (hasReachedStage(stage, balance.absorption.SWALLOW_FROM_STAGE)) return BACTERIUM_CONTACT_OUTCOME.swallow;
  const canLatch =
    hasReachedStage(stage, balance.earlyLife.LATCH_FROM_STAGE) && heldCount < balance.earlyLife.LATCH_MAX_HELD;
  return canLatch ? BACTERIUM_CONTACT_OUTCOME.latch : BACTERIUM_CONTACT_OUTCOME.pass;
}
