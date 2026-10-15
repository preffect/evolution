// What a player cell's touch does to a bacterium (docs/game-design/early-life.md §15.5.1, §15.4.1): the one answer the
// server's eating step and the bots' mote filter will both read once the latch ticket (#909) wires them, so they never
// disagree. A swallow outranks a latch, so at
// the shipping switch (`SWALLOW_GATE_TRAITS` empty) every touch swallows, today's eating rule exactly. Wild cells and
// giants never latch: the eating step asks this of a player cell only.

import type { BalanceConfig } from '../constants/balance.js';
import type { ValueOf } from '../types/common.js';
import type { CellView, OwnedTrait } from '../types/game.js';
import { hasReachedStage } from './stage-of.js';
import { canSwallowByTraits } from './swallow-gate.js';

/** Eaten whole on touch (today's rule), taken onto the rim to bond, or passed under. */
export const BACTERIUM_CONTACT_OUTCOME = { swallow: 'swallow', latch: 'latch', pass: 'pass' } as const;
export type BacteriumContactOutcome = ValueOf<typeof BACTERIUM_CONTACT_OUTCOME>;

/** What the answer reads of the touching cell: its stage (for the latch) and its owned traits (for the swallow). */
export interface BacteriumContactCell {
  readonly stage: CellView['stage'];
  readonly traits: readonly OwnedTrait[];
}

/** The switch and the latch's leaves the answer reads. */
export interface BacteriumContactBalance {
  readonly absorption: Pick<BalanceConfig['absorption'], 'SWALLOW_GATE_TRAITS'>;
  readonly earlyLife: Pick<BalanceConfig['earlyLife'], 'LATCH_FROM_STAGE' | 'LATCH_MAX_HELD'>;
}

/**
 * `swallow` while the cell may swallow by its traits (`canSwallowByTraits`); else `latch` from `LATCH_FROM_STAGE` on
 * while the cell holds fewer than `LATCH_MAX_HELD`; otherwise `pass`. Contact (the reach) and the sprint are the eating
 * step's, not this answer's.
 */
export function bacteriumContactOutcome(
  cell: BacteriumContactCell,
  heldCount: number,
  balance: BacteriumContactBalance,
): BacteriumContactOutcome {
  if (canSwallowByTraits(cell.traits, balance.absorption)) return BACTERIUM_CONTACT_OUTCOME.swallow;
  const canLatch =
    hasReachedStage(cell.stage, balance.earlyLife.LATCH_FROM_STAGE) && heldCount < balance.earlyLife.LATCH_MAX_HELD;
  return canLatch ? BACTERIUM_CONTACT_OUTCOME.latch : BACTERIUM_CONTACT_OUTCOME.pass;
}
