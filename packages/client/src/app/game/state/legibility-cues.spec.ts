// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  ZONE_ID,
  createTestPlayerProgressView,
  createTestTraitOfferView,
  entityId,
  type MassFlowView,
} from '@evolution/shared';
import { createTestCellView } from '../../../testing/builders';
import { zoneEntryFor } from '../hud/format/zone-pill';
import { legibilityCuesFor, type LegibilityCuesInput } from './legibility-cues';
import { MASS_TREND, massTrendFor } from './mass-trend';

const TICK = 10;
const OWN = createTestCellView({ id: entityId('own'), mass: 312.7 });

function massFlow(overrides: Partial<MassFlowView> = {}): MassFlowView {
  return { ratesPerSecond: {}, zone: ZONE_ID.warmVent, ...overrides };
}

function input(overrides: Partial<LegibilityCuesInput> = {}): LegibilityCuesInput {
  return {
    ownCell: OWN,
    ownProgress: createTestPlayerProgressView({ massFlow: massFlow() }),
    balance: DEFAULT_BALANCE,
    tick: TICK,
    massTrend: null,
    zoneEntry: null,
    isBeingEngulfed: false,
    ...overrides,
  };
}

describe('legibilityCuesFor: the mass chip', () => {
  it('floors the mass and reads steady without a trend memory', () => {
    expect(legibilityCuesFor(input()).massChip).toEqual({
      mass: 312,
      trend: MASS_TREND.steady,
      ratePerSecond: 0,
      rateText: '0/s',
    });
  });

  it("reads the trend memory of this cell, and ignores another cell's", () => {
    const sample = { tick: TICK, massFlow: massFlow({ ratesPerSecond: { toxin: -9.36 } }), effects: [] };
    const own = massTrendFor(null, { ...sample, cellId: OWN.id });
    expect(legibilityCuesFor(input({ massTrend: own })).massChip).toMatchObject({
      trend: MASS_TREND.down,
      rateText: '9.4/s',
    });
    const other = massTrendFor(null, { ...sample, cellId: entityId('other') });
    expect(legibilityCuesFor(input({ massTrend: other })).massChip.trend).toBe(MASS_TREND.steady);
  });
});

describe('legibilityCuesFor: the zone', () => {
  const entered = zoneEntryFor(null, { cellId: OWN.id, zone: ZONE_ID.warmVent, tick: TICK });

  it('carries the pill text while the pill is up', () => {
    expect(legibilityCuesFor(input({ zoneEntry: entered })).zone).toEqual({
      zone: ZONE_ID.warmVent,
      pillText: `Warm vent · decay ×${DEFAULT_BALANCE.ecology.VENT_DECAY_MULTIPLIER} · orange rods`,
    });
  });

  it('hides the pill while a pick is open, while an engulf holds the cell, and for another cell’s memory', () => {
    const picking = createTestPlayerProgressView({ massFlow: massFlow(), offer: createTestTraitOfferView() });
    expect(legibilityCuesFor(input({ zoneEntry: entered, ownProgress: picking })).zone?.pillText).toBeNull();
    expect(legibilityCuesFor(input({ zoneEntry: entered, isBeingEngulfed: true })).zone?.pillText).toBeNull();
    const elsewhere = zoneEntryFor(null, { cellId: entityId('other'), zone: ZONE_ID.warmVent, tick: TICK });
    expect(legibilityCuesFor(input({ zoneEntry: elsewhere })).zone?.pillText).toBeNull();
  });

  it('has no zone and no rate tags without mass-flow facts', () => {
    const cues = legibilityCuesFor(input({ ownProgress: createTestPlayerProgressView({ massFlow: null }) }));
    expect(cues.zone).toBeNull();
    expect(cues.rateTags).toEqual([]);
  });
});

describe('legibilityCuesFor: the sprint cost', () => {
  it('hands the cost over with the tick it arrived with, and nothing without one', () => {
    const sprinting = createTestPlayerProgressView({ massFlow: massFlow({ sprintSpent: 16 }) });
    expect(legibilityCuesFor(input({ ownProgress: sprinting })).sprintSpent).toEqual({ amount: 16, tick: TICK });
    expect(legibilityCuesFor(input()).sprintSpent).toBeNull();
  });
});
