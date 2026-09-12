// docs/ECOLOGY.md §8, the engulf rows of the placed table (E9, E10's engulfing half, E11, E13,
// E16, E16b), each run twice and hash-compared. #258 ships the lifecycle only, so every row here
// asserts the phases, the seal, the escape and the releases; the mass, DNA, death and leaderboard
// halves of E9, E10 and E11 belong to the payout ticket #259 and are not asserted yet.

import { describe, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  EFFECT_KIND,
  ENGULF_RELEASE_REASON,
  ROUND_PHASE,
  TICK_HZ,
} from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { cellOf, distanceBetweenCells, effectsOfKind, type EvolutionView } from '../gameplay/evolution-views.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { ZONE, combineScripts, player, sprint, targetRadiiAwayFrom } from '../gameplay/index.js';
import { FULL_THROTTLE_RADII } from './shared-setups.js';

const absorption = DEFAULT_BALANCE.absorption;
const PREDATOR_MASS = 100;
const PREY_MASS = 20;
const CENTRE_DISTANCE_WU = 10;
/** E9: ratio 5 clamps `massFactor` to 0.5, so progress runs at 1/36 a tick. */
const E9_COVER_END_TICK = 6;
const E9_SEAL_TICK = 18;
const E9_PAYOUT_TICK = 36;
const PROGRESS_TOLERANCE = 0.0001;
const OFFSET_TOLERANCE_WU = 0.01;
/** E16: 30 starts the engulf, 23 holds it (over the release ratio), 21.5 drops under it. */
const E16_START_MASS = 30;
const E16_HELD_MASS = 23;
const E16_RELEASED_MASS = 21.5;
/**
 * E10's "< 0.01 wu of overlap" is unreachable through the whole step: an idle placed cell steers
 * back to its latched target, which balances the separation at a few wu of overlap (#261). The
 * row's engulf half is what this file owns, so it asserts the pair moved well apart instead.
 */
const SEPARATED_FACTOR = 3;
/** E13 runs on the shortest legal round so the results tick is reachable in a test. */
const SHORT_ROUND_SECONDS = 60;
const SHORT_ROUND_TICKS = SHORT_ROUND_SECONDS * TICK_HZ;

/** "A at mass 100, B at 20, centres 10 wu apart": the setup E9, E11, E13 and E16 share. */
function engulfPair(name: string, predatorMass = PREDATOR_MASS, preyMass = PREY_MASS) {
  return scenario(name)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: predatorMass })
    .placeCell({ playerIndex: 1, mass: preyMass, eastOfFirstCellWu: CENTRE_DISTANCE_WU });
}

const progressOfPrey = (view: EvolutionView): number | undefined => cellOf(view, 1)?.engulfProgress;
const statesOfPrey = (view: EvolutionView): string[] | undefined => cellOf(view, 1)?.states;
const statesOfPredator = (view: EvolutionView): string[] | undefined => cellOf(view, 0)?.states;
const releaseReasons = (view: EvolutionView): string[] =>
  effectsOfKind(view, EFFECT_KIND.cellReleased).map((effect) => effect.reason);

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
      .expect('engulf over on tick 36', (view) => statesOfPrey(view))
      .atTick(E9_PAYOUT_TICK)
      .toEqual([])
      .expect('no release on completion: the payout is #259', releaseReasons)
      .atTick(E9_PAYOUT_TICK)
      .toEqual([])
      .runDeterministic();
  });

  it('E10: 24 against 20 never starts, 26 against 20 seals on tick 35', () => {
    engulfPair('E10 under the ratio', 24)
      .advance(120)
      .expect('never engulfed', (view) => statesOfPrey(view))
      .atEnd()
      .toEqual([])
      .expect('separation pushed the pair apart', (view) => distanceBetweenCells(view, 0, 1))
      .atEnd()
      .toBeGreaterThan(CENTRE_DISTANCE_WU * SEPARATED_FACTOR)
      .runDeterministic();

    engulfPair('E10 over the ratio', 26)
      .advance(36)
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
      .runDeterministic();
  });

  it('E11: sprinting away from tick 10 breaks contact and the wrap decays until B is released', () => {
    engulfPair('E11')
      .atTick(10, player(1).does(combineScripts([targetRadiiAwayFrom(FULL_THROTTLE_RADII, BROTH_POINT), sprint()])))
      .from(11, player(1).does(targetRadiiAwayFrom(FULL_THROTTLE_RADII, BROTH_POINT)))
      .advance(200)
      .expect('in the wrap band before the sprint', progressOfPrey)
      .atTick(9)
      .toBeCloseTo(9 / E9_PAYOUT_TICK, PROGRESS_TOLERANCE)
      .expect('released with reason escaped', releaseReasons)
      .atTick(25)
      .toEqual([ENGULF_RELEASE_REASON.escaped])
      .expect('both free after the escape', (view) => [statesOfPredator(view), statesOfPrey(view)])
      .atTick(25)
      .toEqual([[], []])
      .expect('still free at the end of the row', (view) => statesOfPrey(view))
      .atEnd()
      .toEqual([])
      .runDeterministic();
  });

  it('E13: the results phase aborts an engulf in progress, with no payout', () => {
    engulfPair('E13')
      .config({ roundDurationSeconds: SHORT_ROUND_SECONDS })
      .advance(SHORT_ROUND_TICKS)
      .expect('playing one tick before the end', (view) => view.snapshot.roundPhase)
      .atTick(SHORT_ROUND_TICKS - 1)
      .toBe(ROUND_PHASE.playing)
      .expect('an engulf was running', (view) => statesOfPrey(view))
      .atTick(SHORT_ROUND_TICKS - 1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('results', (view) => view.snapshot.roundPhase)
      .atEnd()
      .toBe(ROUND_PHASE.results)
      .expect('aborted', releaseReasons)
      .atEnd()
      .toEqual([ENGULF_RELEASE_REASON.aborted])
      .expect('both free', (view) => [statesOfPredator(view), statesOfPrey(view)])
      .atEnd()
      .toEqual([[], []])
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
      .runDeterministic();
  });
});
