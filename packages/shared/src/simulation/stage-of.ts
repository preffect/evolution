// The ladder's one derivation (docs/GAME-DESIGN.md §3): a cell's stage is the highest stage whose
// gate it owns a trait of. Shared because the world clock (world-clock.ts) and the server's
// modifier fold both read it, and the renderer trusts the `stage` it is sent. The climb order
// helpers live here too, because the server's draft and the client's ladder orbit (docs/UI.md
// §3.1.2) must agree on which rungs a stage has reached and which one comes next.

import type { BalanceConfig } from '../constants/balance.js';
import { STAGE_ORDER } from '../constants/ladder.js';
import type { CellStage, TraitId } from '../types/game.js';

export function stageIndex(stage: CellStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function hasReachedStage(reached: CellStage, required: CellStage): boolean {
  return stageIndex(reached) >= stageIndex(required);
}

/** The rung after `stage`, or `null` at the top of the ladder. */
export function nextStage(stage: CellStage): CellStage | null {
  return STAGE_ORDER[stageIndex(stage) + 1] ?? null;
}

/** The climb order and the gates, taken from `balance.ladder`. */
export type LadderBalance = Pick<BalanceConfig['ladder'], 'STAGE_ORDER' | 'STAGE_GATE_TRAITS'>;

/** The highest stage in `STAGE_ORDER` gated by an owned trait; the first stage when none is. */
export function stageOf(ownedTraitIds: readonly TraitId[], balance: LadderBalance): CellStage {
  const owned = new Set<TraitId>(ownedTraitIds);
  for (let index = balance.STAGE_ORDER.length - 1; index > 0; index -= 1) {
    const stage = balance.STAGE_ORDER[index]!;
    if (balance.STAGE_GATE_TRAITS[stage].some((gateTraitId) => owned.has(gateTraitId))) return stage;
  }
  return balance.STAGE_ORDER[0]!;
}
