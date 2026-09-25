// The core loop end to end (#197): eating grows the cell, and since #677 the growth leaves its top speed alone
// (docs/ecology/mass-and-movement.md §5.1, §5.4), and the engulf ratio at its edges (docs/ecology/absorption.md §6.1: `canStart` and `canContinue`).
// The single-meal, single-mass and wide-margin rows are the tables' own (E4–E8 in `ecology-cells`, E10 and E16 in
// `ecology-engulf`); these runs chain a meal into the speed cap and sit 0.01 mass either side of each threshold.
// Expected numbers derive from the shared constants and formulas, as the table rows do (#212).

import { describe, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  ENGULF_RELEASE_REASON,
  FOOD_KIND,
  TICK_INTERVAL_S,
  radiusForMass,
} from '@evolution/shared';
import { cellOf, foodCount, massOf, speedOf } from '../gameplay/evolution-views.js';
import { ZONE, insideCellOf, player, targetRadiiAwayFrom, targetRadiiEast } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import {
  E16_START_MASS,
  PREY_MASS,
  absorption,
  absorptionsOfPredator,
  engulfPair,
  engulfPairOf,
  progressOfPrey,
  releaseReasons,
  statesOfPrey,
} from './engulf-setups.js';
import {
  FULL_THROTTLE_RADII,
  MASS_TOLERANCE,
  SPEED_TOLERANCE_WU_PER_SECOND,
  blendedSpeed,
  decayed,
  placedSolo,
} from './shared-setups.js';

const { ecology, growth } = DEFAULT_BALANCE;

/** The first meal: 60 algae take a starting cell to 80 mass, "a minute of grazing" (mass-and-movement.md §5.1). */
const FIRST_MEAL_MOTES = 60;
/** The second: 240 more take it to 320, 16× the starting mass. */
const SECOND_MEAL_MOTES = 240;
/** Each leg of full throttle runs E6's 120 ticks, so the blend has closed 99.97 % of the gap. */
const LEG_TICKS = 120;
const SECOND_MEAL_TICK = LEG_TICKS + 1;
const SECOND_LEG_END_TICK = 2 * LEG_TICKS;
/**
 * How far east of the broth point the second leg's turn point sits. Any distance far larger than the ground the cell
 * covers will do: the line from it through the cell stays due west, so the second leg runs back west.
 */
const FAR_TURN_OFFSET_WU = 100_000;
const WEST_TURN_POINT = { x: BROTH_POINT.x + FAR_TURN_OFFSET_WU, y: BROTH_POINT.y };

const FIRST_MEAL_MASS = growth.CELL_STARTING_MASS + FIRST_MEAL_MOTES * ecology.ALGAE_MASS;
/** Eating (step 4) precedes decay (step 5): the second meal lands on the mass 120 decays left, then decays once. */
const SECOND_MEAL_MASS = decayed(decayed(FIRST_MEAL_MASS, LEG_TICKS) + SECOND_MEAL_MOTES * ecology.ALGAE_MASS, 1);
/**
 * Decay takes a share of the mass above `CELL_STARTING_MASS`, so eating before the decay (the fixed step order) costs
 * the meal one tick of decay that decaying first would not: meal × rate × tick = 0.008 mass. That is under
 * `MASS_TOLERANCE`, so the second-meal check gets its own tolerance, a quarter of the gap, which tells the two orders
 * apart (the expected value's float error is around 1e-12).
 */
const EAT_BEFORE_DECAY_GAP_MASS =
  SECOND_MEAL_MOTES * ecology.ALGAE_MASS * ecology.MASS_DECAY_RATE_PER_SECOND * TICK_INTERVAL_S;
const STEP_ORDER_TOLERANCE_MASS = EAT_BEFORE_DECAY_GAP_MASS / 4;

/**
 * How far past a threshold the edge rows sit: the tables' own mass tolerance. It is larger than what one tick of
 * decay moves the ratio (at most 0.0002 against a 20-mass prey, 0.0002 net for the 500-over-400 pair, where both
 * sides decay), so the side of the threshold each placement lands on survives the metabolism step that precedes the
 * first engulf check (acceptance.md §8: "a placed predator has already decayed when its first eligibility check runs").
 */
const EDGE_MARGIN_MASS = 0.01;
const START_EDGE_MASS = PREY_MASS * absorption.ENGULF_MASS_RATIO;
const RELEASE_EDGE_MASS = PREY_MASS * absorption.ENGULF_RELEASE_RATIO;
/** A prey well above the starting mass, so the edge shows the rule is a ratio and not a mass gap: 1.25 × 400 = 500. */
const HEAVY_PREY_MASS = 400;
const HEAVY_START_EDGE_MASS = HEAVY_PREY_MASS * absorption.ENGULF_MASS_RATIO;
/**
 * Long enough that a start missed on tick 1 would show, and short of the payout (about 72 ticks at a ratio near 1.25,
 * which clamps `massFactor` near 1: 1/72 a tick). The just-over predator decays under 1.25 × its prey around tick 60,
 * but an engulf in progress only needs `ENGULF_RELEASE_RATIO` to hold, so that crossing changes nothing.
 */
const EDGE_RUN_TICKS = 60;
/** E16 lowers the predator before tick 10, inside the wrap: the release check reads the new mass that tick. */
const RELEASE_FIXTURE_TICK = 10;
/** Ten ticks past the drop: a held engulf is still running, a released one has not restarted. */
const RELEASE_RUN_TICKS = 20;
/**
 * At the release edge the pair sits closer than E16's 10 wu: a 22-mass predator's contact bound over a 20-mass prey
 * is 18.76 − 0.5 × 17.89 = 9.82 wu (absorption.md §6.1 `inContact`), so at 10 wu the prey would slip out and be
 * released `escaped`, which is not the rule under test.
 */
const RELEASE_EDGE_CENTRE_DISTANCE_WU = 5;

/** E16's pair, 30 against 20, with the prey inside the release-edge predator's contact bound. */
const releaseEdgePair = (name: string) =>
  engulfPairOf(name, { mass: E16_START_MASS }, {}, RELEASE_EDGE_CENTRE_DISTANCE_WU);

const beingEngulfed = [CELL_STATE.beingEngulfed];

function feedAlgae<Run extends ReturnType<typeof placedSolo>>(run: Run, tick: number, motes: number): Run {
  for (let mote = 0; mote < motes; mote += 1) {
    run.atTick(tick).placeMote({ moteKind: FOOD_KIND.algae, at: insideCellOf(0) });
  }
  return run;
}

describe('docs/ecology/mass-and-movement.md §5: eating grows the cell and its top speed stays the same', () => {
  const grownMass = FIRST_MEAL_MASS + SECOND_MEAL_MOTES * ecology.ALGAE_MASS;
  it(`a starting cell eats to ${FIRST_MEAL_MASS} mass, then to ${grownMass}, and its top speed stays the same with each meal`, async () => {
    const run = placedSolo('eat → grow → same top speed').placeCell({
      playerIndex: 0,
      mass: growth.CELL_STARTING_MASS,
    });
    feedAlgae(run, 1, FIRST_MEAL_MOTES);
    feedAlgae(run, SECOND_MEAL_TICK, SECOND_MEAL_MOTES);
    await run
      .between(1, LEG_TICKS, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
      .from(SECOND_MEAL_TICK, player(0).does(targetRadiiAwayFrom(FULL_THROTTLE_RADII, WEST_TURN_POINT)))
      .advance(SECOND_LEG_END_TICK)
      .expect('the first meal is eaten on tick 1, a unit of mass per alga', (view) => massOf(view, 0))
      .atTick(1)
      .toBeCloseTo(decayed(FIRST_MEAL_MASS, 1), MASS_TOLERANCE)
      .expect('every mote gone', foodCount)
      .atTick(1)
      .toBe(0)
      .expect('the radius grows with the square root of the mass', (view) => cellOf(view, 0)?.radius)
      .atTick(1)
      .toBeCloseTo(radiusForMass(decayed(FIRST_MEAL_MASS, 1), growth), MASS_TOLERANCE)
      .expect('the first-meal cell tops out at the starting cell’s speed', (view) => speedOf(view, 0))
      .atTick(LEG_TICKS)
      .toBeCloseTo(blendedSpeed(growth.CELL_BASE_SPEED, LEG_TICKS), SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('the second meal is eaten on the tick it lands, before that tick decays', (view) => massOf(view, 0))
      .atTick(SECOND_MEAL_TICK)
      .toBeCloseTo(SECOND_MEAL_MASS, STEP_ORDER_TOLERANCE_MASS)
      .expect('the second-meal cell, 16× the starting mass, still tops out at that speed', (view) => speedOf(view, 0))
      .atTick(SECOND_LEG_END_TICK)
      .toBeCloseTo(growth.CELL_BASE_SPEED, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('the radius follows the second meal', (view) => cellOf(view, 0)?.radius)
      .atTick(SECOND_MEAL_TICK)
      .toBeCloseTo(radiusForMass(SECOND_MEAL_MASS, growth), MASS_TOLERANCE)
      .runDeterministic();
  });
});

describe('docs/ecology/absorption.md §6.1: the engulf ratio at its edges', () => {
  const startRatio = absorption.ENGULF_MASS_RATIO;
  // [edge, prey mass, predator mass, the prey's states]; the heavy prey sits above the starting mass, so its rows
  // show the threshold scales with the prey: a ratio, not a mass gap.
  it.each([
    ['just over', PREY_MASS, START_EDGE_MASS + EDGE_MARGIN_MASS, beingEngulfed],
    ['just under', PREY_MASS, START_EDGE_MASS - EDGE_MARGIN_MASS, []],
    ['just over', HEAVY_PREY_MASS, HEAVY_START_EDGE_MASS + EDGE_MARGIN_MASS, beingEngulfed],
    ['just under', HEAVY_PREY_MASS, HEAVY_START_EDGE_MASS - EDGE_MARGIN_MASS, []],
  ] as const)(
    `%s ${startRatio} × a %d-mass prey (predator %d): the engulf starts on tick 1 or never`,
    async (_edge, preyMass, predatorMass, states) => {
      await engulfPair(`start edge ${predatorMass} over ${preyMass}`, predatorMass, preyMass)
        .advance(EDGE_RUN_TICKS)
        .expect('the first eligibility check decides it', statesOfPrey)
        .atTick(1)
        .toEqual([...states])
        .expect('and nothing changes it after', statesOfPrey)
        .atEnd()
        .toEqual([...states])
        .runDeterministic();
    },
  );

  const releaseRatio = absorption.ENGULF_RELEASE_RATIO;
  it(`just over ${releaseRatio} × the prey, an engulf in progress holds, though it could not start there`, async () => {
    await releaseEdgePair('release edge held')
      .atTick(RELEASE_FIXTURE_TICK)
      .placeCell({ playerIndex: 0, mass: RELEASE_EDGE_MASS + EDGE_MARGIN_MASS, at: ZONE.broth })
      .advance(RELEASE_RUN_TICKS)
      .expect('still being engulfed ten ticks after the drop', statesOfPrey)
      .atEnd()
      .toEqual(beingEngulfed)
      .expect('and the engulf still advances', progressOfPrey)
      .atEnd()
      .toBeGreaterThan(0)
      // Effects are per tick, so this reads the last tick only; the state check above carries the whole window, since
      // a released prey could not be re-engulfed by a predator under the start ratio.
      .expect('no release on the last tick', releaseReasons)
      .atEnd()
      .toEqual([])
      .runDeterministic();
  });

  it(`just under ${releaseRatio} × the prey, the engulf releases on the ratio the tick the mass drops`, async () => {
    await releaseEdgePair('release edge dropped')
      .atTick(RELEASE_FIXTURE_TICK)
      .placeCell({ playerIndex: 0, mass: RELEASE_EDGE_MASS - EDGE_MARGIN_MASS, at: ZONE.broth })
      .advance(RELEASE_RUN_TICKS)
      .expect('held up to the drop', statesOfPrey)
      .atTick(RELEASE_FIXTURE_TICK - 1)
      .toEqual(beingEngulfed)
      .expect('released on the ratio', releaseReasons)
      .atTick(RELEASE_FIXTURE_TICK)
      .toEqual([ENGULF_RELEASE_REASON.ratio])
      .expect('free, and it cannot restart under the start ratio', statesOfPrey)
      .atEnd()
      .toEqual([])
      .expect('no payout', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .runDeterministic();
  });
});
