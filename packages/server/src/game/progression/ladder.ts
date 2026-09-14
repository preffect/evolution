// The evolution ladder's server-side rules (docs/game-design/core.md §3): what is owned and the stage
// it reaches. The stage and the climb order (`hasReachedStage`, `nextStage`) have one home, the
// shared `stage-of.ts`, because the client's ladder orbit reads the same order; `stageOfOwned` is
// `stageOf` over owned traits and the live balance.

import { stageOf, type BalanceConfig, type CellStage, type OwnedTrait, type TraitId } from '@evolution/shared';

export function ownsTrait(ownedTraits: readonly OwnedTrait[], traitId: TraitId): boolean {
  return ownedTraits.some((owned) => owned.traitId === traitId);
}

/** The cell's stage from its owned traits: the highest gate owned (`stageOf`, docs/PROGRESSION.md P13). */
export function stageOfOwned(ownedTraits: readonly OwnedTrait[], balance: Pick<BalanceConfig, 'ladder'>): CellStage {
  return stageOf(
    ownedTraits.map((owned) => owned.traitId),
    balance.ladder,
  );
}
