// docs/ECOLOGY.md §8, the engulf rows a predator wins or holds: E9, E9b, E10's engulfing half, E13,
// E16 and E16b, each run twice and hash-compared, payout halves included (#259). The rows where the
// prey gets away — E11, E11b and E11's reaction window — are `ecology-engulf-escape.gameplay.test.ts`.
// The shared setup, and the row halves both files deliberately leave out, are `engulf-setups.ts`.

import { describe, it } from 'vitest';
import { CELL_STATE, ENGULF_RELEASE_REASON, PLAYER_LIFE_STATE, ROUND_PHASE } from '@evolution/shared';
import { cellOf, distanceBetweenCells, speedOf } from '../gameplay/evolution-views.js';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { ZONE, eastOfCellOf, player } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import {
  APPROXIMATE_DISTANCE_TOLERANCE_WU,
  CENTRE_DISTANCE_WU,
  E9_PAYOUT_DNA,
  E9_PAYOUT_MASS,
  E10_PAYOUT_MASS,
  E10_PAYOUT_TICK,
  DISTANCE_TOLERANCE_WU,
  E9B_SEAL_DISTANCE_WU,
  E9B_SEAL_WESTING_WU,
  E9B_SPEED_TICK_1,
  E9B_SPEED_TICK_18,
  E9B_SPEED_TICK_19,
  E9B_SPEED_TICK_35,
  E9_COVER_END_TICK,
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  E10_OVER_RATIO_MASS,
  E10_UNDER_RATIO_MASS,
  E16_HELD_MASS,
  E16_RELEASED_MASS,
  E16_START_MASS,
  E13_APART_WU,
  OFFSET_TOLERANCE_WU,
  PREDATOR_MASS,
  PREY_MASS,
  PROGRESS_TOLERANCE,
  SEPARATED_FACTOR,
  SHORT_ROUND_SECONDS,
  SHORT_ROUND_TICKS,
  absorption,
  absorptionsOfPredator,
  awayFromPrey,
  detritusInDish,
  dnaOfPredator,
  engulfPair,
  lifeStateOfPrey,
  massOfPredator,
  preyCell,
  progressOfPrey,
  releaseReasons,
  statesOfPredator,
  statesOfPrey,
} from './engulf-setups.js';
import { MASS_TOLERANCE, SPEED_TOLERANCE_WU_PER_SECOND, expectedDetritusMass } from './shared-setups.js';

describe('ECOLOGY §8: the engulf lifecycle on placed cells (#258; the payout is #259)', () => {
  it('E9: cover to tick 6, wrap to the seal on tick 18, absorb to the end of the engulf on tick 36', () => {
    engulfPair('E9')
      .advance(E9_PAYOUT_TICK)
      .expect('claimed on tick 1', (view) => statesOfPrey(view))
      .atTick(1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('predator engulfing on tick 1', (view) => statesOfPredator(view))
      .atTick(1)
      .toEqual([CELL_STATE.engulfing])
      .expect('progress after one tick', progressOfPrey)
      .atTick(1)
      .toBeCloseTo(1 / E9_PAYOUT_TICK, PROGRESS_TOLERANCE)
      .expect('cover ends at the wrap band', progressOfPrey)
      .atTick(E9_COVER_END_TICK)
      .toBeCloseTo(absorption.ENGULF_WRAP_START_PROGRESS, PROGRESS_TOLERANCE)
      .expect('sealed on tick 18', progressOfPrey)
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE)
      .expect('carried 10 wu east from the seal on', (view) => distanceBetweenCells(view, 0, 1))
      .atTick(E9_SEAL_TICK + 1)
      .toBeCloseTo(CENTRE_DISTANCE_WU, OFFSET_TOLERANCE_WU)
      .expect('the predator is free again on tick 36', statesOfPredator)
      .atTick(E9_PAYOUT_TICK)
      .toEqual([])
      .expect('no release on a payout', releaseReasons)
      .atTick(E9_PAYOUT_TICK)
      .toEqual([])
      .expect("B's cell is gone", preyCell)
      .atTick(E9_PAYOUT_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('B spectating', lifeStateOfPrey)
      .atTick(E9_PAYOUT_TICK)
      .toBe(PLAYER_LIFE_STATE.spectating)
      .expect('A mass = decayed(100, 36) + 0.8 × 20', massOfPredator)
      .atTick(E9_PAYOUT_TICK)
      .toBeCloseTo(E9_PAYOUT_MASS, MASS_TOLERANCE)
      .expect('A DNA = ENGULF_DNA_BASE (B had none)', dnaOfPredator)
      .atTick(E9_PAYOUT_TICK)
      .toBe(E9_PAYOUT_DNA)
      .expect('A absorptions', absorptionsOfPredator)
      .atTick(E9_PAYOUT_TICK)
      .toBe(1)
      .expect('detritus: two motes of 2', detritusInDish)
      .atTick(E9_PAYOUT_TICK)
      .toBe(expectedDetritusMass(PREY_MASS))
      .runDeterministic();
  });

  it('E10: 24 against 20 never starts, 26 against 20 seals on tick 35', () => {
    engulfPair('E10 under the ratio', E10_UNDER_RATIO_MASS)
      .advance(120)
      .expect('never engulfed', (view) => statesOfPrey(view))
      .atEnd()
      .toEqual([])
      .expect('separation pushed the pair apart', (view) => distanceBetweenCells(view, 0, 1))
      .atEnd()
      .toBeGreaterThan(CENTRE_DISTANCE_WU * SEPARATED_FACTOR)
      .runDeterministic();

    engulfPair('E10 over the ratio', E10_OVER_RATIO_MASS)
      .advance(E10_PAYOUT_TICK)
      .expect('cover ends on tick 12', progressOfPrey)
      .atTick(12)
      .toBeGreaterThan(absorption.ENGULF_WRAP_START_PROGRESS)
      .expect('still under the wrap band on tick 11', progressOfPrey)
      .atTick(11)
      .toBeLessThan(absorption.ENGULF_WRAP_START_PROGRESS)
      .expect('sealed on tick 35', progressOfPrey)
      .atTick(35)
      .toBeGreaterThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('not sealed on tick 34', progressOfPrey)
      .atTick(34)
      .toBeLessThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('still being engulfed on tick 69', statesOfPrey)
      .atTick(E10_PAYOUT_TICK - 1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('B absorbed on tick 70', preyCell)
      .atTick(E10_PAYOUT_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('A mass ≈ 41.99 after the payout', massOfPredator)
      .atTick(E10_PAYOUT_TICK)
      .toBeCloseTo(E10_PAYOUT_MASS, MASS_TOLERANCE)
      .runDeterministic();
  });

  it('E9b: a predator steering away drags its cover, and the speed cap changes at the seal', () => {
    engulfPair('E9b')
      .from(1, player(0).does(awayFromPrey))
      .advance(E9_PAYOUT_TICK)
      .expect('cover ends at the wrap band on tick 6', progressOfPrey)
      .atTick(E9_COVER_END_TICK)
      .toBeCloseTo(absorption.ENGULF_WRAP_START_PROGRESS, PROGRESS_TOLERANCE)
      .expect('sealed on tick 18 although the centres have drifted', progressOfPrey)
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE)
      .expect('centres 22.53 wu apart at the seal, inside the predator reach', (view) =>
        distanceBetweenCells(view, 0, 1),
      )
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(E9B_SEAL_DISTANCE_WU, DISTANCE_TOLERANCE_WU)
      .expect('predator 12.5 wu west of its start on tick 18', (view) => (cellOf(view, 0)?.x ?? 0) - BROTH_POINT.x)
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(-E9B_SEAL_WESTING_WU, APPROXIMATE_DISTANCE_TOLERANCE_WU)
      .expect('speed 9.8 wu/s on tick 1, before any engulf cap', (view) => speedOf(view, 0))
      .atTick(1)
      .toBeCloseTo(E9B_SPEED_TICK_1, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('speed 64.0 wu/s on tick 18, still capped at 0.6', (view) => speedOf(view, 0))
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(E9B_SPEED_TICK_18, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('speed 69.5 wu/s on tick 19, the first sealed tick', (view) => speedOf(view, 0))
      .atTick(E9_SEAL_TICK + 1)
      .toBeCloseTo(E9B_SPEED_TICK_19, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('speed 121.4 wu/s on tick 35, uncapped', (view) => speedOf(view, 0))
      .atTick(E9_PAYOUT_TICK - 1)
      .toBeCloseTo(E9B_SPEED_TICK_35, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('the carried offset held to the end of the engulf', (view) => distanceBetweenCells(view, 0, 1))
      .atTick(E9_PAYOUT_TICK - 1)
      .toBeCloseTo(E9B_SEAL_DISTANCE_WU, DISTANCE_TOLERANCE_WU)
      .expect("the payout is E9's: A mass ≈ 115.90", massOfPredator)
      .atTick(E9_PAYOUT_TICK)
      .toBeCloseTo(E9_PAYOUT_MASS, MASS_TOLERANCE)
      .expect("A's DNA is E9's", dnaOfPredator)
      .atTick(E9_PAYOUT_TICK)
      .toBe(E9_PAYOUT_DNA)
      .runDeterministic();
  });

  it('E13: the results phase aborts an engulf in progress, with no payout', () => {
    // The row places "A engulfing B at progress 0.5": the pair is apart all round and only meets
    // `E9_SEAL_TICK` ticks before the results tick, so the seal lands the tick before it (#259: a
    // pair left in contact from tick 1 would have paid out and respawned long before the round ends).
    scenario('E13')
      .seed(PLACED_ROW_SEED)
      .players(2)
      .config({ roundDurationSeconds: SHORT_ROUND_SECONDS })
      .placeCell({ playerIndex: 0, mass: PREDATOR_MASS })
      .placeCell({ playerIndex: 1, mass: PREY_MASS, eastOfFirstCellWu: E13_APART_WU })
      .atTick(SHORT_ROUND_TICKS - E9_SEAL_TICK)
      .placeCell({ playerIndex: 1, mass: PREY_MASS, at: eastOfCellOf(0, CENTRE_DISTANCE_WU) })
      .advance(SHORT_ROUND_TICKS)
      .expect('playing one tick before the end', (view) => view.snapshot.roundPhase)
      .atTick(SHORT_ROUND_TICKS - 1)
      .toBe(ROUND_PHASE.playing)
      .expect('an engulf was running, sealed', (view) => statesOfPrey(view))
      .atTick(SHORT_ROUND_TICKS - 1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('at progress 0.5 the tick before the end', progressOfPrey)
      .atTick(SHORT_ROUND_TICKS - 1)
      .toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE)
      .expect('results', (view) => view.snapshot.roundPhase)
      .atEnd()
      .toBe(ROUND_PHASE.results)
      .expect('aborted', releaseReasons)
      .atEnd()
      .toEqual([ENGULF_RELEASE_REASON.aborted])
      .expect('both free', (view) => [statesOfPredator(view), statesOfPrey(view)])
      .atEnd()
      .toEqual([[], []])
      .expect('A absorptions = 0: an aborted engulf pays nothing', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .runDeterministic();
  });

  it('E16: the engulf holds between the release and the required ratio, then releases on the ratio', () => {
    engulfPair('E16', E16_START_MASS)
      .atTick(10)
      .placeCell({ playerIndex: 0, mass: E16_HELD_MASS, at: ZONE.broth })
      .atTick(20)
      .placeCell({ playerIndex: 0, mass: E16_RELEASED_MASS, at: ZONE.broth })
      .advance(20)
      .expect('holding on tick 19 although 23 < 25', (view) => statesOfPrey(view))
      .atTick(19)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('released on tick 20 with reason ratio', releaseReasons)
      .atTick(20)
      .toEqual([ENGULF_RELEASE_REASON.ratio])
      .expect('progress reset', progressOfPrey)
      .atTick(20)
      .toBe(0)
      .expect('both free', (view) => [statesOfPredator(view), statesOfPrey(view)])
      .atTick(20)
      .toEqual([[], []])
      .expect('A absorptions = 0: a ratio release pays nothing', absorptionsOfPredator)
      .atTick(20)
      .toBe(0)
      .runDeterministic();
  });

  it('E16b: a sealed prey released on the ratio reappears at its carried offset', () => {
    engulfPair('E16b', E16_START_MASS)
      .atTick(10)
      .placeCell({ playerIndex: 0, mass: E16_HELD_MASS, at: ZONE.broth })
      .atTick(40)
      .placeCell({ playerIndex: 0, mass: E16_RELEASED_MASS, at: ZONE.broth })
      .advance(41)
      .expect('sealed before the drop', progressOfPrey)
      .atTick(39)
      .toBeGreaterThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('released on tick 40 with reason ratio', releaseReasons)
      .atTick(40)
      .toEqual([ENGULF_RELEASE_REASON.ratio])
      .expect('ejected at the carried offset, still overlapping', (view) => distanceBetweenCells(view, 0, 1))
      .atTick(40)
      .toBeCloseTo(CENTRE_DISTANCE_WU, OFFSET_TOLERANCE_WU)
      .expect('separation pushes the pair apart from tick 41', (view) => distanceBetweenCells(view, 0, 1))
      .atEnd()
      .toBeGreaterThan(CENTRE_DISTANCE_WU)
      .expect('A absorptions = 0: no payout from the absorb phase either', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .runDeterministic();
  });
});
