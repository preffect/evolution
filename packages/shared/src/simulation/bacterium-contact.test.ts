// docs/game-design/early-life.md §15.5.1 and §15.4.1: what a player cell's touch does to a bacterium, at the shipping
// switch and with the "early life on" slice's.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { STAGE_ORDER } from '../constants/ladder.js';
import { CELL_STAGE } from '../types/game.js';
import { withSwallowFromStage } from '../testing/swallow-balance.js';
import { BACTERIUM_CONTACT_OUTCOME, bacteriumContactOutcome } from './bacterium-contact.js';

const switchOn = withSwallowFromStage(CELL_STAGE.eukaryote);
const { LATCH_MAX_HELD } = DEFAULT_BALANCE.earlyLife;
const NOTHING_HELD = 0;

describe('bacteriumContactOutcome', () => {
  it.each(STAGE_ORDER)("swallows at %s with the shipping switch, however full the hold: today's rule", (stage) => {
    expect(bacteriumContactOutcome(stage, NOTHING_HELD, DEFAULT_BALANCE)).toBe(BACTERIUM_CONTACT_OUTCOME.swallow);
    expect(bacteriumContactOutcome(stage, LATCH_MAX_HELD, DEFAULT_BALANCE)).toBe(BACTERIUM_CONTACT_OUTCOME.swallow);
  });

  it('passes over a bacterium below the latch stage with the switch on: the protocell', () => {
    expect(bacteriumContactOutcome(CELL_STAGE.protocell, NOTHING_HELD, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.pass);
  });

  it.each([CELL_STAGE.prokaryote, CELL_STAGE.endosymbiosis])(
    'latches at %s below the cap with the switch on',
    (stage) => {
      expect(bacteriumContactOutcome(stage, NOTHING_HELD, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.latch);
      expect(bacteriumContactOutcome(stage, LATCH_MAX_HELD - 1, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.latch);
    },
  );

  it('passes a bacterium over at the cap: it slides under a full hold', () => {
    expect(bacteriumContactOutcome(CELL_STAGE.prokaryote, LATCH_MAX_HELD, switchOn)).toBe(
      BACTERIUM_CONTACT_OUTCOME.pass,
    );
  });

  it.each([CELL_STAGE.eukaryote, CELL_STAGE.specialised])('swallows at %s with the switch on', (stage) => {
    expect(bacteriumContactOutcome(stage, NOTHING_HELD, switchOn)).toBe(BACTERIUM_CONTACT_OUTCOME.swallow);
  });

  it('reads the latch stage from the balance it is given', () => {
    const latchFromProtocell = structuredClone(switchOn);
    latchFromProtocell.earlyLife.LATCH_FROM_STAGE = CELL_STAGE.protocell;
    expect(bacteriumContactOutcome(CELL_STAGE.protocell, NOTHING_HELD, latchFromProtocell)).toBe(
      BACTERIUM_CONTACT_OUTCOME.latch,
    );
  });
});
