// docs/ECOLOGY.md §6.1, §6.2 and §6.3 rule by rule, on the E9 pair from `testing/engulf-builders.ts`
// (A 100 / B 20, or A 30 / B 20 for E16). The step is driven directly so each rule is observed alone;
// the same rules seen through the whole tick are the gameplay rows in
// `testing/scenarios/ecology-engulf.gameplay.test.ts`, and the spit-out is `engulf-spit-out.test.ts`.

import { describe, expect, it } from 'vitest';
import { CELL_STATE, DEFAULT_BALANCE, ENGULF_RELEASE_REASON } from '@evolution/shared';
import { BROTH_POINT } from '../../testing/gameplay/placement.js';
import {
  E9_COVER_TICKS,
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  ENGULF_CENTRE_DISTANCE_WU,
  ENGULF_PREDATOR_MASS,
  ENGULF_PREY_MASS,
  createEngulfFixture,
  releaseReasonsOf,
  stepEngulf,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import { setCellMass } from './cell-mass.js';
import { awayEffortOf, canStartEngulf, isPairInWorld } from './engulf.js';
import { abortAllEngulfs, abortEngulfsOf } from './engulf-state.js';

const absorption = DEFAULT_BALANCE.absorption;
/** Half-way through the wrap band: high enough that one decay tick does not fall out of it. */
const E9_MID_WRAP_TICK = 12;
/** From 12/36, decaying 2/36 a tick, progress reaches 6/36 on the third tick and falls under it on the fourth. */
const E9_ESCAPE_TICKS_FROM_MID_WRAP = 4;
/** Far beyond any contact bound and still inside the dish. */
const OUT_OF_CONTACT_WU = 1000;
const PROGRESS_TOLERANCE = 10;
/** E10's under-ratio predator: 24 against 20 never starts. */
const E10_UNDER_RATIO_MASS = 24;
/** E16: 30 starts the engulf, 23 holds it, 21.5 drops under the release ratio. */
const E16_START_MASS = 30;
const E16_HELD_MASS = 23;
const E16_RELEASED_MASS = 21.5;

const twoCells = (predatorMass = ENGULF_PREDATOR_MASS, preyMass = ENGULF_PREY_MASS, centreDistanceWu?: number) =>
  createEngulfFixture({ predatorMass, preyMass, centreDistanceWu });

const releaseReasons = (fixture: EngulfFixture): unknown[] => releaseReasonsOf(fixture.context.effects);

describe('starting an engulf (docs/ECOLOGY.md §6.1 step 1)', () => {
  it('claims the prey and advances on the same tick', () => {
    const fixture = twoCells();
    stepEngulf(fixture);
    expect(fixture.predator.engulfingCellId).toBe(fixture.prey.id);
    expect(fixture.prey.engulfedByCellId).toBe(fixture.predator.id);
    expect(fixture.predator.states).toEqual([CELL_STATE.engulfing]);
    expect(fixture.prey.states).toEqual([CELL_STATE.beingEngulfed]);
    expect(fixture.prey.engulfProgress).toBeCloseTo(1 / E9_PAYOUT_TICK, PROGRESS_TOLERANCE);
  });

  it('refuses a pair that is out of contact although the mass allows it', () => {
    const fixture = twoCells(ENGULF_PREDATOR_MASS, ENGULF_PREY_MASS, OUT_OF_CONTACT_WU);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBeNull();
  });

  it('refuses a pair under the mass ratio although they overlap (E10)', () => {
    const fixture = twoCells(E10_UNDER_RATIO_MASS, ENGULF_PREY_MASS);
    expect(canStartEngulf(fixture.predator, fixture.prey, fixture.world, DEFAULT_BALANCE)).toBe(false);
  });

  it('leaves a prey another predator already claimed alone', () => {
    const fixture = twoCells();
    stepEngulf(fixture);
    const claimedBy = fixture.prey.engulfedByCellId;
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBe(claimedBy);
    expect(fixture.predator.engulfingCellId).toBe(fixture.prey.id);
  });
});

describe('phases and the seal (docs/ECOLOGY.md §6.1)', () => {
  it('E9: cover for six ticks, seal on tick 18, payout on tick 36', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_COVER_TICKS);
    expect(fixture.prey.engulfProgress).toBeCloseTo(absorption.ENGULF_WRAP_START_PROGRESS, PROGRESS_TOLERANCE);
    expect(fixture.prey.carriedOffsetX).toBeNull();
    stepEngulf(fixture, E9_SEAL_TICK - E9_COVER_TICKS);
    expect(fixture.prey.engulfProgress).toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE);
    expect(fixture.prey.carriedOffsetX).toBeCloseTo(ENGULF_CENTRE_DISTANCE_WU, PROGRESS_TOLERANCE);
    expect(fixture.prey.velocityX).toBe(0);
    stepEngulf(fixture, E9_PAYOUT_TICK - E9_SEAL_TICK);
    expect(fixture.predator.engulfingCellId).toBeNull();
    expect(fixture.prey.engulfProgress).toBe(0);
    expect(fixture.prey.states).toEqual([]);
  });

  it('emits no release effect on completion: the payout is the #259 seam', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_PAYOUT_TICK);
    expect(releaseReasons(fixture)).toEqual([]);
  });

  it('records the carried offset the tick the seal closes, not before', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK - 1);
    expect(fixture.prey.carriedOffsetY).toBeNull();
    stepEngulf(fixture);
    expect(fixture.prey.carriedOffsetY).toBeCloseTo(0, PROGRESS_TOLERANCE);
  });
});

describe('escape (docs/ECOLOGY.md §6.1, §6.3 "prey moves away before the seal")', () => {
  it('releases a cover the tick contact breaks, with progress 0', () => {
    const fixture = twoCells();
    stepEngulf(fixture);
    fixture.prey.x = BROTH_POINT.x + OUT_OF_CONTACT_WU;
    stepEngulf(fixture);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.escaped]);
    expect(fixture.prey.engulfProgress).toBe(0);
    expect(fixture.prey.states).toEqual([]);
  });

  it('decays a wrap out of contact at the escape multiplier and releases it below the wrap band', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_MID_WRAP_TICK);
    const wrapped = fixture.prey.engulfProgress;
    fixture.prey.x = BROTH_POINT.x + OUT_OF_CONTACT_WU;
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress).toBeCloseTo(
      wrapped - absorption.ENGULF_ESCAPE_DECAY_MULTIPLIER / E9_PAYOUT_TICK,
      PROGRESS_TOLERANCE,
    );
    expect(releaseReasons(fixture)).toEqual([]);
    stepEngulf(fixture, E9_ESCAPE_TICKS_FROM_MID_WRAP - 1);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.escaped]);
    expect(fixture.prey.engulfProgress).toBe(0);
  });

  it('never releases a sealed prey for distance: contact holds by construction (E11b)', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    fixture.prey.x = BROTH_POINT.x + OUT_OF_CONTACT_WU;
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBe(fixture.predator.id);
  });
});

describe('the struggle (docs/ECOLOGY.md §6.1)', () => {
  it('is zero for an idle prey and full for one steering straight away', () => {
    const fixture = twoCells();
    expect(awayEffortOf(fixture.predator, fixture.prey)).toBe(0);
    fixture.prey.steerCommand = { directionX: 1, directionY: 0, throttle: 1 };
    expect(awayEffortOf(fixture.predator, fixture.prey)).toBeCloseTo(1, PROGRESS_TOLERANCE);
  });

  it('is zero for a prey steering back into the predator', () => {
    const fixture = twoCells();
    fixture.prey.steerCommand = { directionX: -1, directionY: 0, throttle: 1 };
    expect(awayEffortOf(fixture.predator, fixture.prey)).toBe(0);
  });

  it('E11: steering away at full throttle halves the wrap rate', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_COVER_TICKS + 1);
    const beforeIdle = fixture.prey.engulfProgress;
    stepEngulf(fixture);
    const idleGain = fixture.prey.engulfProgress - beforeIdle;
    fixture.prey.steerCommand = { directionX: 1, directionY: 0, throttle: 1 };
    const beforeStruggle = fixture.prey.engulfProgress;
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress - beforeStruggle).toBeCloseTo(idleGain / 2, PROGRESS_TOLERANCE);
  });
});

describe('the ratio release (docs/ECOLOGY.md §6.1 hysteresis, E16)', () => {
  it('holds between the release and the required ratio', () => {
    const fixture = twoCells(E16_START_MASS, ENGULF_PREY_MASS);
    stepEngulf(fixture);
    setCellMass(fixture.predator, E16_HELD_MASS, DEFAULT_BALANCE);
    stepEngulf(fixture);
    expect(fixture.prey.engulfedByCellId).toBe(fixture.predator.id);
  });

  it('releases below the release ratio, in the wrap phase (E16)', () => {
    const fixture = twoCells(E16_START_MASS, ENGULF_PREY_MASS);
    stepEngulf(fixture, 10);
    setCellMass(fixture.predator, E16_RELEASED_MASS, DEFAULT_BALANCE);
    stepEngulf(fixture);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.ratio]);
    expect(fixture.prey.engulfProgress).toBe(0);
  });

  it('releases a sealed prey at its carried offset (E16b)', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    const carriedX = fixture.prey.x;
    setCellMass(fixture.predator, ENGULF_PREY_MASS, DEFAULT_BALANCE);
    stepEngulf(fixture);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.ratio]);
    expect(fixture.prey.x).toBe(carriedX);
    expect(fixture.prey.carriedOffsetX).toBeNull();
  });
});

describe('aborts (docs/ECOLOGY.md §6.3)', () => {
  it('frees both sides when the prey leaves the world', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    abortEngulfsOf(fixture.world, fixture.prey);
    expect(fixture.predator.engulfingCellId).toBeNull();
    expect(fixture.prey.states).toEqual([]);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.aborted]);
  });

  it('frees a carried prey when its predator leaves the world', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    abortEngulfsOf(fixture.world, fixture.predator);
    expect(fixture.prey.engulfedByCellId).toBeNull();
    expect(fixture.prey.carriedOffsetX).toBeNull();
  });

  it('E13: the results phase aborts every engulf with no payout', () => {
    const fixture = twoCells();
    stepEngulf(fixture, E9_SEAL_TICK);
    abortAllEngulfs(fixture.world);
    expect(fixture.predator.states).toEqual([]);
    expect(fixture.prey.states).toEqual([]);
    expect(releaseReasons(fixture)).toEqual([ENGULF_RELEASE_REASON.aborted]);
  });
});

describe('the branches the E9 pair never reaches', () => {
  it('runs the engulf normally when the higher cell id is the predator', () => {
    // The masses are swapped, so the pair's higher id hunts its lower one. Stepping past tick 1
    // matters: tick 1 is the start path, and only tick 2 on reaches `runningEngulfIn`'s second arm.
    const fixture = twoCells(ENGULF_PREY_MASS, ENGULF_PREDATOR_MASS);
    stepEngulf(fixture, E9_SEAL_TICK);
    expect(fixture.prey.engulfingCellId).toBe(fixture.predator.id);
    expect(fixture.predator.engulfedByCellId).toBe(fixture.prey.id);
    expect(fixture.predator.engulfProgress).toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE);
    expect(fixture.predator.carriedOffsetX).toBeCloseTo(-ENGULF_CENTRE_DISTANCE_WU, PROGRESS_TOLERANCE);
    stepEngulf(fixture, E9_PAYOUT_TICK - E9_SEAL_TICK);
    expect(fixture.prey.states).toEqual([]);
    expect(fixture.predator.states).toEqual([]);
  });

  it('gives coincident centres no struggle and still advances the progress', () => {
    const fixture = twoCells();
    fixture.prey.x = fixture.predator.x;
    fixture.prey.y = fixture.predator.y;
    fixture.prey.steerCommand = { directionX: 1, directionY: 0, throttle: 1 };
    expect(awayEffortOf(fixture.predator, fixture.prey)).toBe(0);
    stepEngulf(fixture);
    expect(fixture.prey.engulfProgress).toBeCloseTo(1 / E9_PAYOUT_TICK, PROGRESS_TOLERANCE);
  });

  it('skips a pair whose cell has left the world, so #259 cannot strand a predator on a ghost', () => {
    const fixture = twoCells();
    const pair = { lower: fixture.predator, higher: fixture.prey };
    expect(isPairInWorld(pair, fixture.world)).toBe(true);
    fixture.world.cells = [fixture.predator];
    expect(isPairInWorld(pair, fixture.world)).toBe(false);
  });
});

describe('the struggle reads the command the movement step used', () => {
  it('takes the stored command, not one re-derived from the post-movement centre', () => {
    const fixture = twoCells();
    const halfThrottle = { directionX: 1, directionY: 0, throttle: 0.5 };
    fixture.prey.steerCommand = halfThrottle;
    // A target on its own centre would re-derive throttle 0; the stored command is what counts.
    fixture.prey.targetX = fixture.prey.x;
    fixture.prey.targetY = fixture.prey.y;
    expect(awayEffortOf(fixture.predator, fixture.prey)).toBeCloseTo(halfThrottle.throttle, PROGRESS_TOLERANCE);
  });
});
