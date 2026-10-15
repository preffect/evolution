// docs/ui/hud.md §3.1.5 "Applied, at the floor and the cap" (#383): the loss split pro rata, the light and a film's
// graze (docs/game-design/phases.md §14.5.2) after the cap.
import { describe, expect, it } from 'vitest';
import { MASS_RATE_CAUSE, MASS_RATE_CAUSES, TICK_INTERVAL_S, ZONE_ID } from '@evolution/shared';
import { appliedRatesPerSecond, massFlowRecordOf, type MetabolismMeasure } from './metabolism-flow.js';

const DIGITS = 9;
const DEMAND = { toxin: 6, swallowed: 3, decay: 0.5, vent: 0.25 };
const REQUESTED_PER_TICK = (DEMAND.toxin + DEMAND.swallowed + DEMAND.decay + DEMAND.vent) * TICK_INTERVAL_S;
const MASS_AT_START = 300;

/** A measure with no gain unless `overrides` says so: the light and the graze default to the floor's mass. */
function measureOf(overrides: Partial<MetabolismMeasure>): MetabolismMeasure {
  const massAfterFloor = overrides.massAfterFloor ?? MASS_AT_START - REQUESTED_PER_TICK;
  const massAfterLight = overrides.massAfterLight ?? massAfterFloor;
  return {
    demand: DEMAND,
    massAtStart: MASS_AT_START,
    massAfterFloor,
    massAfterLight,
    massAfterGraze: massAfterLight,
    zone: ZONE_ID.warmVent,
    decayMultiplier: 1,
    ...overrides,
  };
}

const sumPerTick = (rates: Record<string, number>) =>
  Object.values(rates).reduce((sum, rate) => sum + rate, 0) * TICK_INTERVAL_S;

describe('appliedRatesPerSecond', () => {
  it('reports each formula value, negated, when the floor does not bite', () => {
    const rates = appliedRatesPerSecond(measureOf({}));
    expect(rates[MASS_RATE_CAUSE.toxin]).toBeCloseTo(-DEMAND.toxin, DIGITS);
    expect(rates[MASS_RATE_CAUSE.swallowed]).toBeCloseTo(-DEMAND.swallowed, DIGITS);
    expect(rates[MASS_RATE_CAUSE.decay]).toBeCloseTo(-DEMAND.decay, DIGITS);
    expect(rates[MASS_RATE_CAUSE.vent]).toBeCloseTo(-DEMAND.vent, DIGITS);
    expect(rates[MASS_RATE_CAUSE.light]).toBe(0);
    expect(rates[MASS_RATE_CAUSE.graze]).toBe(0);
  });

  it('splits what the floor let through in proportion, so the causes add up to the loss', () => {
    const appliedLoss = REQUESTED_PER_TICK / 4;
    const massAfterFloor = MASS_AT_START - appliedLoss;
    const rates = appliedRatesPerSecond(measureOf({ massAfterFloor }));
    expect(sumPerTick(rates)).toBeCloseTo(-appliedLoss, DIGITS);
    expect(rates[MASS_RATE_CAUSE.toxin] / rates[MASS_RATE_CAUSE.decay]).toBeCloseTo(
      DEMAND.toxin / DEMAND.decay,
      DIGITS,
    );
  });

  it('reports the light as applied after the cap, and nothing to split when nothing was asked', () => {
    const massAfterFloor = MASS_AT_START;
    const capped = 0.004;
    const demand = { toxin: 0, swallowed: 0, decay: 0, vent: 0 };
    const rates = appliedRatesPerSecond(measureOf({ demand, massAfterFloor, massAfterLight: massAfterFloor + capped }));
    expect(rates[MASS_RATE_CAUSE.light]).toBeCloseTo(capped / TICK_INTERVAL_S, DIGITS);
    expect(rates[MASS_RATE_CAUSE.graze]).toBe(0);
    for (const cause of MASS_RATE_CAUSES.filter((each) => each !== MASS_RATE_CAUSE.light)) {
      expect(rates[cause]).toBe(cause === MASS_RATE_CAUSE.graze ? 0 : -0);
    }
  });

  it('reports a film’s graze apart from the light, each the mass it added after the cap', () => {
    const light = 0.004;
    const graze = 0.03;
    const massAfterLight = MASS_AT_START + light;
    const measure = measureOf({
      massAfterFloor: MASS_AT_START,
      massAfterLight,
      massAfterGraze: massAfterLight + graze,
    });
    const rates = appliedRatesPerSecond({ ...measure, demand: { toxin: 0, swallowed: 0, decay: 0, vent: 0 } });
    expect(rates[MASS_RATE_CAUSE.light]).toBeCloseTo(light / TICK_INTERVAL_S, DIGITS);
    expect(rates[MASS_RATE_CAUSE.graze]).toBeCloseTo(graze / TICK_INTERVAL_S, DIGITS);
    expect(sumPerTick(rates)).toBeCloseTo(light + graze, DIGITS);
  });
});

describe('massFlowRecordOf', () => {
  it('carries the zone and the folded trait share', () => {
    const decayMultiplier = 0.85;
    const record = massFlowRecordOf(measureOf({ decayMultiplier }));
    expect(record.zone).toBe(ZONE_ID.warmVent);
    expect(record.decayTraitShare).toBeCloseTo(decayMultiplier - 1, DIGITS);
  });
});
