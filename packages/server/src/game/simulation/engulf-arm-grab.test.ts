// The arm grab (docs/ecology/absorption.md §6.1, #735) rule by rule on the E9 pair from `testing/engulf-builders.ts`
// (A 100 / B 20): an arm reaches `armGrabReachRadii` of A's radius past its body's engulf contact, starts and holds an
// engulf there, draws the prey in, and leaves the seal to the body. The same rules through the whole tick are T23 in
// `testing/scenarios/traits-engulf-arm-grab.gameplay.test.ts`.

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_ARM_GRAB_REACH_RADII,
  DEFAULT_BALANCE,
  ENGULF_RELEASE_REASON,
  ENGULF_SEAL_PROGRESS,
  TICK_INTERVAL_S,
  distanceBetween,
  foldModifiers,
  secondsToTicks,
} from '@evolution/shared';
import {
  ENGULF_PREY_MASS,
  createEngulfFixture,
  releaseReasonsOf,
  stepEngulf,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import { createTestStepContext } from '../../testing/world-builders.js';
import { setBalanceForDebug } from '../debug/debug-operations.js';
import { engulfContactGap } from './contact.js';
import { canStartEngulf } from './engulf.js';
import {
  armPullPerTick,
  grabContactGap,
  hasArmRegrabRefractory,
  isGrabContact,
  pullPreyByArm,
} from './engulf-arm-grab.js';
import { speedCapOf } from './movement.js';

const AMOEBA_I = [{ traitId: 'amoeba_pseudopods', tier: 1 }] as const;
/** E10's under-ratio predator: 24 against 20 never starts, arm or no arm. */
const UNDER_RATIO_MASS = 24;
/** Where B sits between A's body reach and its arm's: this share of the arm's reach past the body. */
const HALF_WAY_OUT_THE_ARM = 0.5;
/** Just past the arm's tip, or just inside the body's reach when subtracted (wu). */
const PAST_THE_ARM_WU = 0.01;
/** A balance path, named through a constant because a patch is keyed by constant names. */
const PULL_LEAF = 'ENGULF_ARM_PULL_RADII_PER_SECOND';
/** An amoeba large enough that 1.5 of its radii a second outruns a free prey: R = 4 √1000 ≈ 126 wu. */
const LARGE_PREDATOR_MASS = 1000;
/** Cooldown windows the alternating prey is watched for. */
const WINDOWS = 4;
/** Enough ticks for any engulf to have sealed twice over. */
const LONG_HOLD_TICKS = 120;
const DISTANCE_DIGITS = 9;

function withArms(fixture: EngulfFixture): EngulfFixture {
  fixture.predator.modifiers = foldModifiers(AMOEBA_I, DEFAULT_BALANCE.traits.TRAIT_TIERS);
  return fixture;
}

/** B moved along the pair's line to `share` of A's arm reach past A's body contact. */
function placeOutTheArm(fixture: EngulfFixture, share: number, extraWu = 0): void {
  const { predator, prey } = fixture;
  const bodyReach = predator.radius - prey.radius * DEFAULT_BALANCE.absorption.ENGULF_COVERAGE_FRACTION;
  prey.x = predator.x + bodyReach + share * predator.radius * AMOEBA_ARM_GRAB_REACH_RADII + extraWu;
  prey.y = predator.y;
}

function armPair(options: { predatorMass?: number; hasArms?: boolean; share?: number; extraWu?: number } = {}) {
  const fixture = createEngulfFixture({ predatorMass: options.predatorMass });
  if (options.hasArms ?? true) withArms(fixture);
  placeOutTheArm(fixture, options.share ?? HALF_WAY_OUT_THE_ARM, options.extraWu);
  return fixture;
}

/** The pull patched to nothing, as `debug_set_balance` patches it, so only the body can end an arm hold. */
function withoutPull(fixture: EngulfFixture): void {
  setBalanceForDebug(fixture.world, { absorption: { [PULL_LEAF]: 0 } });
  fixture.context = createTestStepContext(fixture.world);
}

describe('the grab reach (docs/ecology/absorption.md §6.1, #735)', () => {
  it('is the body engulf contact for a cell without arms', () => {
    const { predator, prey } = armPair({ hasArms: false });
    expect(grabContactGap(predator, prey, DEFAULT_BALANCE)).toBe(engulfContactGap(predator, prey, DEFAULT_BALANCE));
  });

  it("reaches the arm's shortest length past the body for the amoeba", () => {
    const { predator, prey } = armPair();
    const armReach = predator.radius * AMOEBA_ARM_GRAB_REACH_RADII;
    expect(grabContactGap(predator, prey, DEFAULT_BALANCE)).toBeCloseTo(
      engulfContactGap(predator, prey, DEFAULT_BALANCE) - armReach,
      DISTANCE_DIGITS,
    );
    expect(isGrabContact(predator, prey, DEFAULT_BALANCE)).toBe(true);
    expect(isGrabContact(predator, armPair({ share: 1, extraWu: PAST_THE_ARM_WU }).prey, DEFAULT_BALANCE)).toBe(false);
  });
});

describe('starting an engulf by the arm (#735)', () => {
  it('starts an engulf on a prey only the arm touches, and advances it on the same tick', () => {
    const fixture = armPair();
    expect(engulfContactGap(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBeGreaterThan(0);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(true);
    stepEngulf(fixture);
    expect(fixture.predator.engulfingCellId).toBe(fixture.prey.id);
    expect(fixture.prey.engulfProgress).toBeGreaterThan(0);
  });

  it('never starts on a prey the mass ratio does not allow, however far the arm reaches', () => {
    const fixture = armPair({ predatorMass: UNDER_RATIO_MASS });
    expect(fixture.prey.mass).toBe(ENGULF_PREY_MASS);
    expect(isGrabContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(true);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
  });

  it('never starts from the same place for a predator without arms', () => {
    const fixture = armPair({ hasArms: false });
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBeNull();
  });

  it("never grabs a prey that is steering away through the arm's reach", () => {
    const fixture = armPair();
    fixture.prey.steerCommand = { directionX: 1, directionY: 0, throttle: 1 };
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
  });

  it("never starts past the arm's tip", () => {
    const fixture = armPair({ share: 1, extraWu: PAST_THE_ARM_WU });
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
  });
});

describe('the arm draws the prey in (#735)', () => {
  const pullPerTick = (fixture: EngulfFixture): number =>
    DEFAULT_BALANCE.absorption.ENGULF_ARM_PULL_RADII_PER_SECOND * fixture.predator.radius * TICK_INTERVAL_S;

  it('moves a prey held by the arm alone toward the predator by the pull, along the centre line', () => {
    const fixture = armPair();
    const before = distanceBetween(fixture.predator, fixture.prey);
    pullPreyByArm(fixture, fixture.world, DEFAULT_BALANCE);
    expect(distanceBetween(fixture.predator, fixture.prey)).toBeCloseTo(before - pullPerTick(fixture), DISTANCE_DIGITS);
    expect(fixture.prey.y).toBe(fixture.predator.y);
  });

  it("never draws faster than its share of the prey's own speed cap, however large the amoeba", () => {
    const fixture = armPair({ predatorMass: LARGE_PREDATOR_MASS });
    const byRadius = pullPerTick(fixture);
    const byPreySpeed =
      DEFAULT_BALANCE.absorption.ENGULF_ARM_PULL_MAX_PREY_SPEED_SHARE *
      speedCapOf(fixture.prey, fixture.world, DEFAULT_BALANCE) *
      TICK_INTERVAL_S;
    expect(byPreySpeed).toBeLessThan(byRadius);
    expect(armPullPerTick(fixture, fixture.world, DEFAULT_BALANCE)).toBeCloseTo(byPreySpeed, DISTANCE_DIGITS);
  });

  it('leaves a prey in body contact, one past the arm, and any prey of a predator without arms where it is', () => {
    const inBody = createEngulfFixture();
    withArms(inBody);
    for (const fixture of [inBody, armPair({ share: 1, extraWu: PAST_THE_ARM_WU }), armPair({ hasArms: false })]) {
      const before = { x: fixture.prey.x, y: fixture.prey.y };
      pullPreyByArm(fixture, fixture.world, DEFAULT_BALANCE);
      expect({ x: fixture.prey.x, y: fixture.prey.y }).toEqual(before);
    }
  });
});

describe('only the body seals (#735)', () => {
  it('holds the progress under the seal while the arm alone holds the prey, and seals once the body covers it', () => {
    const fixture = armPair();
    withoutPull(fixture);
    stepEngulf(fixture, LONG_HOLD_TICKS);
    expect(fixture.predator.engulfingCellId).toBe(fixture.prey.id);
    expect(fixture.prey.engulfProgress).toBeLessThan(ENGULF_SEAL_PROGRESS);
    expect(fixture.prey.carriedOffsetX).toBeNull();
    placeOutTheArm(fixture, 0, -PAST_THE_ARM_WU);
    stepEngulf(fixture);
    expect(fixture.prey.carriedOffsetX).not.toBeNull();
    expect(fixture.prey.engulfProgress).toBeGreaterThan(ENGULF_SEAL_PROGRESS);
  });

  it("lets a prey that steers away drain out on the arm, never held in a stalemate at arm's length", () => {
    const fixture = armPair();
    withoutPull(fixture);
    stepEngulf(fixture, LONG_HOLD_TICKS);
    const atTheLip = fixture.prey.engulfProgress;
    fixture.prey.steerCommand = { directionX: 1, directionY: 0, throttle: 1 };
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress).toBeLessThan(atTheLip);
    stepEngulf(fixture, LONG_HOLD_TICKS);
    expect(isGrabContact(fixture.predator, fixture.prey, DEFAULT_BALANCE)).toBe(true);
    expect(fixture.prey.engulfedByCellId).toBeNull();
    expect(releaseReasonsOf(fixture.context.effects)).toEqual([ENGULF_RELEASE_REASON.escaped]);
  });
});

describe('the arm re-grab cooldown (#735)', () => {
  const cooldownTicks = secondsToTicks(DEFAULT_BALANCE.absorption.ENGULF_ARM_REGRAB_COOLDOWN_SECONDS);
  const steersAway = { directionX: 1, directionY: 0, throttle: 1 };
  const steersSideways = { directionX: 0, directionY: 1, throttle: 1 };

  /** The ticks on which the predator took hold of the prey, over `ticks` engulf steps of the prey's `steering`. */
  function grabTicks(
    fixture: EngulfFixture,
    ticks: number,
    steering: (tick: number) => EngulfFixture['prey']['steerCommand'],
  ) {
    const grabbed: number[] = [];
    for (let step = 0; step < ticks; step += 1) {
      fixture.prey.steerCommand = steering(step);
      const wasFree = fixture.predator.engulfingCellId === null;
      stepEngulf(fixture);
      if (wasFree && fixture.predator.engulfingCellId === fixture.prey.id) grabbed.push(fixture.world.tick);
    }
    return grabbed;
  }

  it('grabs a prey that alternates steering away and sideways at most once per cooldown window', () => {
    const fixture = armPair();
    withoutPull(fixture);
    const grabbed = grabTicks(fixture, WINDOWS * cooldownTicks, (step) =>
      step % 2 === 0 ? steersSideways : steersAway,
    );
    expect(grabbed.length).toBeGreaterThan(1);
    for (let index = 1; index < grabbed.length; index += 1) {
      expect(grabbed[index]! - grabbed[index - 1]!).toBeGreaterThan(cooldownTicks);
    }
  });

  it('still lets the body catch the prey during the cooldown', () => {
    const fixture = armPair();
    withoutPull(fixture);
    grabTicks(fixture, 2, (step) => (step === 0 ? steersSideways : steersAway));
    expect(fixture.predator.engulfingCellId).toBeNull();
    expect(hasArmRegrabRefractory(fixture.predator, fixture.prey.id, fixture.world.tick + 1)).toBe(true);
    fixture.prey.steerCommand = steersSideways;
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
    placeOutTheArm(fixture, 0, -PAST_THE_ARM_WU);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(true);
  });
});
