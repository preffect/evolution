// The swallow switch's two checks (docs/game-design/early-life.md §15.5.1), the one home of how `SWALLOW_GATE_TRAITS`
// is read. Each rule reads exactly one of them: `canSwallowByTraits` answers whether a cell may swallow (`canEngulf`,
// `bacteriumContactOutcome` and so the latch, the held-list swallow, the arms, the "Can't swallow yet" beat);
// `ownsSwallowGateTrait` answers whether a cell owns the gate while there is one (the unlock moment and its popup, the
// reserved card, the Lattice card's extra line). With the list empty the first is true for every cell and the second
// false for every cell. "Owns any listed trait, at any tier" is `STAGE_GATE_TRAITS`'s reading (`stage-of.ts`).

import type { BalanceConfig } from '../constants/balance.js';
import type { OwnedTrait } from '../types/game.js';

/** The switch the two checks read, taken from `balance.absorption`. */
export type SwallowGateBalance = Pick<BalanceConfig['absorption'], 'SWALLOW_GATE_TRAITS'>;

function ownsAnyGateTrait(traits: readonly OwnedTrait[], balance: SwallowGateBalance): boolean {
  return traits.some((owned) => balance.SWALLOW_GATE_TRAITS.includes(owned.traitId));
}

/** Whether a cell may swallow by its traits: the list is empty (no gate), or it owns a listed trait at any tier. */
export function canSwallowByTraits(traits: readonly OwnedTrait[], balance: SwallowGateBalance): boolean {
  return balance.SWALLOW_GATE_TRAITS.length === 0 || ownsAnyGateTrait(traits, balance);
}

/** Whether a cell owns the gate while there is one: the list is not empty and it owns a listed trait at any tier. */
export function ownsSwallowGateTrait(traits: readonly OwnedTrait[], balance: SwallowGateBalance): boolean {
  return balance.SWALLOW_GATE_TRAITS.length > 0 && ownsAnyGateTrait(traits, balance);
}
