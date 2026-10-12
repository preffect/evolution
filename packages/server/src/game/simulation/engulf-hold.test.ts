// The kept grab (docs/ecology/absorption.md §6.1, #819): an engulf that has started holds its prey, and seals it,
// while any of it is still under the predator, unless the prey's sprint is running, when the start's half-covered bound
// holds and seals it instead. Starting an engulf still needs the half-covered bound. The rows run on the E9 pair from
// `testing/engulf-builders.ts` (A 100 / B 20: A's radius 40, B's 17.9), the step driven directly.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_PHASE,
  ENGULF_RELEASE_REASON,
  engulfPhaseOf,
  foldModifiers,
} from '@evolution/shared';
import {
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  ENGULF_PREY_MASS,
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
/**
 * `sprintRemainingTicks` as the engulf step reads it with one tick of the sprint still to run: the smallest value that
 * counts as sprinting. Movement ages the field before the engulf step, so on the sprint's last full-speed tick it already
 * reads 0 and the kept grab applies.
 */
const ONE_SPRINT_TICK_LEFT = 1;
/** Inside or outside a contact bound by this much (wu). */
const MARGIN_WU = 0.1;
/** Far beyond any contact bound and still inside the dish (wu). */
const OUT_OF_CONTACT_WU = 1000;
/** A predator with arms, so a prey that is not steering away is held by the arm wherever the body lets go (#735). */
const AMOEBA_I = [{ traitId: 'amoeba_pseudopods', tier: 1 }] as const;

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
    fixture.prey.sprintRemainingTicks = ONE_SPRINT_TICK_LEFT;
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

  it('seals a held prey that is not sprinting past the half-covered bound, and swallows it', () => {
    const fixture = fixtureOf();
    stepEngulf(fixture, E9_LATE_COVER_TICK);
    preyOnTheRim(fixture);
    stepEngulf(fixture, E9_SEAL_TICK - E9_LATE_COVER_TICK - 1);
    expect(isEngulfContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(false);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.wrap);
    stepEngulf(fixture);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.absorb);
    stepEngulf(fixture, E9_PAYOUT_TICK - E9_SEAL_TICK);
    const absorbed = fixture.context.effects.filter((effect) => effect.kind === EFFECT_KIND.cellAbsorbed);
    expect(absorbed).toHaveLength(1);
    expect(releaseReasonsOf(fixture.context.effects)).toEqual([]);
  });
});

/**
 * The E9 pair with the prey on the predator's rim one tick short of the seal, held there by the kept grab. The predator
 * then grows arms (their pull would have drawn the prey in on the way), so a prey steering nowhere is held by the arm
 * whether or not it sprints: only the body's hold, which the sprint narrows, decides the seal.
 */
function armHeldAtTheLip(prey: 'sprinting' | 'swimming'): EngulfFixture {
  const fixture = createEngulfFixture();
  stepEngulf(fixture, E9_LATE_COVER_TICK);
  preyOnTheRim(fixture);
  stepEngulf(fixture, E9_SEAL_TICK - E9_LATE_COVER_TICK - 1);
  fixture.predator.modifiers = foldModifiers(AMOEBA_I, DEFAULT_BALANCE.traits.TRAIT_TIERS);
  fixture.prey.sprintRemainingTicks = prey === 'sprinting' ? E9_PAYOUT_TICK : 0;
  return fixture;
}

describe('the seal under the kept grab (#819)', () => {
  it('seals a prey on the rim that is not sprinting', () => {
    const fixture = armHeldAtTheLip('swimming');
    stepEngulf(fixture);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.absorb);
  });

  it('never seals a sprinting prey in the same spot: the arm holds it at the lip until the body covers half of it', () => {
    const fixture = armHeldAtTheLip('sprinting');
    const lipProgress = fixture.prey.engulfProgress;
    stepEngulf(fixture);
    expect(isEngulfContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(false);
    expect(isHeldBy(fixture)).toBe(true);
    expect(fixture.prey.engulfProgress).toBe(lipProgress);
    expect(engulfPhaseOf(fixture.prey.engulfProgress, absorption)).toBe(ENGULF_PHASE.wrap);
  });
});
