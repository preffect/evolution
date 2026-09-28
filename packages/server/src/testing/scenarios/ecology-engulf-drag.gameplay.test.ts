// docs/ecology/acceptance.md §8, the drag rows (#772): E19, a predator passing over a prey at full speed carries it and
// finishes the engulf, and E19b, a prey that sprints off sideways the moment it is covered still gets out. Each is run
// twice and hash-compared. The same pass without the drag drops the prey: `engulf-drag.integration.test.ts`.

import { describe, it } from 'vitest';
import { ENGULF_RELEASE_REASON, PLAYER_LIFE_STATE } from '@evolution/shared';
import { distanceBetweenCells, speedOf } from '../gameplay/evolution-views.js';
import { combineScripts, player, sprint, targetPoint, targetRadiiEast } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import {
  DISTANCE_TOLERANCE_WU,
  E16_START_MASS,
  absorptionsOfPredator,
  engulfPairOf,
  lifeStateOfPrey,
  preyCell,
  progressOfPrey,
  releaseReasons,
} from './engulf-setups.js';
import { FULL_THROTTLE_RADII, SPEED_TOLERANCE_WU_PER_SECOND } from './shared-setups.js';

/** B 80 wu east of A: A, steering 5 radii east of itself from rest, is near full speed when it reaches B. */
const E19_START_GAP_WU = 80;
/** A's membrane covers B's centre on tick 31, at 194.08 wu/s. */
const E19_START_TICK = 31;
const E19_SPEED_AT_START = 194.08;
/** From tick 35 A is past B's centre and moving off it; the drag keeps them 1.59 wu apart to the payout. */
const E19_HELD_FROM_TICK = 35;
const E19_HELD_DISTANCE_WU = 1.589;
/** Ratio 1.5 runs at 1/60 a tick (E16), so the engulf that starts on tick 31 pays out on tick 91. */
const E19_PAYOUT_TICK = 91;
/** E19b: B reacts on the first tick it can see the engulf, steers north and sprints; out of contact on tick 41. */
const E19B_REACT_TICK = 32;
const E19B_RELEASE_TICK = 44;
const E19B_END_TICK = 100;
/** Where B steers in E19b: straight north of its placed centre, far enough to be full throttle throughout. */
const FAR_NORTH_WU = 1000;
const NORTH_OF_B = { x: BROTH_POINT.x + E19_START_GAP_WU, y: BROTH_POINT.y - FAR_NORTH_WU };

/** "A (30) passes over B (20) at full throttle": A steers 5 of its radii east of itself every tick from tick 1. */
function passOverPrey(name: string) {
  return engulfPairOf(name, { mass: E16_START_MASS }, {}, E19_START_GAP_WU).from(
    1,
    player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)),
  );
}

describe('ecology/acceptance.md §8: the drag, a pass at speed (#772)', () => {
  it('E19: a predator passing over a still prey at full speed carries it and finishes the engulf', async () => {
    await passOverPrey('E19')
      .advance(E19_PAYOUT_TICK)
      .expect('no engulf before A covers B', progressOfPrey)
      .atTick(E19_START_TICK - 1)
      .toBe(0)
      .expect('the engulf starts on tick 31', progressOfPrey)
      .atTick(E19_START_TICK)
      .toBeGreaterThan(0)
      .expect('A is passing at full-throttle speed', (view) => speedOf(view, 0))
      .atTick(E19_START_TICK)
      .toBeCloseTo(E19_SPEED_AT_START, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('B dragged along 1.59 wu from A once A moves off it', (view) => distanceBetweenCells(view, 0, 1))
      .atTick(E19_HELD_FROM_TICK)
      .toBeCloseTo(E19_HELD_DISTANCE_WU, DISTANCE_TOLERANCE_WU)
      .expect('still 1.59 wu at the last tick before the payout', (view) => distanceBetweenCells(view, 0, 1))
      .atTick(E19_PAYOUT_TICK - 1)
      .toBeCloseTo(E19_HELD_DISTANCE_WU, DISTANCE_TOLERANCE_WU)
      .expect('never released', releaseReasons)
      .atTick(E19_PAYOUT_TICK - 1)
      .toEqual([])
      .expect('B absorbed on tick 91', preyCell)
      .atTick(E19_PAYOUT_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('A absorptions', absorptionsOfPredator)
      .atTick(E19_PAYOUT_TICK)
      .toBe(1)
      .runDeterministic();
  });

  it('E19b: a prey sprinting off sideways the tick after it is covered still escapes the dragging predator', async () => {
    await passOverPrey('E19b')
      .atTick(E19B_REACT_TICK, player(1).does(combineScripts([targetPoint(NORTH_OF_B.x, NORTH_OF_B.y), sprint()])))
      .from(E19B_REACT_TICK + 1, player(1).does(targetPoint(NORTH_OF_B.x, NORTH_OF_B.y)))
      .advance(E19B_END_TICK)
      .expect('released with reason escaped on tick 44', releaseReasons)
      .atTick(E19B_RELEASE_TICK)
      .toEqual([ENGULF_RELEASE_REASON.escaped])
      .expect('B alive at the end of the row', lifeStateOfPrey)
      .atEnd()
      .toBe(PLAYER_LIFE_STATE.alive)
      .expect('A absorptions = 0', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .runDeterministic();
  });
});
