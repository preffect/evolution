import { describe, expect, it } from 'vitest';
import { MASS_RATE_CAUSES, ZONE_ID, playerId, zeroRecord } from '@evolution/shared';
import {
  beginMetabolismRecords,
  createMassFlowLedger,
  recordMetabolism,
  recordSprintSpent,
  sealSprintWindow,
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

  it('adds the window’s sprint starts and reports them only once sealed', () => {
    const ledger = createMassFlowLedger();
    const first = 2;
    const second = 3;
    recordSprintSpent(ledger, ALICE, first);
    recordSprintSpent(ledger, ALICE, second);
    expect(ledger.sprintSpentByPlayer[ALICE]).toBeUndefined();
    sealSprintWindow(ledger);
    expect(ledger.sprintSpentByPlayer[ALICE]).toBe(first + second);
    sealSprintWindow(ledger);
    expect(ledger.sprintSpentByPlayer[ALICE]).toBeUndefined();
  });
});
