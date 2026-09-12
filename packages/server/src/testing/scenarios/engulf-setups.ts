// The setup the two engulf scenario files share (docs/ECOLOGY.md §8): "A at mass 100, B at 20,
// centres 10 wu apart", the numbers those rows name, and the selectors they read through. Not a test
// file; `ecology-engulf.gameplay.test.ts` and `ecology-engulf-escape.gameplay.test.ts` import it.
//
// #258 shipped the lifecycle and #259 the payout, so the mass, DNA, tag, `absorptions`, detritus
// and `lifeState` halves of E9, E9b, E10 and E11 are on. What the rows still leave out, and to
// which ticket:
//   · E10's separation half ("< 0.01 wu of overlap"), which the whole step cannot reach — #261.
//   · every spit-out and refractory row (§6.1 spit-out, §5.3's T4 separation, §6.3 "spat out, still
//     overlapping"), because no build-1 tier table sets `spitOutChancePerSecond` until #260. The
//     mechanism is pinned at unit level on a folded modifier instead (`engulf-spit-out.test.ts`).
//   · the wild rows (W4, W5, W10), which need the wild-cell slice to place a wild cell.

import { DEFAULT_BALANCE, EFFECT_KIND, TICK_HZ } from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { cellOf, detritusMass, effectsOfKind, progressOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { targetRadiiAwayFrom } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { FULL_THROTTLE_RADII, decayed } from './shared-setups.js';

export const absorption = DEFAULT_BALANCE.absorption;
export const PREDATOR_MASS = 100;
export const PREY_MASS = 20;
export const CENTRE_DISTANCE_WU = 10;
/** E10's two predators: 24 never starts, 26 starts and seals on tick 35. */
export const E10_UNDER_RATIO_MASS = 24;
export const E10_OVER_RATIO_MASS = 26;
/** E9: ratio 5 clamps `massFactor` to 0.5, so progress runs at 1/36 a tick. */
export const E9_COVER_END_TICK = 6;
export const E9_SEAL_TICK = 18;
export const E9_PAYOUT_TICK = 36;
export const PROGRESS_TOLERANCE = 0.0001;
/** E9's payout: the yield on the decayed predator, the flat DNA base and the prey's detritus. */
export const E9_PAYOUT_MASS = decayed(PREDATOR_MASS, E9_PAYOUT_TICK) + PREY_MASS * absorption.ENGULF_MASS_YIELD;
export const E9_PAYOUT_DNA = absorption.ENGULF_DNA_BASE;
/** E10's over-ratio pair pays out on tick 70 at ≈ 41.99 mass. */
export const E10_PAYOUT_TICK = 70;
export const E10_PAYOUT_MASS = decayed(E10_OVER_RATIO_MASS, E10_PAYOUT_TICK) + PREY_MASS * absorption.ENGULF_MASS_YIELD;
export const OFFSET_TOLERANCE_WU = 0.01;
/** E16: 30 starts the engulf, 23 holds it (over the release ratio), 21.5 drops under it. */
export const E16_START_MASS = 30;
export const E16_HELD_MASS = 23;
export const E16_RELEASED_MASS = 21.5;
/**
 * E10's "< 0.01 wu of overlap" is unreachable through the whole step: an idle placed cell steers
 * back to its latched target, which balances the separation at a few wu of overlap (#261). The
 * row's engulf half is what these files own, so E10 asserts the pair moved well apart instead.
 */
export const SEPARATED_FACTOR = 3;
/** E9b: A steers 5 radii away from B from tick 1 and drags it along; the numbers the row states. */
export const E9B_SEAL_DISTANCE_WU = 22.53;
export const E9B_SEAL_WESTING_WU = 12.5;
export const E9B_SPEED_TICK_1 = 9.8;
export const E9B_SPEED_TICK_18 = 64.0;
export const E9B_SPEED_TICK_19 = 69.5;
export const E9B_SPEED_TICK_35 = 121.4;
/** "± 0.01 wu" (docs/ECOLOGY.md §8) for a centre distance the row states to two decimals. */
export const DISTANCE_TOLERANCE_WU = 0.01;
/** E9b states the predator's westing as "≈ 12.5 wu"; the step gives 12.532, inside its own rounding. */
export const APPROXIMATE_DISTANCE_TOLERANCE_WU = 0.05;
/** E13 runs on the shortest legal round so the results tick is reachable in a test. */
export const SHORT_ROUND_SECONDS = 60;
/** E13 keeps the pair this far apart until the fixture brings B next to A: no engulf, no payout. */
export const E13_APART_WU = 700;
export const SHORT_ROUND_TICKS = SHORT_ROUND_SECONDS * TICK_HZ;
/** E11's reaction window: sprinting at 13 still escapes, at 14 the seal closes first. */
export const E11_SPRINT_TICK = 10;
export const E11_RELEASE_TICK = 25;
export const E11_LATE_SPRINT_TICK = 13;
export const E11_LATE_RELEASE_TICK = 29;
export const E11_TOO_LATE_SPRINT_TICK = 14;
export const E11_TOO_LATE_SEAL_TICK = 23;
export const E11_TOO_LATE_END_TICK = 41;
export const E11_NO_SPRINT_RELEASE_TICK = 31;

/**
 * "A at mass 100, B at 20, centres 10 wu apart": the setup every engulf row shares.
 * `predatorDnaCumulative` is PROGRESSION P5's "A given `dnaCumulative` = 40 at setup"; left out,
 * A starts the round with no DNA as every other row has it.
 */
export function engulfPair(
  name: string,
  predatorMass = PREDATOR_MASS,
  preyMass = PREY_MASS,
  predatorDnaCumulative?: number,
) {
  return scenario(name)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: predatorMass, dnaCumulative: predatorDnaCumulative })
    .placeCell({ playerIndex: 1, mass: preyMass, eastOfFirstCellWu: CENTRE_DISTANCE_WU });
}

/** "Steers away from tick t": every tick targets 5 radii along the line from the predator through the prey. */
export const awayFromPredator = targetRadiiAwayFrom(FULL_THROTTLE_RADII, BROTH_POINT);
/** The mirror for E9b, where it is the predator that steers away: the prey's placed centre. */
export const awayFromPrey = targetRadiiAwayFrom(FULL_THROTTLE_RADII, {
  x: BROTH_POINT.x + CENTRE_DISTANCE_WU,
  y: BROTH_POINT.y,
});

export const progressOfPrey = (view: EvolutionView): number | undefined => cellOf(view, 1)?.engulfProgress;
export const statesOfPrey = (view: EvolutionView): string[] | undefined => cellOf(view, 1)?.states;
export const statesOfPredator = (view: EvolutionView): string[] | undefined => cellOf(view, 0)?.states;
export const releaseReasons = (view: EvolutionView): string[] =>
  effectsOfKind(view, EFFECT_KIND.cellReleased).map((effect) => effect.reason);

/** The payout halves (docs/ECOLOGY.md §6.1): what the predator gained and what became of the prey. */
export const massOfPredator = (view: EvolutionView): number | undefined => cellOf(view, 0)?.mass;
export const dnaOfPredator = (view: EvolutionView): number | undefined => progressOf(view, 0)?.dnaCumulative;
export const absorptionsOfPredator = (view: EvolutionView): number | undefined => progressOf(view, 0)?.absorptions;
export const lifeStateOfPrey = (view: EvolutionView): string | undefined => progressOf(view, 1)?.lifeState;
export const preyCell = (view: EvolutionView) => cellOf(view, 1);
export const absorbedCellIds = (view: EvolutionView): string[] =>
  effectsOfKind(view, EFFECT_KIND.cellAbsorbed).map((effect) => effect.cellId);
export const detritusInDish = (view: EvolutionView): number =>
  detritusMass(view, DEFAULT_BALANCE.ecology.DETRITUS_MOTE_MASS);
