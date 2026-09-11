// docs/GAME-DESIGN.md §3: the stage is the highest gate owned; the ladder's own rows drive it.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { CELL_STAGE } from '../types/game.js';
import { stageOf } from './stage-of.js';

const balance = DEFAULT_BALANCE.ladder;

describe('stageOf', () => {
  it('is the protocell with no traits, or with ungated protocell traits only', () => {
    expect(stageOf([], balance)).toBe(CELL_STAGE.protocell);
    expect(stageOf(['cell_wall', 'simple_flagellum'], balance)).toBe(CELL_STAGE.protocell);
  });

  it('reaches each stage by any one of its gate traits', () => {
    expect(stageOf(['nucleoid'], balance)).toBe(CELL_STAGE.prokaryote);
    expect(stageOf(['nucleoid', 'chloroplast'], balance)).toBe(CELL_STAGE.endosymbiosis);
    expect(stageOf(['nucleoid', 'mitochondrion', 'nuclear_envelope'], balance)).toBe(CELL_STAGE.eukaryote);
    expect(
      stageOf(['nucleoid', 'mitochondrion', 'nuclear_envelope', 'cytoskeleton', 'amoeba_pseudopods'], balance),
    ).toBe(CELL_STAGE.specialised);
  });

  it('takes the highest gate owned, whatever the order of the traits', () => {
    expect(stageOf(['nuclear_envelope', 'nucleoid', 'mitochondrion'], balance)).toBe(CELL_STAGE.eukaryote);
  });

  it('reads the gates from the balance it is given', () => {
    const custom = structuredClone(balance);
    custom.STAGE_GATE_TRAITS.prokaryote = ['cell_wall'];
    expect(stageOf(['cell_wall'], custom)).toBe(CELL_STAGE.prokaryote);
  });
});
