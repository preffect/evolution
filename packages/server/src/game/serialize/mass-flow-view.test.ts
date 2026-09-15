// docs/architecture/wire-contract.md §4 "Wire precision" (#383): rates at 0.01, the trait share at 0.001, the
// sprint and the meal amounts at 0.1; a zero after rounding is left out.
import { describe, expect, it } from 'vitest';
import {
  EFFECT_KIND,
  MASS_RATE_CAUSE,
  MASS_RATE_CAUSES,
  SNAPSHOT_MASS_DECIMALS,
  SNAPSHOT_MASS_RATE_DECIMALS,
  SNAPSHOT_SHARE_DECIMALS,
  ZONE_ID,
  entityId,
  playerId,
  zeroRecord,
  type GameEffect,
} from '@evolution/shared';
import type { MassFlowRecord } from '../world/mass-flow-ledger.js';
import { toEffectView, toMassFlowView } from './mass-flow-view.js';
import { EXACT_SNAPSHOT_VALUES, WIRE_SNAPSHOT_VALUES, quantizeToDecimals } from './quantize.js';

const TOXIN_RATE = -9.3612;
/** Under half a hundredth: rounds to zero on the wire, but is a real rate at full precision. */
const TINY_DECAY_RATE = -0.0049;
const TRAIT_SHARE = 0.85 * 0.9 - 1;
const SPRINT_SPENT = 15.6049;

const RECORD: MassFlowRecord = {
  ratesPerSecond: { ...zeroRecord(MASS_RATE_CAUSES), toxin: TOXIN_RATE, decay: TINY_DECAY_RATE },
  decayTraitShare: TRAIT_SHARE,
  zone: ZONE_ID.warmVent,
};

describe('toMassFlowView', () => {
  it('rounds each number to its wire precision and leaves out the causes that round to zero', () => {
    expect(toMassFlowView(RECORD, SPRINT_SPENT, WIRE_SNAPSHOT_VALUES)).toEqual({
      ratesPerSecond: { toxin: quantizeToDecimals(TOXIN_RATE, SNAPSHOT_MASS_RATE_DECIMALS) },
      decayTraitShare: quantizeToDecimals(TRAIT_SHARE, SNAPSHOT_SHARE_DECIMALS),
      zone: ZONE_ID.warmVent,
      sprintSpent: quantizeToDecimals(SPRINT_SPENT, SNAPSHOT_MASS_DECIMALS),
    });
  });

  it('keeps full precision for the scenario and debug reads, still leaving out exact zeros', () => {
    const view = toMassFlowView(RECORD, undefined, EXACT_SNAPSHOT_VALUES);
    expect(view.ratesPerSecond).toEqual({
      [MASS_RATE_CAUSE.toxin]: TOXIN_RATE,
      [MASS_RATE_CAUSE.decay]: TINY_DECAY_RATE,
    });
    expect(view.decayTraitShare).toBe(TRAIT_SHARE);
    expect('sprintSpent' in view).toBe(false);
  });

  it('omits the trait share and a sprint when both are zero', () => {
    const view = toMassFlowView({ ...RECORD, decayTraitShare: 0 }, 0, WIRE_SNAPSHOT_VALUES);
    expect(Object.keys(view).sort()).toEqual(['ratesPerSecond', 'zone']);
  });
});

describe('toEffectView', () => {
  const place = { tick: 1, x: 1.234, y: 5.678 };
  const massGained = 3.456;
  const dnaGained = 0.049;

  it('rounds the meal amounts of eat and cell_absorbed and nothing else', () => {
    const eat: GameEffect = {
      kind: EFFECT_KIND.eat,
      ...place,
      cellId: entityId('c1'),
      eatenId: entityId('m1'),
      eatenKind: 'food_mote',
      massGained,
      dnaGained,
    };
    expect(toEffectView(eat, WIRE_SNAPSHOT_VALUES)).toEqual({
      ...eat,
      massGained: quantizeToDecimals(massGained, SNAPSHOT_MASS_DECIMALS),
      dnaGained: quantizeToDecimals(dnaGained, SNAPSHOT_MASS_DECIMALS),
    });
    const absorbed: GameEffect = {
      kind: EFFECT_KIND.cellAbsorbed,
      ...place,
      cellId: entityId('c2'),
      playerId: playerId('p2'),
      predatorCellId: entityId('c1'),
      predatorMassGained: massGained,
      predatorDnaGained: dnaGained,
    };
    expect(toEffectView(absorbed, WIRE_SNAPSHOT_VALUES)).toEqual({
      ...absorbed,
      predatorMassGained: quantizeToDecimals(massGained, SNAPSHOT_MASS_DECIMALS),
      predatorDnaGained: quantizeToDecimals(dnaGained, SNAPSHOT_MASS_DECIMALS),
    });
    const levelUp: GameEffect = {
      kind: EFFECT_KIND.levelUp,
      ...place,
      cellId: entityId('c1'),
      playerId: playerId('p1'),
      level: 2,
    };
    expect(toEffectView(levelUp, WIRE_SNAPSHOT_VALUES)).toBe(levelUp);
    expect(toEffectView(eat, EXACT_SNAPSHOT_VALUES)).toEqual(eat);
  });
});
