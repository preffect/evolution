// The kept grab (docs/ecology/absorption.md §6.1, #819): an engulf that has started holds its prey while any of it is
// still under the predator, unless the prey's sprint is running, when the start's half-covered bound holds it instead.
// Starting an engulf and the seal still need the half-covered bound. The rows run on the E9 pair from
// `testing/engulf-builders.ts` (A 100 / B 20: A's radius 40, B's 17.9), the step driven directly.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, ENGULF_PHASE, ENGULF_RELEASE_REASON, engulfPhaseOf } from '@evolution/shared';
import {
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  ENGULF_PREY_MASS,
  ENGULF_SEAL_PROGRESS,
  createEngulfFixture,
  releaseReasonsOf,
  stepEngulf,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import { seatTestWildCell } from '../../testing/wild-builders.js';
import type { CellRecord } from '../world/entities.js';
import { isEngulfContact, isEngulfHoldContact } from './contact.js';
import { canStartEngulf } from './engulf.js';

const absorption = DEFAULT_BALANCE.absorption;
const PROGRESS_DIGITS = 10;
/** Late in E9's cover band: 4/36, which two ticks of escape decay drain to 0. */
const E9_LATE_COVER_TICK = 4;
/** A sprint with this many ticks still to run: any running sprint, the last tick of one included. */
const LAST_SPRINT_TICK = 1;
/** Inside or outside a contact bound by this much (wu). */
const MARGIN_WU = 0.1;
/** Far beyond any contact bound and still inside the dish (wu). */
const OUT_OF_CONTACT_WU = 1000;
/** Long enough for an unsealed prey held at the lip to pass E9's payout tick, had it sealed. */
const PAST_THE_PAYOUT_TICKS = E9_PAYOUT_TICK + E9_SEAL_TICK;

/** The centre distance at which the predator covers `coverageFraction` of the prey's radius (wu). */
const reachAt = (fixture: EngulfFixture, coverageFraction: number): number =>
  fixture.predator.radius - fixture.prey.radius * coverageFraction;

/** The prey's centre on the predator's rim: half of it under the predator, short of the half-covered bound. */
function preyOnTheRim(fixture: EngulfFixture): void {
  fixture.prey.x = fixture.predator.x + fixture.predator.radius;
}

/** The E9 pair with the prey a wild cell (#819: players and wild cells hold by the same rule). */
function wildPreyFixture(): EngulfFixture {
  const fixture = createEngulfFixture();
  const { prey: playerPrey } = fixture;
  const { cell: wildPrey } = seatTestWildCell(fixture.world, {
    at: { x: playerPrey.x, y: playerPrey.y },
    mass: ENGULF_PREY_MASS,
  });
  playerPrey.x = BROTH_POINT.x - OUT_OF_CONTACT_WU;
  wildPrey.targetX = wildPrey.x;
  wildPrey.targetY = wildPrey.y;
  return { ...fixture, prey: wildPrey };
}

const PREY_KINDS: readonly (readonly [string, () => EngulfFixture])[] = [
  ['a player', () => createEngulfFixture()],
  ['a wild cell', wildPreyFixture],
];

const isHeldBy = (fixture: EngulfFixture, prey: CellRecord = fixture.prey): boolean =>
  prey.engulfedByCellId === fixture.predator.id;

describe('the kept grab bound (#819)', () => {
  it('holds a prey that is not sprinting while any of it is under the predator, past the half-covered bound', () => {
    const fixture = createEngulfFixture();
    preyOnTheRim(fixture);
    expect(isEngulfContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(false);
    expect(isEngulfHoldContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(true);
    fixture.prey.x = fixture.predator.x + reachAt(fixture, absorption.ENGULF_HOLD_COVERAGE_FRACTION) - MARGIN_WU;
    expect(isEngulfHoldContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(true);
  });

  it('lets go once the cells no longer touch', () => {
    const fixture = createEngulfFixture();
    fixture.prey.x = fixture.predator.x + fixture.predator.radius + fixture.prey.radius + MARGIN_WU;
    expect(isEngulfHoldContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(false);
  });

  it('holds a sprinting prey by the half-covered bound only', () => {
    const fixture = createEngulfFixture();
    fixture.prey.sprintRemainingTicks = LAST_SPRINT_TICK;
    preyOnTheRim(fixture);
    expect(isEngulfHoldContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(false);
    fixture.prey.x = fixture.predator.x + reachAt(fixture, absorption.ENGULF_COVERAGE_FRACTION) - MARGIN_WU;
    expect(isEngulfHoldContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(true);
    fixture.prey.x += 2 * MARGIN_WU;
    expect(isEngulfHoldContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(false);
  });
});

describe.each(PREY_KINDS)('the kept grab in the engulf step, the prey %s (#819)', (_kind, fixtureOf) => {
  it('keeps advancing a started cover after the prey slips past the half-covered bound', () => {
    const fixture = fixtureOf();
    stepEngulf(fixture, E9_LATE_COVER_TICK);
    const covered = fixture.prey.engulfProgress;
    preyOnTheRim(fixture);
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress).toBeCloseTo(covered + 1 / E9_PAYOUT_TICK, PROGRESS_DIGITS);
    expect(releaseReasonsOf(fixture.context.effects)).toEqual([]);
    expect(isHeldBy(fixture)).toBe(true);
  });

  it('drains the same cover and lets the prey escape while its sprint runs', () => {
    const fixture = fixtureOf();
    stepEngulf(fixture, E9_LATE_COVER_TICK);
    const covered = fixture.prey.engulfProgress;
    preyOnTheRim(fixture);
    fixture.prey.sprintRemainingTicks = E9_PAYOUT_TICK;
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress).toBeCloseTo(
      covered - absorption.ENGULF_ESCAPE_DECAY_MULTIPLIER / E9_PAYOUT_TICK,
      PROGRESS_DIGITS,
    );
    stepEngulf(fixture, E9_LATE_COVER_TICK);
    expect(releaseReasonsOf(fixture.context.effects)).toEqual([ENGULF_RELEASE_REASON.escaped]);
    expect(isHeldBy(fixture)).toBe(false);
  });

  it('never starts an engulf on a prey past the half-covered bound', () => {
    const fixture = fixtureOf();
    preyOnTheRim(fixture);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
    stepEngulf(fixture, E9_SEAL_TICK);
    expect(isHeldBy(fixture)).toBe(false);
    expect(fixture.prey.engulfProgress).toBe(0);
  });

  it('never seals a prey the kept grab alone holds: it waits at the lip until the body covers it', () => {
    const fixture = fixtureOf();
    stepEngulf(fixture, E9_LATE_COVER_TICK);
    const placedX = fixture.prey.x;
    preyOnTheRim(fixture);
    stepEngulf(fixture, PAST_THE_PAYOUT_TICKS);
    expect(isHeldBy(fixture)).toBe(true);
    expect(fixture.prey.engulfProgress).toBeLessThan(ENGULF_SEAL_PROGRESS);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.wrap);
    fixture.prey.x = placedX;
    stepEngulf(fixture);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.absorb);
  });
});
