// The setup the two engulf scenario files share (docs/ecology/acceptance.md §8): "A at mass 100, B at 20,
// centres 10 wu apart", the numbers those rows name, and the selectors they read through. Not a test
// file; `ecology-engulf.gameplay.test.ts` and `ecology-engulf-escape.gameplay.test.ts` import it.
//
// #258 shipped the lifecycle, #259 the payout and #260 the trait hooks, so the trait rows on the same
// setup (docs/traits/constants-and-acceptance.md §6: T3, T4, T6, T13–T19) use `engulfPairOf` from here too, and
// the wild rows (docs/ecology/acceptance.md §8.1 W4, W5, W10; `wild-setups.ts`) read the E9 ticks from here.

import { DEFAULT_BALANCE, DNA_TAG, EFFECT_KIND, TICK_HZ, radiusForMass } from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import {
  cellOf,
  detritusMass,
  distanceBetweenCells,
  effectsOfKind,
  progressOf,
  type EvolutionView,
} from '../gameplay/evolution-views.js';
import { combineScripts, player, sprint, targetRadiiAwayFrom, type PlaceCellOptions } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { FULL_THROTTLE_RADII, decayed } from './shared-setups.js';

export const absorption = DEFAULT_BALANCE.absorption;
const controls = DEFAULT_BALANCE.controls;
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
/** "detritus motes total mass = 4 (two motes of 2)" (docs/ecology/acceptance.md §8, E9), stated, not recomputed. */
export const E9_DETRITUS_MOTES = 2;
export const E9_DETRITUS_MASS = E9_DETRITUS_MOTES * DEFAULT_BALANCE.ecology.DETRITUS_MOTE_MASS;
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
/** E10's under-ratio pair runs 120 ticks. */
export const E10_SEPARATION_TICKS = 120;
/** E10's stated bound: `A.radius + B.radius − distance` < 0.01 wu (docs/ecology/acceptance.md §8). */
export const E10_OVERLAP_BOUND_WU = 0.01;
/**
 * How far apart decay can leave E10's pair: the rims' total shrink over the row. An idle placed cell has
 * no target (docs/ecology/mass-and-movement.md §5.2), so separation closes the overlap to touching and
 * never pushes past it (#261); after that only the radii decaying opens a gap.
 */
export const E10_DECAY_GAP_WU = [E10_UNDER_RATIO_MASS, PREY_MASS].reduce(
  (shrink, mass) =>
    shrink +
    radiusForMass(mass, DEFAULT_BALANCE.growth) -
    radiusForMass(decayed(mass, E10_SEPARATION_TICKS), DEFAULT_BALANCE.growth),
  0,
);
/**
 * E9b: A steers away from B at `E9B_THROTTLE` from tick 1 and drags it along; the numbers the row states. Grabbing costs A no
 * speed since #634, so the seal no longer changes its cap: ticks 18 and 19 differ only by one tick's blend.
 */
export const E9B_SEAL_DISTANCE_WU = 29.66;
export const E9B_SEAL_WESTING_WU = 19.66;
export const E9B_SPEED_TICK_1 = 9.8;
export const E9B_SPEED_TICK_18 = 104.3;
export const E9B_SPEED_TICK_19 = 107.1;
export const E9B_SPEED_TICK_35 = 133.6;
/** "± 0.01 wu" (docs/ecology/acceptance.md §8) for a centre distance the row states to two decimals. */
export const DISTANCE_TOLERANCE_WU = 0.01;
/** E9b states the predator's westing as "≈ 19.66 wu"; the step gives 19.663, inside its own rounding. */
export const APPROXIMATE_DISTANCE_TOLERANCE_WU = 0.05;
/** E13 runs on the shortest legal round so the results tick is reachable in a test. */
export const SHORT_ROUND_SECONDS = 60;
/**
 * Far enough apart that no engulf can start, whatever the masses: the distance the rows that want
 * the pair to meet later (E13, PROGRESSION P11) place them at until the fixture brings them together.
 */
export const FAR_APART_WU = 700;
export const SHORT_ROUND_TICKS = SHORT_ROUND_SECONDS * TICK_HZ;
/** E11's reaction window: sprinting at 13 still escapes, at 14 the seal closes first. */
export const E11_SPRINT_TICK = 10;
export const E11_RELEASE_TICK = 28;
export const E11_LATE_SPRINT_TICK = 13;
export const E11_LATE_RELEASE_TICK = 32;
export const E11_TOO_LATE_SPRINT_TICK = 14;
export const E11_TOO_LATE_SEAL_TICK = 23;
export const E11_TOO_LATE_END_TICK = 41;
export const E11_NO_SPRINT_RELEASE_TICK = 34;

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
  return engulfPairOf(name, { mass: predatorMass, dnaCumulative: predatorDnaCumulative }, { mass: preyMass });
}

/** One side of the pair: the E9 mass unless the row says otherwise, plus its fixture traits and DNA. */
export type EngulfSide = Partial<Omit<PlaceCellOptions, 'playerIndex' | 'at' | 'eastOfFirstCellWu'>>;

/** The E9 setup with the row's own traits, DNA or masses on either side (T3's pair sits 5 wu apart). */
export function engulfPairOf(
  name: string,
  predator: EngulfSide = {},
  prey: EngulfSide = {},
  centreDistanceWu = CENTRE_DISTANCE_WU,
) {
  return scenario(name)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ ...predator, playerIndex: 0, mass: predator.mass ?? PREDATOR_MASS })
    .placeCell({ ...prey, playerIndex: 1, mass: prey.mass ?? PREY_MASS, eastOfFirstCellWu: centreDistanceWu });
}

/** "Steers away from tick t": every tick targets 5 radii along the line from the predator through the prey. */
export const awayFromPredator = targetRadiiAwayFrom(FULL_THROTTLE_RADII, BROTH_POINT);

/** "B steers away from tick t" (docs/ecology/acceptance.md §8). */
export const steersAwayFrom = (tick: number) => (builder: ReturnType<typeof engulfPair>) =>
  builder.from(tick, player(1).does(awayFromPredator));

/** "B sprints away at tick t": steers away from t and presses sprint on t (docs/ecology/acceptance.md §8). */
export const sprintsAwayFrom = (tick: number) => (builder: ReturnType<typeof engulfPair>) =>
  builder
    .atTick(tick, player(1).does(combineScripts([awayFromPredator, sprint()])))
    .from(tick + 1, player(1).does(awayFromPredator));
/**
 * E9b's throttle: two thirds of the top speed. Every cell has the same top speed since #677, so at full throttle the
 * 100-mass predator outran its own 31.05 wu reach before the seal; at 2/3 it drags its cover along as the row means.
 */
export const E9B_THROTTLE = 2 / 3;
/** The steer distance that throttle takes: `STEER_DEAD_ZONE_RADII + throttle × (full − dead)` own radii. */
const E9B_STEER_RADII =
  controls.STEER_DEAD_ZONE_RADII + E9B_THROTTLE * (controls.STEER_FULL_THROTTLE_RADII - controls.STEER_DEAD_ZONE_RADII);
/** The mirror for E9b, where it is the predator that steers away (at `E9B_THROTTLE`): the prey's placed centre. */
export const awayFromPrey = targetRadiiAwayFrom(E9B_STEER_RADII, {
  x: BROTH_POINT.x + CENTRE_DISTANCE_WU,
  y: BROTH_POINT.y,
});

export const progressOfPrey = (view: EvolutionView): number | undefined => cellOf(view, 1)?.engulfProgress;
export const statesOfPrey = (view: EvolutionView): string[] | undefined => cellOf(view, 1)?.states;
export const statesOfPredator = (view: EvolutionView): string[] | undefined => cellOf(view, 0)?.states;
export const releaseReasons = (view: EvolutionView): string[] =>
  effectsOfKind(view, EFFECT_KIND.cellReleased).map((effect) => effect.reason);

/** The payout halves (docs/ecology/absorption.md §6.1): what the predator gained and what became of the prey. */
export const massOfPredator = (view: EvolutionView): number | undefined => cellOf(view, 0)?.mass;
export const dnaOfPredator = (view: EvolutionView): number | undefined => progressOf(view, 0)?.dnaCumulative;
export const absorptionsOfPredator = (view: EvolutionView): number | undefined => progressOf(view, 0)?.absorptions;
export const predatoryPointsOfPredator = (view: EvolutionView): number | undefined =>
  progressOf(view, 0)?.dnaTagPoints[DNA_TAG.predatory];
export const lifeStateOfPrey = (view: EvolutionView): string | undefined => progressOf(view, 1)?.lifeState;
export const preyCell = (view: EvolutionView) => cellOf(view, 1);
/** `A.radius + B.radius − distance` (docs/ecology/acceptance.md §8, E10). */
export function overlapOfPair(view: EvolutionView): number | undefined {
  const predator = cellOf(view, 0);
  const prey = cellOf(view, 1);
  const distance = distanceBetweenCells(view, 0, 1);
  if (predator === undefined || prey === undefined || distance === undefined) {
    return undefined;
  }
  return predator.radius + prey.radius - distance;
}
export const absorbedCellIds = (view: EvolutionView): string[] =>
  effectsOfKind(view, EFFECT_KIND.cellAbsorbed).map((effect) => effect.cellId);
export const detritusInDish = (view: EvolutionView): number =>
  detritusMass(view, DEFAULT_BALANCE.ecology.DETRITUS_MOTE_MASS);
