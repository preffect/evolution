// The drag (docs/ecology/absorption.md §6.1 "the drag", #772) on the E9 pair from `testing/engulf-builders.ts` (A 100
// west of B 20, centres 10 wu apart): a predator moving off its prey draws it after itself by `ENGULF_DRAG_SHARE` of
// the gap its own move opened; the prey's own swimming is never answered. The whole tick is
// `engulf-drag.integration.test.ts`; the pass at speed as a design row is E19 (`ecology-engulf-drag.gameplay.test.ts`).

import { describe, expect, it } from 'vitest';
import {
  AMOEBA_ARM_GRAB_REACH_RADII,
  DEFAULT_BALANCE,
  ENGULF_RELEASE_REASON,
  TICK_INTERVAL_S,
  distanceBetween,
  foldModifiers,
  radiusForMass,
} from '@evolution/shared';
import {
  E9_SEAL_TICK,
  ENGULF_CENTRE_DISTANCE_WU,
  ENGULF_PREDATOR_MASS,
  ENGULF_SEAL_PROGRESS,
  createEngulfFixture,
  releaseReasonsOf,
  stepEngulf,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import { createTestStepContext } from '../../testing/world-builders.js';
import { setBalanceForDebug } from '../debug/debug-operations.js';
import { engulfContactGap } from './contact.js';
import { armPullPerTick } from './engulf-arm-grab.js';
import { dragPreyAlong, drawPreyTowardPredator, gapOpenedByPredator } from './engulf-drag.js';

/** A's speed in the rows below (wu/s): 3 wu a tick. */
const PREDATOR_SPEED = 3 / TICK_INTERVAL_S;
const STEP_WU = PREDATOR_SPEED * TICK_INTERVAL_S;
/** A balance path, named through a constant because a patch is keyed by constant names. */
const DRAG_LEAF = 'ENGULF_DRAG_SHARE';
const HALF_DRAG = 0.5;
const DISTANCE_DIGITS = 9;
/** Enough ticks for E9's engulf to have sealed, or for A at 3 wu a tick to have left its 31 wu reach and drained. */
const PAST_THE_SEAL_TICKS = 20;

const AMOEBA_I = [{ traitId: 'amoeba_pseudopods', tier: 1 }] as const;
/** Inside A's body reach by this much before A moves, so A's 3 wu move leaves B to the arm alone (wu). */
const INSIDE_THE_BODY_WU = 1;
/** Half way out A's arm past its body reach (wu): the arm-grab tests' layout. */
const HALF_WAY_OUT_THE_ARM_WU =
  0.5 * radiusForMass(ENGULF_PREDATOR_MASS, DEFAULT_BALANCE.growth) * AMOEBA_ARM_GRAB_REACH_RADII;
/** A at full speed, 220 wu/s: 3.67 wu a tick. */
const FULL_SPEED = DEFAULT_BALANCE.growth.CELL_BASE_SPEED;
/** Long enough for A's arm to draw B under the body and seal, or for B to drain out at full speed. */
const ARM_HOLD_TICKS = 60;

/** The E9 pair with A an amoeba (Amoeba Pseudopods I) and B `bodyReachOffsetWu` past A's body reach, on the line. */
function armPair(bodyReachOffsetWu: number): EngulfFixture {
  const fixture = createEngulfFixture();
  const { predator, prey } = fixture;
  predator.modifiers = foldModifiers(AMOEBA_I, DEFAULT_BALANCE.traits.TRAIT_TIERS);
  prey.x = predator.x + predator.radius - prey.radius * DEFAULT_BALANCE.absorption.ENGULF_COVERAGE_FRACTION;
  prey.x += bodyReachOffsetWu;
  return fixture;
}

/** A as the movement step leaves it after one tick at `velocity`: moved by it, the velocity kept on the record. */
function movePredator(fixture: EngulfFixture, velocityX: number, velocityY = 0): void {
  fixture.predator.velocityX = velocityX;
  fixture.predator.velocityY = velocityY;
  fixture.predator.x += velocityX * TICK_INTERVAL_S;
  fixture.predator.y += velocityY * TICK_INTERVAL_S;
}

function withDrag(fixture: EngulfFixture, share: number): EngulfFixture {
  setBalanceForDebug(fixture.world, { absorption: { [DRAG_LEAF]: share } });
  fixture.context = createTestStepContext(fixture.world);
  return fixture;
}

describe('the gap the predator opened (#772)', () => {
  it("is the predator's own move off the prey, along the centre line", () => {
    const fixture = createEngulfFixture();
    movePredator(fixture, -PREDATOR_SPEED);
    expect(gapOpenedByPredator(fixture)).toBeCloseTo(STEP_WU, DISTANCE_DIGITS);
  });

  it('is 0 for a predator that moved toward its prey or not at all', () => {
    for (const velocityX of [PREDATOR_SPEED, 0]) {
      const fixture = createEngulfFixture();
      movePredator(fixture, velocityX);
      expect(gapOpenedByPredator(fixture)).toBe(0);
    }
  });

  it('is only the distance a move across the prey added', () => {
    const fixture = createEngulfFixture();
    movePredator(fixture, 0, PREDATOR_SPEED);
    expect(gapOpenedByPredator(fixture)).toBeCloseTo(
      Math.hypot(ENGULF_CENTRE_DISTANCE_WU, STEP_WU) - ENGULF_CENTRE_DISTANCE_WU,
      DISTANCE_DIGITS,
    );
  });

  it("never counts the prey's own swimming, toward or away", () => {
    const fixture = createEngulfFixture();
    fixture.prey.x += STEP_WU;
    fixture.prey.velocityX = PREDATOR_SPEED;
    expect(gapOpenedByPredator(fixture)).toBe(0);
  });
});

describe('dragging the prey along (#772)', () => {
  it('closes the whole gap at the default share, drawing the prey along the centre line', () => {
    const fixture = createEngulfFixture();
    expect(DEFAULT_BALANCE.absorption.ENGULF_DRAG_SHARE).toBe(1);
    movePredator(fixture, -PREDATOR_SPEED);
    dragPreyAlong(fixture, fixture.world.balance);
    expect(distanceBetween(fixture.predator, fixture.prey)).toBeCloseTo(ENGULF_CENTRE_DISTANCE_WU, DISTANCE_DIGITS);
    expect(fixture.prey.y).toBe(fixture.predator.y);
  });

  it('closes that share of it when debug_set_balance patches the share, and none of it at 0', () => {
    const half = withDrag(createEngulfFixture(), HALF_DRAG);
    movePredator(half, -PREDATOR_SPEED);
    dragPreyAlong(half, half.world.balance);
    expect(distanceBetween(half.predator, half.prey)).toBeCloseTo(
      ENGULF_CENTRE_DISTANCE_WU + (1 - HALF_DRAG) * STEP_WU,
      DISTANCE_DIGITS,
    );
    const none = withDrag(createEngulfFixture(), 0);
    movePredator(none, -PREDATOR_SPEED);
    const before = { x: none.prey.x, y: none.prey.y };
    dragPreyAlong(none, none.world.balance);
    expect({ x: none.prey.x, y: none.prey.y }).toEqual(before);
  });

  it('leaves a prey swimming away from a still predator where its own move took it', () => {
    const fixture = createEngulfFixture();
    fixture.prey.x += STEP_WU;
    const before = { x: fixture.prey.x, y: fixture.prey.y };
    dragPreyAlong(fixture, fixture.world.balance);
    expect({ x: fixture.prey.x, y: fixture.prey.y }).toEqual(before);
  });
});

describe('the drag in the engulf step (#772)', () => {
  it('keeps a still prey under a predator moving off it, so the engulf seals instead of draining', () => {
    const fixture = createEngulfFixture();
    for (let tick = 0; tick < E9_SEAL_TICK; tick += 1) {
      movePredator(fixture, -PREDATOR_SPEED);
      stepEngulf(fixture);
    }
    expect(distanceBetween(fixture.predator, fixture.prey)).toBeCloseTo(ENGULF_CENTRE_DISTANCE_WU, DISTANCE_DIGITS);
    expect(fixture.prey.engulfProgress).toBeGreaterThan(ENGULF_SEAL_PROGRESS);
    expect(fixture.prey.carriedOffsetX).not.toBeNull();
  });

  it('without the drag the same predator coasts off the prey and the engulf drains', () => {
    const fixture = withDrag(createEngulfFixture(), 0);
    for (let tick = 0; tick < PAST_THE_SEAL_TICKS; tick += 1) {
      movePredator(fixture, -PREDATOR_SPEED);
      stepEngulf(fixture);
    }
    expect(fixture.prey.engulfedByCellId).toBeNull();
  });

  it('leaves a sealed prey to the carry: the engulf step never moves it', () => {
    const fixture = createEngulfFixture();
    stepEngulf(fixture, PAST_THE_SEAL_TICKS);
    expect(fixture.prey.carriedOffsetX).not.toBeNull();
    movePredator(fixture, -PREDATOR_SPEED);
    const before = { x: fixture.prey.x, y: fixture.prey.y };
    stepEngulf(fixture);
    expect({ x: fixture.prey.x, y: fixture.prey.y }).toEqual(before);
  });
});

describe('drawing the prey in (#772)', () => {
  it('leaves a prey on the predator centre where it is', () => {
    const fixture = createEngulfFixture();
    fixture.prey.x = fixture.predator.x;
    drawPreyTowardPredator(fixture, STEP_WU, fixture.world.balance);
    expect({ x: fixture.prey.x, y: fixture.prey.y }).toEqual({ x: fixture.predator.x, y: fixture.predator.y });
  });
});

describe('the drag and the arm (#772, #735)', () => {
  it('drags before the arm pulls: a prey the drag puts back under the body is not pulled as well', () => {
    const fixture = armPair(-INSIDE_THE_BODY_WU);
    stepEngulf(fixture);
    const before = distanceBetween(fixture.predator, fixture.prey);
    movePredator(fixture, -PREDATOR_SPEED);
    expect(engulfContactGap(fixture.predator, fixture.prey, fixture.world.balance)).toBeGreaterThan(0);
    const pull = armPullPerTick(fixture, fixture.world, fixture.world.balance);
    stepEngulf(fixture);
    // Arm first would pull B `pull` wu in from out of body contact, and the drag would then close the gap on top.
    expect(pull).toBeGreaterThan(0);
    expect(distanceBetween(fixture.predator, fixture.prey)).toBeCloseTo(before, DISTANCE_DIGITS);
  });

  it('tows a still prey the arm alone holds behind an amoeba swimming off at full speed, which then seals', () => {
    const fixture = armPair(HALF_WAY_OUT_THE_ARM_WU);
    for (let tick = 0; tick < ARM_HOLD_TICKS && fixture.prey.carriedOffsetX === null; tick += 1) {
      movePredator(fixture, -FULL_SPEED);
      stepEngulf(fixture);
    }
    expect(fixture.prey.carriedOffsetX).not.toBeNull();
    expect(releaseReasonsOf(fixture.context.effects)).toEqual([]);
  });

  it('without the drag the same amoeba swims out of its arm hold and the prey drains out', () => {
    const fixture = withDrag(armPair(HALF_WAY_OUT_THE_ARM_WU), 0);
    for (let tick = 0; tick < ARM_HOLD_TICKS; tick += 1) {
      movePredator(fixture, -FULL_SPEED);
      stepEngulf(fixture);
    }
    expect(releaseReasonsOf(fixture.context.effects)).toEqual([ENGULF_RELEASE_REASON.escaped]);
  });
});

describe('the held displacement the wire reports (#774)', () => {
  it("records the drag's move on the prey, never on its velocity", () => {
    const fixture = createEngulfFixture();
    movePredator(fixture, -PREDATOR_SPEED);
    stepEngulf(fixture);
    expect(fixture.prey.heldDisplacementX).toBeCloseTo(-STEP_WU, DISTANCE_DIGITS);
    expect(fixture.prey.heldDisplacementY).toBe(0);
    expect({ x: fixture.prey.velocityX, y: fixture.prey.velocityY }).toEqual({ x: 0, y: 0 });
  });

  it('adds every draw of one tick, as the drag and the arm pull both draw', () => {
    const fixture = createEngulfFixture();
    const start = fixture.prey.x;
    drawPreyTowardPredator(fixture, STEP_WU, fixture.world.balance);
    drawPreyTowardPredator(fixture, STEP_WU, fixture.world.balance);
    expect(fixture.prey.heldDisplacementX).toBeCloseTo(fixture.prey.x - start, DISTANCE_DIGITS);
    expect(fixture.prey.heldDisplacementX).toBeCloseTo(-2 * STEP_WU, DISTANCE_DIGITS);
  });

  it('starts over each engulf step: a tick without a drag reports none', () => {
    const fixture = createEngulfFixture();
    movePredator(fixture, -PREDATOR_SPEED);
    stepEngulf(fixture);
    movePredator(fixture, 0);
    stepEngulf(fixture);
    expect({ x: fixture.prey.heldDisplacementX, y: fixture.prey.heldDisplacementY }).toEqual({ x: 0, y: 0 });
  });
});
