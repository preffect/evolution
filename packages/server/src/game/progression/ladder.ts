// The evolution ladder's server-side rules (docs/GAME-DESIGN.md §3): what is owned, the stage
// order the draft filters by and the rung after a stage. The stage itself has one home, the
// shared `stageOf` (packages/shared/src/simulation/stage-of.ts); `stageOfOwned` is that function
// over owned traits and the live balance.

import {
  STAGE_ORDER,
  stageOf,
  type BalanceConfig,
  type CellStage,
  type OwnedTrait,
  type TraitId,
} from '@evolution/shared';

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
