// docs/GAME-DESIGN.md §3 and docs/PROGRESSION.md §7 P13: the ladder rules over owned traits.
import { describe, expect, it } from 'vitest';
import { CELL_STAGE, DEFAULT_BALANCE, STAGE_ORDER, type OwnedTrait, type TraitId } from '@evolution/shared';
import { hasReachedStage, nextStage, ownsTrait, stageIndex, stageOfOwned } from './ladder.js';

function owned(...ids: TraitId[]): OwnedTrait[] {
  return ids.map((traitId) => ({ traitId, tier: 1 }));
}

describe('stageOfOwned (P13)', () => {
  it.each([
    [[], CELL_STAGE.protocell],
    [['nucleoid'], CELL_STAGE.prokaryote],
    [['nucleoid', 'chloroplast'], CELL_STAGE.endosymbiosis],
    [['nucleoid', 'chloroplast', 'nuclear_envelope'], CELL_STAGE.eukaryote],
    [['nucleoid', 'chloroplast', 'nuclear_envelope', 'euglena_eyespot'], CELL_STAGE.specialised],
    [['chloroplast'], CELL_STAGE.endosymbiosis],
  ] as [TraitId[], string][])('%j → %s', (ids, stage) => {
    expect(stageOfOwned(owned(...ids), DEFAULT_BALANCE)).toBe(stage);
  });

  it('accepts either endosymbiont as the gate and any tier', () => {
    expect(
      stageOfOwned(
        [
          { traitId: 'nucleoid', tier: 3 },
          { traitId: 'mitochondrion', tier: 2 },
        ],
        DEFAULT_BALANCE,
      ),
    ).toBe(CELL_STAGE.endosymbiosis);
  });
});

describe('the rest of the ladder', () => {
  it('knows what is owned', () => {
    expect(ownsTrait(owned('nucleoid'), 'nucleoid')).toBe(true);
    expect(ownsTrait(owned('nucleoid'), 'cilia')).toBe(false);
  });

  it('orders stages by STAGE_ORDER', () => {
    expect(stageIndex(CELL_STAGE.protocell)).toBe(0);
    expect(hasReachedStage(CELL_STAGE.eukaryote, CELL_STAGE.prokaryote)).toBe(true);
    expect(hasReachedStage(CELL_STAGE.prokaryote, CELL_STAGE.eukaryote)).toBe(false);
    expect(hasReachedStage(CELL_STAGE.prokaryote, CELL_STAGE.prokaryote)).toBe(true);
  });

  it('names the next rung and null at the top', () => {
    expect(nextStage(CELL_STAGE.protocell)).toBe(CELL_STAGE.prokaryote);
    expect(nextStage(STAGE_ORDER[STAGE_ORDER.length - 1]!)).toBeNull();
  });
});
