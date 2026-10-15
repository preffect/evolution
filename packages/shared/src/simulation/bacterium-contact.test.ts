// docs/game-design/early-life.md §15.5.1 and §15.4.1: what a player cell's touch does to a bacterium, at the shipping
// switch (EL15: no gate) and with the flip's (`['cytoskeleton']`).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { withSwallowGateTraits } from '../testing/swallow-balance.js';
import { CELL_STAGE, type CellStage, type TraitId } from '../types/game.js';
import { BACTERIUM_CONTACT_OUTCOME, bacteriumContactOutcome, type BacteriumContactCell } from './bacterium-contact.js';

const switchOn = withSwallowGateTraits(['cytoskeleton']);
const { LATCH_MAX_HELD } = DEFAULT_BALANCE.earlyLife;
const NOTHING_HELD = 0;

/** A cell at `stage` owning tier I of each listed trait. */
const cellAt = (stage: CellStage, traitIds: readonly TraitId[] = []): BacteriumContactCell => ({
  stage,
  traits: traitIds.map((traitId) => ({ traitId, tier: 1 })),
});
const PROTOCELL = cellAt(CELL_STAGE.protocell);
const ARCHAEON = cellAt(CELL_STAGE.prokaryote, ['nucleoid']);
const ENDOSYMBIONT = cellAt(CELL_STAGE.endosymbiosis, ['nucleoid', 'mitochondrion']);
const EUKARYOTE = cellAt(CELL_STAGE.eukaryote, ['nucleoid', 'mitochondrion', 'nuclear_envelope']);
const ARCHAEON_WITH_THE_LATTICE = cellAt(CELL_STAGE.prokaryote, ['nucleoid', 'cytoskeleton']);

describe('bacteriumContactOutcome', () => {
  it.each([PROTOCELL, ARCHAEON, ENDOSYMBIONT, EUKARYOTE])(
    "swallows at $stage with the shipping switch, however full the hold: today's rule (EL15)",
    (cell) => {
      expect(DEFAULT_BALANCE.absorption.SWALLOW_GATE_TRAITS).toEqual([]);
      expect(bacteriumContactOutcome(cell, NOTHING_HELD, DEFAULT_BALANCE)).toBe(BACTERIUM_CONTACT_OUTCOME.swallow);
      expect(bacteriumContactOutcome(cell, LATCH_MAX_HELD, DEFAULT_BALANCE)).toBe(BACTERIUM_CONTACT_OUTCOME.swallow);
    },
  );

  it('passes over a bacterium below the latch stage with the switch on: the protocell', () => {
    expect(bacteriumContactOutcome(PROTOCELL, NOTHING_HELD, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.pass);
  });

  it.each([ARCHAEON, ENDOSYMBIONT, EUKARYOTE])(
    'latches at $stage without the gate trait below the cap with the switch on',
    (cell) => {
      expect(bacteriumContactOutcome(cell, NOTHING_HELD, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.latch);
      expect(bacteriumContactOutcome(cell, LATCH_MAX_HELD - 1, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.latch);
    },
  );

  it('passes a bacterium over at the cap: it slides under a full hold', () => {
    expect(bacteriumContactOutcome(ARCHAEON, LATCH_MAX_HELD, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.pass);
  });

  it('swallows with the gate trait, whatever the stage and however full the hold, with the switch on', () => {
    expect(bacteriumContactOutcome(ARCHAEON_WITH_THE_LATTICE, NOTHING_HELD, switchOn)).toBe(
      BACTERIUM_CONTACT_OUTCOME.swallow,
    );
    expect(bacteriumContactOutcome(ARCHAEON_WITH_THE_LATTICE, LATCH_MAX_HELD, switchOn)).toBe(
      BACTERIUM_CONTACT_OUTCOME.swallow,
    );
  });

  it('reads the latch stage from the balance it is given', () => {
    const latchFromProtocell = structuredClone(switchOn);
    latchFromProtocell.earlyLife.LATCH_FROM_STAGE = CELL_STAGE.protocell;
    expect(bacteriumContactOutcome(PROTOCELL, NOTHING_HELD, latchFromProtocell)).toBe(BACTERIUM_CONTACT_OUTCOME.latch);
  });
});
