import { describe, expect, it } from 'vitest';
import { ZONE_ID, entityId, secondsToTicks, type MassFlowView } from '@evolution/shared';
import { createTestCellAbsorbedEffect, createTestEatEffect } from '../../../testing/builders';
import {
  MASS_TREND_ENTER_PER_SECOND,
  MASS_TREND_EXIT_PER_SECOND,
  MASS_TREND_WINDOW_SECONDS,
} from './legibility-constants';
import { MASS_TREND, massEventAmountOf, massTrendFor, trendFor, type MassTrendSample } from './mass-trend';

const OWN = entityId('own');
const OTHER = entityId('other');

function flow(ratesPerSecond: MassFlowView['ratesPerSecond'], sprintSpent?: number): MassFlowView {
  return { ratesPerSecond, zone: ZONE_ID.openBroth, ...(sprintSpent === undefined ? {} : { sprintSpent }) };
}

function sample(tick: number, overrides: Partial<MassTrendSample> = {}): MassTrendSample {
  return { cellId: OWN, tick, massFlow: flow({}), effects: [], ...overrides };
}

describe('trendFor', () => {
  it(`leaves steady only at ${MASS_TREND_ENTER_PER_SECOND} mass/s`, () => {
    expect(trendFor(MASS_TREND.steady, -0.19)).toBe(MASS_TREND.steady);
    expect(trendFor(MASS_TREND.steady, -MASS_TREND_ENTER_PER_SECOND)).toBe(MASS_TREND.down);
    expect(trendFor(MASS_TREND.steady, MASS_TREND_ENTER_PER_SECOND)).toBe(MASS_TREND.up);
  });

  it(`holds a trend down to ${MASS_TREND_EXIT_PER_SECOND} mass/s, so a rate on the threshold does not flicker`, () => {
    expect(trendFor(MASS_TREND.down, -0.15)).toBe(MASS_TREND.down);
    expect(trendFor(MASS_TREND.down, -0.09)).toBe(MASS_TREND.steady);
    expect(trendFor(MASS_TREND.up, 0.1)).toBe(MASS_TREND.up);
  });

  it('turns straight round when the rate crosses to the other side above the exit', () => {
    expect(trendFor(MASS_TREND.up, -0.5)).toBe(MASS_TREND.down);
  });
});

describe('massEventAmountOf', () => {
  it('adds the own eats and engulf payouts and takes off a sprint, ignoring other cells', () => {
    const effects = [
      createTestEatEffect({ cellId: OWN, massGained: 3 }),
      createTestEatEffect({ cellId: OTHER, massGained: 50 }),
      createTestCellAbsorbedEffect({ cellId: OTHER, predatorCellId: OWN, predatorMassGained: 60 }),
      createTestCellAbsorbedEffect({ cellId: OWN, predatorCellId: OTHER, predatorMassGained: 99 }),
    ];
    expect(massEventAmountOf(sample(1, { effects, massFlow: flow({}, 16) }))).toBe(3 + 60 - 16);
  });
});

describe('massTrendFor', () => {
  it('reads the net rate from the applied rates, never from a mass difference', () => {
    const memory = massTrendFor(null, sample(10, { massFlow: flow({ toxin: -9.36, decay: -0.5 }) }));
    expect(memory.ratePerSecond).toBeCloseTo(-9.86);
    expect(memory.trend).toBe(MASS_TREND.down);
  });

  it('spreads a one-off amount over the window and forgets it once the window has passed', () => {
    const windowTicks = secondsToTicks(MASS_TREND_WINDOW_SECONDS);
    const eaten = massTrendFor(null, sample(10, { effects: [createTestEatEffect({ cellId: OWN, massGained: 3 })] }));
    expect(eaten.ratePerSecond).toBe(3 / MASS_TREND_WINDOW_SECONDS);
    expect(eaten.trend).toBe(MASS_TREND.up);
    const inside = massTrendFor(eaten, sample(10 + windowTicks - 1));
    expect(inside.ratePerSecond).toBe(3 / MASS_TREND_WINDOW_SECONDS);
    const after = massTrendFor(inside, sample(10 + windowTicks));
    expect(after.ratePerSecond).toBe(0);
    expect(after.trend).toBe(MASS_TREND.steady);
  });

  it('reads a sprint as a fall: its cost is a one-off loss', () => {
    expect(massTrendFor(null, sample(4, { massFlow: flow({}, 16) })).trend).toBe(MASS_TREND.down);
  });

  it('counts a snapshot once when the same tick is seen again', () => {
    const effects = [createTestEatEffect({ cellId: OWN, massGained: 3 })];
    const first = massTrendFor(null, sample(10, { effects }));
    expect(massTrendFor(first, sample(10, { effects }))).toBe(first);
  });

  it('starts fresh on a new own cell id, so a respawn never reads as a fall', () => {
    const dying = massTrendFor(null, sample(10, { massFlow: flow({ toxin: -30 }) }));
    const respawned = massTrendFor(dying, sample(11, { cellId: OTHER }));
    expect(respawned).toMatchObject({ cellId: OTHER, trend: MASS_TREND.steady, ratePerSecond: 0, events: [] });
  });
});
