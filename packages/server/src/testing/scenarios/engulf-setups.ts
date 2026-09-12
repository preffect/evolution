// The setup the two engulf scenario files share (docs/ECOLOGY.md §8): "A at mass 100, B at 20,
// centres 10 wu apart", the numbers those rows name, and the selectors they read through. Not a test
// file; `ecology-engulf.gameplay.test.ts` and `ecology-engulf-escape.gameplay.test.ts` import it.
//
// #258 ships the lifecycle only. What the rows deliberately leave out, and to which ticket:
//   · the mass, DNA, tag, `absorptions`, detritus and `lifeState` halves of E9, E9b, E10 and E11,
//     and the payout ticks they name (E10's 70, E11's absorption at 41) — #259, there is no payout.
//   · E10's separation half ("< 0.01 wu of overlap"), which the whole step cannot reach — #261.
//   · every spit-out and refractory row (§6.1 spit-out, §5.3's T4 separation, §6.3 "spat out, still
//     overlapping"), because no build-1 tier table sets `spitOutChancePerSecond` until #260. The
//     mechanism is pinned at unit level on a folded modifier instead (`engulf-spit-out.test.ts`).

import { DEFAULT_BALANCE, EFFECT_KIND, TICK_HZ } from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { cellOf, effectsOfKind, type EvolutionView } from '../gameplay/evolution-views.js';
import { targetRadiiAwayFrom } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { FULL_THROTTLE_RADII } from './shared-setups.js';

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

/** "A at mass 100, B at 20, centres 10 wu apart": the setup every engulf row shares. */
export function engulfPair(name: string, predatorMass = PREDATOR_MASS, preyMass = PREY_MASS) {
  return scenario(name)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: predatorMass })
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
