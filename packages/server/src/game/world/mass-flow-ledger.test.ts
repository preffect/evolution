import { describe, expect, it } from 'vitest';
import { MASS_RATE_CAUSES, MASS_WINDOW_AMOUNT, ZONE_ID, playerId, zeroRecord } from '@evolution/shared';
import {
  beginMetabolismRecords,
  createMassFlowLedger,
  recordMetabolism,
  recordWindowAmount,
  sealMassWindow,
  type MassFlowRecord,
} from './mass-flow-ledger.js';

const ALICE = playerId('alice');
const RECORD: MassFlowRecord = {
  ratesPerSecond: zeroRecord(MASS_RATE_CAUSES),
  decayTraitShare: 0,
  zone: ZONE_ID.openBroth,
};

describe('the mass-flow ledger', () => {
  it('keeps only the latest metabolism step', () => {
    const ledger = createMassFlowLedger();
    recordMetabolism(ledger, ALICE, RECORD);
    expect(ledger.metabolismByPlayer[ALICE]).toBe(RECORD);
    beginMetabolismRecords(ledger);
    expect(ledger.metabolismByPlayer[ALICE]).toBeUndefined();
  });

  it('adds the window’s amounts per kind and reports them only once sealed', () => {
    const ledger = createMassFlowLedger();
    const first = 2;
    const second = 3;
    const bonus = 10;
    recordWindowAmount(ledger, ALICE, MASS_WINDOW_AMOUNT.sprintSpent, first);
    recordWindowAmount(ledger, ALICE, MASS_WINDOW_AMOUNT.sprintSpent, second);
    recordWindowAmount(ledger, ALICE, MASS_WINDOW_AMOUNT.noDraftBonusGained, bonus);
    expect(ledger.sealedWindowByPlayer[ALICE]).toBeUndefined();
    sealMassWindow(ledger);
    expect(ledger.sealedWindowByPlayer[ALICE]).toEqual({ sprintSpent: first + second, noDraftBonusGained: bonus });
    sealMassWindow(ledger);
    expect(ledger.sealedWindowByPlayer[ALICE]).toBeUndefined();
  });
});
