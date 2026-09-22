// docs/ecology/acceptance.md §8.1, the evolving-world rows that end within the first minute (W2, W4, W5, W7, W8),
// each run twice and hash-compared. The world-clock rows (W3, W6, W9, W10) are ecology-wild-clock.gameplay.test.ts;
// W1 is the pure `worldReference` row, pinned in packages/shared/src/simulation/world-clock.test.ts. The placed rows
// run on seed 48 (docs/testing/scenario-runner.md §8.1): placing anything vacates the seeded seats, and seat 0 is
// seated on demand beside the placed cell, the only wild cell in the dish.

import { describe, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  DNA_TAG,
  FOOD_KIND,
  PLAYER_LIFE_STATE,
  TICK_HZ,
  radiusForMass,
} from '@evolution/shared';
import { cellOf, foodCount, fragmentCount, massOf, progressOf, wildCellsOf } from '../gameplay/evolution-views.js';
import { BROTH_POINT, ZONE } from '../gameplay/placement.js';
import {
  CENTRE_DISTANCE_WU,
  E9_COVER_END_TICK,
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  OFFSET_TOLERANCE_WU,
  PREDATOR_MASS,
  PREY_MASS,
  PROGRESS_TOLERANCE,
  absorption,
  detritusInDish,
} from './engulf-setups.js';
import { MASS_TOLERANCE, placedSolo, seededSolo } from './shared-setups.js';
import {
  HEADING_TOLERANCE_DEGREES,
  HEAVIEST_SEAT_MASS,
  LIGHTEST_SEAT_MASS,
  PLACED_SEAT,
  WILD_RESPAWN_TICKS,
  WORLD_SPREAD,
  absorbedThisTick,
  closestCentrePair,
  distanceFromSeat,
  farthestWildFromOrigin,
  headingErrorOfSeatFromEast,
  heaviestWild,
  isWorldProtocell,
  lightestWild,
  massOfSeat,
  motesInsideWildCells,
  placedSeat,
  placedSeatCell,
  progressOfSeat,
  sprintOfSeat,
  statesOfSeat,
  targetOfSeat,
  worldMassAtTick,
  xOfSeat,
} from './wild-setups.js';

const { wildCells, growth, world: dish, controls } = DEFAULT_BALANCE;
/** W2: E1's counts on the seeded world, unchanged by the seats. */
const E1_FOOD_COUNT = 420;
const E1_FRAGMENT_COUNT = 24;
/** W4: "A mass = decayed(100, 36) + 0.8 × 20.6 ≈ 116.38"; seat 0 back "at mass 30.617 × a fresh spread (within [21.43, 39.80])". */
const W4_PREDATOR_MASS_AT_PAYOUT = 116.38;
const W4_RESPAWNED_MASS_LOW = 21.43;
const W4_RESPAWNED_MASS_HIGH = 39.8;
const W4_DETRITUS_MASS = 4;
/** W5: "seat 0 pinned at spread 5.0"; "at tick 37 seat 0's mass = 5 × (20 + 37/60) ≈ 103.08"; "at tick 217 B is alive". */
const W5_SEAT_SPREAD = 5;
const W5_SEAT_MASS_AFTER_PAYOUT = 103.08;
const W5_RESPAWN_TICK = 217;
/** Seat 0's first decision tick (docs/ecology/wild-cells.md §3.3: seat n decides on ticks ≡ n mod 30). */
const FIRST_DECISION_TICK = wildCells.WILD_CELL_DECISION_INTERVAL_SECONDS * TICK_HZ;
/** W7: "seat 0 placed 89 wu east of A (5 wild radii)", its heading read at 60. */
const W7_SEAT_EAST_WU = 89;
const W7_END_TICK = 60;
/** W8: pinned, nothing eaten: "seat 0's mass = 21 exactly" after 60 ticks. */
const W8_END_TICK = 60;
const W8_SEAT_MASS = 21;
const ONE_TICK = 1;

describe('ecology/acceptance.md §8.1: the wild cells', () => {
  it('W2: 24 wild protocells seated before the fill, spaced 200 wu apart inside the spawn disc', async () => {
    await seededSolo('W2')
      .expect('wild cell count', (view) => wildCellsOf(view).length)
      .atTick(0)
      .toBe(wildCells.WILD_CELL_COUNT)
      .expect('every wild cell a level-1 traitless protocell of the world organism', (view) =>
        wildCellsOf(view).every(isWorldProtocell),
      )
      .atTick(0)
      .toBe(true)
      .expect('lightest wild cell', lightestWild)
      .atTick(0)
      .toBeAtLeast(LIGHTEST_SEAT_MASS)
      .expect('heaviest wild cell', heaviestWild)
      .atTick(0)
      .toBeAtMost(HEAVIEST_SEAT_MASS)
      .expect('closest pair of cell centres, wild or player', closestCentrePair)
      .atTick(0)
      .toBeAtLeast(wildCells.WILD_CELL_MIN_SPACING_WU)
      .expect('farthest wild centre from the origin', farthestWildFromOrigin)
      .atTick(0)
      .toBeAtMost(dish.DISH_RADIUS - dish.SPAWN_EDGE_MARGIN)
      .expect("E1's food count", foodCount)
      .atTick(0)
      .toBe(E1_FOOD_COUNT)
      .expect("E1's fragment count", fragmentCount)
      .atTick(0)
      .toBe(E1_FRAGMENT_COUNT)
      .expect('no mote inside any wild cell', motesInsideWildCells)
      .atTick(0)
      .toBe(0)
      .runDeterministic();
  });

  it('W4: A eats seat 0 on tick 36 for mass and predatory points alone; the seat is seated again on tick 637', async () => {
    const respawnTick = E9_PAYOUT_TICK + WILD_RESPAWN_TICKS + ONE_TICK;
    await placedSolo('W4')
      .placeCell({ playerIndex: 0, mass: PREDATOR_MASS })
      .placeWildCell({ seat: PLACED_SEAT, spreadFactor: WORLD_SPREAD, eastOfFirstCellWu: CENTRE_DISTANCE_WU })
      .advance(respawnTick)
      .capture('seat 0 cell id', (view) => placedSeatCell(view)?.id)
      .atTick(E9_SEAL_TICK)
      .expect('seat 0 sits still until the seal', xOfSeat)
      .atTick(E9_SEAL_TICK - ONE_TICK)
      .toBe(BROTH_POINT.x + CENTRE_DISTANCE_WU)
      .expect('no target before its first decision', targetOfSeat)
      .atTick(E9_SEAL_TICK - ONE_TICK)
      .toSatisfy((target) => target === undefined, 'no target')
      .expect('cover ends on tick 6', progressOfSeat)
      .atTick(E9_COVER_END_TICK)
      .toBeCloseTo(absorption.ENGULF_WRAP_START_PROGRESS, PROGRESS_TOLERANCE)
      .expect('sealed on tick 18', progressOfSeat)
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE)
      .expect('carried at its 10 wu offset past its decision on tick 30', (view) => distanceFromSeat(view, 0))
      .atTick(FIRST_DECISION_TICK + ONE_TICK)
      .toBeCloseTo(CENTRE_DISTANCE_WU, OFFSET_TOLERANCE_WU)
      .expect('being engulfed while carried', statesOfSeat)
      .atTick(FIRST_DECISION_TICK + ONE_TICK)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect("seat 0's cell absorbed on tick 36 with no player", absorbedThisTick)
      .atTick(E9_PAYOUT_TICK)
      .toSatisfy(
        (absorbed) => absorbed.length === 1 && absorbed[0]![1] === null,
        'one cell_absorbed with playerId null',
      )
      .expect(
        "the absorbed cell is seat 0's",
        (view) => absorbedThisTick(view)[0]?.[0] === view.captured('seat 0 cell id'),
      )
      .atTick(E9_PAYOUT_TICK)
      .toBe(true)
      .expect('A mass ≈ 116.38', (view) => massOf(view, 0))
      .atTick(E9_PAYOUT_TICK)
      .toBeCloseTo(W4_PREDATOR_MASS_AT_PAYOUT, MASS_TOLERANCE)
      .expect('A DNA = 0 (the world has none, no base)', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(E9_PAYOUT_TICK)
      .toBe(0)
      .expect('predatory = 10', (view) => progressOf(view, 0)?.dnaTagPoints[DNA_TAG.predatory])
      .atTick(E9_PAYOUT_TICK)
      .toBe(absorption.ENGULF_PREDATORY_TAG_POINTS)
      .expect('wildAbsorptions = 1', (view) => progressOf(view, 0)?.wildAbsorptions)
      .atTick(E9_PAYOUT_TICK)
      .toBe(1)
      .expect('absorptions = 0', (view) => progressOf(view, 0)?.absorptions)
      .atTick(E9_PAYOUT_TICK)
      .toBe(0)
      .expect('score = 0', (view) => progressOf(view, 0)?.score)
      .atTick(E9_PAYOUT_TICK)
      .toBe(0)
      .expect('detritus 2 motes = 4 mass', detritusInDish)
      .atTick(E9_PAYOUT_TICK)
      .toBe(W4_DETRITUS_MASS)
      .expect('seat 0 has no cell', (view) => placedSeat(view)?.cellId)
      .atTick(E9_PAYOUT_TICK)
      .toBeNull()
      .expect('respawnInTicks = 600', (view) => placedSeat(view)?.respawnInTicks)
      .atTick(E9_PAYOUT_TICK)
      .toBe(WILD_RESPAWN_TICKS)
      .expect('seat 0 alive again at tick 637 at a fresh spread of 30.617', massOfSeat)
      .atTick(respawnTick)
      .toBeBetween(W4_RESPAWNED_MASS_LOW, W4_RESPAWNED_MASS_HIGH)
      .expect('a fresh spread within the band', (view) => placedSeat(view)?.massSpreadFactor)
      .atTick(respawnTick)
      .toBeBetween(1 - wildCells.WILD_CELL_MASS_SPREAD, 1 + wildCells.WILD_CELL_MASS_SPREAD)
      .runDeterministic();
  });

  it('W5: seat 0 at spread 5 eats B on tick 36, keeps nothing, and B is back at the starting mass on tick 217', async () => {
    await placedSolo('W5')
      .placeCell({ playerIndex: 0, mass: PREY_MASS })
      .placeWildCell({ seat: PLACED_SEAT, spreadFactor: W5_SEAT_SPREAD, eastOfFirstCellWu: CENTRE_DISTANCE_WU })
      .advance(W5_RESPAWN_TICK)
      .expect('B sealed on tick 18', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, PROGRESS_TOLERANCE)
      .expect("B carried at its offset past seat 0's wander decision on tick 30", (view) => distanceFromSeat(view, 0))
      .atTick(E9_PAYOUT_TICK - ONE_TICK)
      .toBeCloseTo(CENTRE_DISTANCE_WU, OFFSET_TOLERANCE_WU)
      .expect('seat 0 wanders from tick 30: a target, not a hunt', targetOfSeat)
      .atTick(E9_PAYOUT_TICK - ONE_TICK)
      .toSatisfy((target) => target !== undefined, 'a wander target')
      .expect('B absorbed on tick 36', (view) => absorbedThisTick(view).map(([, playerId]) => playerId))
      .atTick(E9_PAYOUT_TICK)
      .toSatisfy((ids) => ids.length === 1 && ids[0] !== null, "one cell_absorbed of B's player")
      .expect("B's cell removed", (view) => cellOf(view, 0))
      .atTick(E9_PAYOUT_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('B spectating', (view) => progressOf(view, 0)?.lifeState)
      .atTick(E9_PAYOUT_TICK)
      .toBe(PLAYER_LIFE_STATE.spectating)
      .expect("B spectates seat 0's cell", (view) => progressOf(view, 0)?.spectatingCellId === placedSeat(view)?.cellId)
      .atTick(E9_PAYOUT_TICK)
      .toBe(true)
      .expect("seat 0's mass re-pinned on tick 37: the meal is not kept", massOfSeat)
      .atTick(E9_PAYOUT_TICK + ONE_TICK)
      .toBeCloseTo(W5_SEAT_MASS_AFTER_PAYOUT, MASS_TOLERANCE)
      .expect('B alive on tick 217', (view) => progressOf(view, 0)?.lifeState)
      .atTick(W5_RESPAWN_TICK)
      .toBe(PLAYER_LIFE_STATE.alive)
      .expect('B at the starting mass (the entry rule floors at it)', (view) => massOf(view, 0))
      .atTick(W5_RESPAWN_TICK)
      .toBe(growth.CELL_STARTING_MASS)
      .expect('B level 1 (no lift)', (view) => progressOf(view, 0)?.level)
      .atTick(W5_RESPAWN_TICK)
      .toBe(1)
      .runDeterministic();
  });

  it('W7: seat 0 flees A on its first decision, pointing east within 5° by tick 60, never sprinting', async () => {
    // Decided at step 1 of tick 30 from where it sat, at that tick's pinned radius (worldMass 20.5).
    const fleeTargetX =
      BROTH_POINT.x +
      W7_SEAT_EAST_WU +
      controls.STEER_FULL_THROTTLE_RADII * radiusForMass(worldMassAtTick(FIRST_DECISION_TICK), growth);
    await placedSolo('W7')
      .placeCell({ playerIndex: 0, mass: PREDATOR_MASS })
      .placeWildCell({ seat: PLACED_SEAT, spreadFactor: WORLD_SPREAD, eastOfFirstCellWu: W7_SEAT_EAST_WU })
      .advance(W7_END_TICK)
      .expect('seat 0 sits still before its decision', xOfSeat)
      .atTick(FIRST_DECISION_TICK - ONE_TICK)
      .toBe(BROTH_POINT.x + W7_SEAT_EAST_WU)
      .expect('flee target = centre + (1, 0) × 2 radii on tick 30', targetOfSeat)
      .atTick(FIRST_DECISION_TICK)
      .toSatisfy(
        (target) => target !== undefined && Math.abs(target.x - fleeTargetX) < OFFSET_TOLERANCE_WU && target.y === 0,
        `(${fleeTargetX.toFixed(2)}, 0) within ${OFFSET_TOLERANCE_WU} wu`,
      )
      .expect('velocity points east within 5° by tick 60', headingErrorOfSeatFromEast)
      .atTick(W7_END_TICK)
      .toBeAtMost(HEADING_TOLERANCE_DEGREES)
      .expect('seat 0 has moved east', xOfSeat)
      .atTick(W7_END_TICK)
      .toBeGreaterThan(BROTH_POINT.x + W7_SEAT_EAST_WU)
      .expect('never sprints (tick 31)', sprintOfSeat)
      .atTick(FIRST_DECISION_TICK + ONE_TICK)
      .toBe(0)
      .expect('never sprints (tick 60)', sprintOfSeat)
      .atTick(W7_END_TICK)
      .toBe(0)
      .runDeterministic();
  });

  it('W8: a mote inside seat 0 is never eaten and the pinned seat weighs 21 exactly after a second', async () => {
    await placedSolo('W8')
      .placeWildCell({ seat: PLACED_SEAT, spreadFactor: WORLD_SPREAD })
      .placeMote({ moteKind: FOOD_KIND.algae, at: ZONE.broth })
      .advance(W8_END_TICK)
      .expect('the mote is still there', foodCount)
      .atTick(W8_END_TICK)
      .toBe(1)
      .expect("seat 0's mass = 21 exactly", massOfSeat)
      .atTick(W8_END_TICK)
      .toBe(W8_SEAT_MASS)
      .expect('nothing drained', (view) => placedSeat(view)?.drainedMass)
      .atTick(W8_END_TICK)
      .toBe(0)
      .runDeterministic();
  });
});
