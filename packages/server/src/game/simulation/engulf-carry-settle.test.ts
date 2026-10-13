// The carried prey settles inside (docs/ecology/absorption.md §6.1, #819 review): the kept grab may seal a prey at the
// predator's rim, so from the seal on each movement step draws the carried offset in by
// `ENGULF_CARRY_SETTLE_PREY_RADII_PER_SECOND` prey radii a second, until the prey's centre is no farther out than the
// start's bound. The rows run on the E9 pair from `testing/engulf-builders.ts` (A 100 / B 20: A's radius 40, B's 17.9),
// sealed by hand and moved by `moveCells` alone.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ENGULF_SEAL_PROGRESS, TICK_HZ, TICK_INTERVAL_S, TRAIT_TIERS } from '@evolution/shared';
import { ENGULF_CENTRE_DISTANCE_WU, createEngulfFixture, type EngulfFixture } from '../../testing/engulf-builders.js';
import { createTestStepContext } from '../../testing/world-builders.js';
import { beginEngulf, sealEngulf } from './engulf-state.js';
import { moveCells } from './movement.js';

const absorption = DEFAULT_BALANCE.absorption;
/** Inside the cells-touching bound by this much, so the kept grab still holds the prey (wu). */
const TOUCHING_MARGIN_WU = 0.01;
/** A float comparison on a distance the settle reaches by a product, exact to within rounding (wu). */
const DISTANCE_TOLERANCE_WU = 1e-9;
/** Enough movement steps to settle any seal, with room to spare. */
const WATCHED_TICKS = 30;
/** The farthest seal, 1.5 prey radii past the start bound at 9 prey radii a second, settles in 1/6 s. */
const FARTHEST_SETTLE_TICKS = 10;
/** A seal overshoots `ENGULF_SEAL_PROGRESS` by up to one tick's progress, so its payout can come a tick early. */
const SEAL_OVERSHOOT_TICKS = 1;
/** The neutral duration multiplier: a trait that does not touch the absorb leaves it as it is. */
const UNCHANGED_DURATION_MULTIPLIER = 1;

/** The fastest predator absorb any build reaches: each trait's strongest tier, multiplied as the modifiers fold. */
const fastestPredatorAbsorbMultiplier = Object.values(TRAIT_TIERS).reduce(
  (product, tiers) =>
    product *
    Math.min(
      UNCHANGED_DURATION_MULTIPLIER,
      ...tiers.map((tier) => tier.absorbDurationMultiplierAsPredator ?? UNCHANGED_DURATION_MULTIPLIER),
    ),
  UNCHANGED_DURATION_MULTIPLIER,
);

/** The start's bound: how far out a carried prey's centre may sit once settled (wu). */
const settledDistanceOf = ({ predator, prey }: EngulfFixture): number =>
  predator.radius - prey.radius * absorption.ENGULF_COVERAGE_FRACTION;

/** The settle's step a tick for this prey (wu). */
const settleStepOf = ({ prey }: EngulfFixture): number =>
  prey.radius * absorption.ENGULF_CARRY_SETTLE_PREY_RADII_PER_SECOND * TICK_INTERVAL_S;

const carriedDistanceOf = ({ predator, prey }: EngulfFixture): number =>
  Math.hypot(prey.x - predator.x, prey.y - predator.y);

/** The E9 pair sealed with the prey's centre `centreDistanceWu` east of the predator's, both cells still. */
function sealedAt(centreDistanceWu: number): EngulfFixture {
  const fixture = createEngulfFixture();
  const { predator, prey } = fixture;
  prey.x = predator.x + centreDistanceWu;
  prey.targetX = prey.x;
  beginEngulf(fixture);
  prey.engulfProgress = ENGULF_SEAL_PROGRESS;
  sealEngulf(fixture);
  return fixture;
}

/** The pair sealed at the farthest point the kept grab reaches: the cells touching. */
function sealedTouching(): EngulfFixture {
  const fixture = createEngulfFixture();
  return sealedAt(fixture.predator.radius + fixture.prey.radius - TOUCHING_MARGIN_WU);
}

/** The carried centre distance after each of `ticks` movement steps. */
function carriedDistances(fixture: EngulfFixture, ticks: number): number[] {
  const context = createTestStepContext(fixture.world);
  const distances: number[] = [];
  for (let tick = 0; tick < ticks; tick += 1) {
    moveCells(fixture.world, context);
    distances.push(carriedDistanceOf(fixture));
  }
  return distances;
}

describe('a prey sealed at the rim is drawn inside (#819 review)', () => {
  it('starts outside the start bound, so the rows below draw a prey that would otherwise be carried outside', () => {
    const fixture = sealedTouching();
    expect(carriedDistanceOf(fixture)).toBeGreaterThan(fixture.predator.radius);
  });

  it('ends no farther out than predator.radius − prey.radius × ENGULF_COVERAGE_FRACTION, and stays there', () => {
    const fixture = sealedTouching();
    const settledDistance = settledDistanceOf(fixture);
    const settled = carriedDistances(fixture, WATCHED_TICKS).slice(FARTHEST_SETTLE_TICKS - 1);
    for (const distance of settled) {
      expect(distance).toBeLessThanOrEqual(settledDistance + DISTANCE_TOLERANCE_WU);
    }
    expect(settled.at(-1)).toBeCloseTo(settledDistance, 9);
  });

  it('eases in by one settle step a tick, never snapping, and is inside within the farthest seal’s settle ticks', () => {
    const fixture = sealedTouching();
    const settledDistance = settledDistanceOf(fixture);
    const step = settleStepOf(fixture);
    const startDistance = carriedDistanceOf(fixture);
    const distances = carriedDistances(fixture, FARTHEST_SETTLE_TICKS);
    distances.forEach((distance, index) => {
      const expected = Math.max(settledDistance, startDistance - (index + 1) * step);
      expect(distance).toBeCloseTo(expected, 9);
    });
    expect(distances[0]).toBeGreaterThan(settledDistance);
    expect(distances.at(-1)).toBeLessThanOrEqual(settledDistance + DISTANCE_TOLERANCE_WU);
  });

  it('keeps the direction of the offset: the prey is drawn straight toward the predator centre', () => {
    const fixture = sealedTouching();
    const { predator, prey } = fixture;
    prey.y = predator.y + prey.radius;
    sealEngulf(fixture);
    const angleBefore = Math.atan2(prey.carriedOffsetY ?? 0, prey.carriedOffsetX ?? 0);
    expect(carriedDistances(fixture, WATCHED_TICKS).at(-1)).toBeCloseTo(settledDistanceOf(fixture), 9);
    expect(Math.atan2(prey.carriedOffsetY ?? 0, prey.carriedOffsetX ?? 0)).toBeCloseTo(angleBefore, 12);
  });

  it('leaves a prey sealed inside the start bound where it was (E9: 10 wu out)', () => {
    const fixture = sealedAt(ENGULF_CENTRE_DISTANCE_WU);
    const distances = carriedDistances(fixture, WATCHED_TICKS);
    for (const distance of distances) {
      expect(distance).toBeCloseTo(ENGULF_CENTRE_DISTANCE_WU, 12);
    }
  });

  it('settles the farthest seal in FARTHEST_SETTLE_TICKS', () => {
    const farthestExcessPreyRadii = absorption.ENGULF_COVERAGE_FRACTION - absorption.ENGULF_HOLD_COVERAGE_FRACTION;
    const settleSeconds = farthestExcessPreyRadii / absorption.ENGULF_CARRY_SETTLE_PREY_RADII_PER_SECOND;
    expect(Math.ceil(settleSeconds * TICK_HZ)).toBe(FARTHEST_SETTLE_TICKS);
  });

  it('draws the farthest seal’s centre inside the membrane before the fastest absorb (Food Vacuole III) can pay out', () => {
    const outsideMembranePreyRadii = -absorption.ENGULF_HOLD_COVERAGE_FRACTION;
    const insideTicks = Math.ceil(
      (outsideMembranePreyRadii / absorption.ENGULF_CARRY_SETTLE_PREY_RADII_PER_SECOND) * TICK_HZ,
    );
    const fastestAbsorbSeconds =
      absorption.ENGULF_ABSORB_SECONDS * absorption.ENGULF_MIN_DURATION_FACTOR * fastestPredatorAbsorbMultiplier;
    const earliestPayoutTicks = Math.floor(fastestAbsorbSeconds * TICK_HZ) - SEAL_OVERSHOOT_TICKS;
    expect(fastestPredatorAbsorbMultiplier).toBeLessThan(UNCHANGED_DURATION_MULTIPLIER);
    expect(insideTicks).toBeLessThanOrEqual(earliestPayoutTicks);
    const fixture = sealedTouching();
    expect(carriedDistances(fixture, insideTicks).at(-1)).toBeLessThanOrEqual(fixture.predator.radius);
  });

  it('never draws the prey through the centre when the predator is smaller than half its prey', () => {
    const fixture = sealedTouching();
    const { predator, prey } = fixture;
    predator.radius = prey.radius * absorption.ENGULF_COVERAGE_FRACTION * absorption.ENGULF_COVERAGE_FRACTION;
    const distances = carriedDistances(fixture, WATCHED_TICKS);
    for (const distance of distances) {
      expect(distance).toBeGreaterThanOrEqual(0);
    }
    expect(distances.at(-1)).toBe(0);
    expect(prey.carriedOffsetX).toBe(0);
    expect(prey.carriedOffsetY).toBe(0);
  });
});
