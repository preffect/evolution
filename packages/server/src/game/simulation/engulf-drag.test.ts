// The drag (docs/ecology/absorption.md §6.1 "the drag", #772) on the E9 pair from `testing/engulf-builders.ts` (A 100
// west of B 20, centres 10 wu apart): a predator moving off its prey draws it after itself by `ENGULF_DRAG_SHARE` of
// the gap its own move opened; the prey's own swimming is never answered. The whole tick is
// `engulf-drag.integration.test.ts`; the pass at speed as a design row is E19 (`ecology-engulf-drag.gameplay.test.ts`).

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_INTERVAL_S, distanceBetween } from '@evolution/shared';
import {
  E9_SEAL_TICK,
  ENGULF_CENTRE_DISTANCE_WU,
  ENGULF_SEAL_PROGRESS,
  createEngulfFixture,
  stepEngulf,
  type EngulfFixture,
} from '../../testing/engulf-builders.js';
import { createTestStepContext } from '../../testing/world-builders.js';
import { setBalanceForDebug } from '../debug/debug-operations.js';
import { dragPreyAlong, gapOpenedByPredator } from './engulf-drag.js';

/** A's speed in the rows below (wu/s): 3 wu a tick. */
const PREDATOR_SPEED = 3 / TICK_INTERVAL_S;
const STEP_WU = PREDATOR_SPEED * TICK_INTERVAL_S;
/** A balance path, named through a constant because a patch is keyed by constant names. */
const DRAG_LEAF = 'ENGULF_DRAG_SHARE';
const HALF_DRAG = 0.5;
const DISTANCE_DIGITS = 9;
/** Enough ticks for E9's engulf to have sealed, or for A at 3 wu a tick to have left its 31 wu reach and drained. */
const PAST_THE_SEAL_TICKS = 20;

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
