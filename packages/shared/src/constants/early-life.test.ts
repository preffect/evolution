// docs/game-design/early-life.md §15.12: the swallow switch and the latch's constants, as decided and as the starting
// tuning values, carried by the balance so a room (and a patch) reads them.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE } from '../types/game.js';
import { SWALLOW_GATE_TRAITS } from './absorption.js';
import { DEFAULT_BALANCE } from './balance.js';
import * as earlyLife from './early-life.js';

describe('the swallow switch (early-life.md §15.10)', () => {
  it('ships empty (no gate), so the default game swallows from the start as before the early-life build', () => {
    expect(SWALLOW_GATE_TRAITS).toEqual([]);
    expect(DEFAULT_BALANCE.absorption.SWALLOW_GATE_TRAITS).toEqual(SWALLOW_GATE_TRAITS);
    expect(DEFAULT_BALANCE.absorption).not.toHaveProperty('SWALLOW_FROM_STAGE');
  });
});

describe('the latch constants (early-life.md §15.12.1)', () => {
  it('latches from the prokaryote stage, the archaeon', () => {
    expect(earlyLife.LATCH_FROM_STAGE).toBe(CELL_STAGE.prokaryote);
  });

  it('starts at the tuning values of the table', () => {
    expect(earlyLife.LATCH_REACH_RADII).toBe(0.25);
    expect(earlyLife.LATCH_MAX_HELD).toBe(5);
    expect(earlyLife.LATCH_BOND_SECONDS).toBe(6);
  });

  it('is the earlyLife balance domain, every constant a leaf', () => {
    expect(DEFAULT_BALANCE.earlyLife).toEqual({ ...earlyLife });
  });
});
