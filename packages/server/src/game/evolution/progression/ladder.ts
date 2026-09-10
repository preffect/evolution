// The evolution ladder's pure rules (docs/GAME-DESIGN.md §3): a cell's stage from its owned
// traits, and the next rung the draft reserves a card for.

import { STAGE_ORDER, STAGE_GATE_TRAITS, type CellStage, type OwnedTrait, type TraitId } from '@evolution/shared';

export function ownsTrait(ownedTraits: readonly OwnedTrait[], traitId: TraitId): boolean {
  return ownedTraits.some((owned) => owned.traitId === traitId);
}

function hasGateOf(stage: CellStage, ownedTraits: readonly OwnedTrait[]): boolean {
  return STAGE_GATE_TRAITS[stage].some((gateId) => ownsTrait(ownedTraits, gateId));
}

/**
 * The last stage `S` in `STAGE_ORDER` such that every stage after `protocell` up to `S` has one
 * of its gate traits owned; the walk stops at the first missing gate.
 */
export function stageOf(ownedTraits: readonly OwnedTrait[]): CellStage {
  let reached: CellStage = STAGE_ORDER[0];
  for (const stage of STAGE_ORDER.slice(1)) {
    if (!hasGateOf(stage, ownedTraits)) {
      break;
    }
    reached = stage;
  }
  return reached;
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
