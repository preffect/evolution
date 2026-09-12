// docs/ECOLOGY.md §8, the engulf rows where the prey gets away or is carried past its chance: E11b,
// E11 and E11's reaction window, each run twice and hash-compared. The rows a predator wins or holds
// are `ecology-engulf.gameplay.test.ts`; the shared setup is `engulf-setups.ts`.

import { describe, it } from 'vitest';
import { ENGULF_RELEASE_REASON } from '@evolution/shared';
import { distanceBetweenCells, speedOf } from '../gameplay/evolution-views.js';
import { combineScripts, player, sprint } from '../gameplay/index.js';
import {
  CENTRE_DISTANCE_WU,
  DISTANCE_TOLERANCE_WU,
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  E11_LATE_RELEASE_TICK,
  E11_LATE_SPRINT_TICK,
  E11_NO_SPRINT_RELEASE_TICK,
  E11_RELEASE_TICK,
  E11_SPRINT_TICK,
  E11_TOO_LATE_END_TICK,
  E11_TOO_LATE_SEAL_TICK,
  E11_TOO_LATE_SPRINT_TICK,
  PROGRESS_TOLERANCE,
  absorption,
  awayFromPredator,
  engulfPair,
  progressOfPrey,
  releaseReasons,
  statesOfPredator,
  statesOfPrey,
} from './engulf-setups.js';
import { SPEED_TOLERANCE_WU_PER_SECOND } from './shared-setups.js';

/** "B sprints away at tick t": steers away from t and presses sprint on t (docs/ECOLOGY.md §8). */
const sprintsAwayFrom = (tick: number) => (builder: ReturnType<typeof engulfPair>) =>
  builder
    .atTick(tick, player(1).does(combineScripts([awayFromPredator, sprint()])))
    .from(tick + 1, player(1).does(awayFromPredator));

describe('ECOLOGY §8: getting away from an engulf (#258; the payout is #259)', () => {
  it('E11: sprinting away from tick 10 breaks contact and the wrap decays until B is released', () => {
    const row = engulfPair('E11');
    sprintsAwayFrom(E11_SPRINT_TICK)(row)
      .advance(200)
      .expect('in the wrap band before the sprint', progressOfPrey)
      .atTick(E11_SPRINT_TICK - 1)
      .toBeCloseTo((E11_SPRINT_TICK - 1) / E9_PAYOUT_TICK, PROGRESS_TOLERANCE)
      .expect('released with reason escaped', releaseReasons)
      .atTick(E11_RELEASE_TICK)
      .toEqual([ENGULF_RELEASE_REASON.escaped])
      .expect('both free after the escape', (view) => [statesOfPredator(view), statesOfPrey(view)])
      .atTick(E11_RELEASE_TICK)
      .toEqual([[], []])
      .expect('still free at the end of the row', statesOfPrey)
      .atEnd()
      .toEqual([])
      .runDeterministic();
  });

  it('E11b: a prey sealed before it reacts is carried, its speed 0, and the engulf still ends on tick 36', () => {
    const row = engulfPair('E11b');
    sprintsAwayFrom(E9_SEAL_TICK + 1)(row)
      .advance(E9_PAYOUT_TICK)
      .expect('speed 0 from the tick after the seal', (view) => speedOf(view, 1))
      .atTick(E9_SEAL_TICK + 2)
      .toBeCloseTo(0, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('centres still 10 wu apart at tick 35', (view) => distanceBetweenCells(view, 0, 1))
      .atTick(E9_PAYOUT_TICK - 1)
      .toBeCloseTo(CENTRE_DISTANCE_WU, DISTANCE_TOLERANCE_WU)
      .expect('never released', releaseReasons)
      .atTick(E9_PAYOUT_TICK - 1)
      .toEqual([])
      .expect('the engulf ends on tick 36 exactly as E9', statesOfPrey)
      .atTick(E9_PAYOUT_TICK)
      .toEqual([])
      .runDeterministic();
  });

  it('E11 reaction window: sprinting at tick 13 still escapes, at tick 14 the seal closes first', () => {
    sprintsAwayFrom(E11_LATE_SPRINT_TICK)(engulfPair('E11 sprint at 13'))
      .advance(E11_TOO_LATE_END_TICK)
      .expect('released on tick 29', releaseReasons)
      .atTick(E11_LATE_RELEASE_TICK)
      .toEqual([ENGULF_RELEASE_REASON.escaped])
      .runDeterministic();

    sprintsAwayFrom(E11_TOO_LATE_SPRINT_TICK)(engulfPair('E11 sprint at 14'))
      .advance(E11_TOO_LATE_END_TICK)
      .expect('sealed on tick 23', progressOfPrey)
      .atTick(E11_TOO_LATE_SEAL_TICK)
      .toBeGreaterThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('not sealed on tick 22', progressOfPrey)
      .atTick(E11_TOO_LATE_SEAL_TICK - 1)
      .toBeLessThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('never released', releaseReasons)
      .atTick(E11_TOO_LATE_END_TICK - 1)
      .toEqual([])
      .expect('the engulf ends on tick 41', statesOfPrey)
      .atTick(E11_TOO_LATE_END_TICK)
      .toEqual([])
      .runDeterministic();

    engulfPair('E11 steering away from 10 without sprint')
      .from(E11_SPRINT_TICK, player(1).does(awayFromPredator))
      .advance(E11_TOO_LATE_END_TICK)
      .expect('released on tick 31', releaseReasons)
      .atTick(E11_NO_SPRINT_RELEASE_TICK)
      .toEqual([ENGULF_RELEASE_REASON.escaped])
      .runDeterministic();
  });
});
