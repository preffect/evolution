// docs/traits/constants-and-acceptance.md §6, T23: the amoeba's arm grab (docs/ecology/absorption.md §6.1, #735). An
// Amoeba Pseudopods predator starts an engulf on a prey its arm reaches but its body does not, draws it in at
// `ENGULF_ARM_PULL_RADII_PER_SECOND`, holds the progress at the lip of the seal until the body covers the prey, then
// absorbs it. The same placement with a plain predator, and the amoeba one wu past its arm's reach, never start.

import { describe, it } from 'vitest';
import { ENGULF_SEAL_PROGRESS } from '@evolution/shared';
import { distanceBetweenCells, type EvolutionView } from '../gameplay/evolution-views.js';
import {
  PROGRESS_TOLERANCE,
  absorption,
  absorptionsOfPredator,
  engulfPairOf,
  preyCell,
  progressOfPrey,
  releaseReasons,
  type EngulfSide,
} from './engulf-setups.js';

const ROW_TICKS = 120;
const AMOEBA_I: EngulfSide = { traits: ['amoeba_pseudopods'] };
/**
 * E9's pair 55 wu apart: past the body's engulf contact (40 − 20^½ × 4 × 0.5 = 31.06 wu) and inside the arm's
 * (31.06 + 0.6175 × 40 = 55.76 wu); 56 wu is past both.
 */
const ARM_REACH_PLACEMENT_WU = 55;
const PAST_ARM_REACH_PLACEMENT_WU = 56;
/** The arm draws B in 1.5 × 40 / 60 = 1 wu a tick (a hair less as A decays). */
const PULLED_DISTANCE_AT_TICK_10_WU = 45;
const DISTANCE_TOLERANCE_WU = 0.05;
/** Amoeba I wraps at 1/(36 × 0.85) a tick: 1/6 + 10 of those on tick 16, and the next would pass the seal. */
const LIP_PROGRESS = 1 / 6 + 10 / (36 * 0.85);
const LIP_FIRST_TICK = 16;
const LIP_LAST_TICK = 23;
/** B reaches body contact on tick 24, which seals it; the absorb runs 18 more ticks at 1/36 from 0.526. */
const SEAL_TICK = 24;
const PAYOUT_TICK = 44;

const distanceOfPair = (view: EvolutionView): number | undefined => distanceBetweenCells(view, 0, 1);

describe('traits/constants-and-acceptance.md §6: the amoeba arm grab (#735)', () => {
  it('T23 (a): Amoeba I starts on a prey only its arm reaches, draws it in, seals on body contact and absorbs it', async () => {
    await engulfPairOf('T23 (a) arm grab', AMOEBA_I, {}, ARM_REACH_PLACEMENT_WU)
      .advance(PAYOUT_TICK)
      .expect('engulf started on tick 1', progressOfPrey)
      .atTick(1)
      .toBeGreaterThan(0)
      .expect('drawn in 1 wu a tick', distanceOfPair)
      .atTick(10)
      .toBeCloseTo(PULLED_DISTANCE_AT_TICK_10_WU, DISTANCE_TOLERANCE_WU)
      .expect('held at the lip while only the arm holds it', progressOfPrey)
      .atTick(LIP_FIRST_TICK)
      .toBeCloseTo(LIP_PROGRESS, PROGRESS_TOLERANCE)
      .expect('still at the lip the tick before body contact', progressOfPrey)
      .atTick(LIP_LAST_TICK)
      .toBeCloseTo(LIP_PROGRESS, PROGRESS_TOLERANCE)
      .expect(`sealed on tick ${SEAL_TICK}`, progressOfPrey)
      .atTick(SEAL_TICK)
      .toBeGreaterThan(ENGULF_SEAL_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON)
      .expect('never released', releaseReasons)
      .atTick(PAYOUT_TICK - 1)
      .toEqual([])
      .expect(`absorbed on tick ${PAYOUT_TICK}`, preyCell)
      .atTick(PAYOUT_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('A absorptions = 1', absorptionsOfPredator)
      .atTick(PAYOUT_TICK)
      .toBe(1)
      .runDeterministic();
  });

  it('T23 (b): a plain predator at the same placement never starts, and the amoeba never starts past its arm', async () => {
    for (const [name, predator, placement] of [
      ['T23 (b) plain predator', {}, ARM_REACH_PLACEMENT_WU],
      ['T23 (b) Amoeba I past the arm', AMOEBA_I, PAST_ARM_REACH_PLACEMENT_WU],
    ] as const) {
      await engulfPairOf(name, predator, {}, placement)
        .advance(ROW_TICKS)
        .expect('never engulfed', progressOfPrey)
        .atEnd()
        .toBe(0)
        .expect('where it was placed', distanceOfPair)
        .atEnd()
        .toBeCloseTo(placement, DISTANCE_TOLERANCE_WU)
        .expect('A absorptions = 0', absorptionsOfPredator)
        .atEnd()
        .toBe(0)
        .runDeterministic();
    }
  });
});
