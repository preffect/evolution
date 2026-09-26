// docs/ecology/acceptance.md §8.1, the evolving-world rows where what happens to a wild cell sticks (W5, W8, W10),
// each run twice and hash-compared: a meal is kept as growth that only the player's decay removes, a wound recovers
// with the 6 s time constant, and a toxin's drain on a wild predator is kept past the release (docs/ecology/wild-cells.md
// §3.3.1, §3.3.4). The placed rows run on seed 48 (docs/testing/scenario-runner.md §8.1): placing anything vacates the
// seeded seats, and seat 0 is seated on demand beside the placed cell.

import { describe, expect, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  DNA_TAG,
  ENGULF_BASE_DURATION_SECONDS,
  ENGULF_SEAL_PROGRESS,
  ENGULF_WRAP_START_PROGRESS,
  FOOD_KIND,
  PLAYER_LIFE_STATE,
  TICK_HZ,
  TICK_INTERVAL_S,
} from '@evolution/shared';
import { wildRecoveryFactorPerTick } from '../../game/wild/wild-settle.js';
import { cellOf, foodCount, fragmentCount, massOf, progressOf } from '../gameplay/evolution-views.js';
import { player } from '../gameplay/index.js';
import { BROTH_POINT, ZONE } from '../gameplay/placement.js';
import {
  CENTRE_DISTANCE_WU,
  OFFSET_TOLERANCE_WU,
  PREY_MASS,
  PROGRESS_TOLERANCE,
  absorption,
  detritusInDish,
  releaseReasons,
} from './engulf-setups.js';
import { placedSolo } from './shared-setups.js';
import {
  HUNTING_TICK,
  PLACED_SEAT,
  WORLD_SIZE,
  absorbedThisTick,
  distanceFromSeat,
  massOfSeat,
  placedSeat,
  progressOfSeat,
  recordSeatTrace,
  statesOfSeat,
  targetOfSeat,
  type SeatTraceRow,
} from './wild-setups.js';

const { growth, wildCells } = DEFAULT_BALANCE;
const ONE_TICK = 1;
/** W5: seat 0 at size 2.0; ratio 2 → 1/45 per tick: sealed on tick 23, paid out on 45; "at tick 226 B is alive". */
const W5_SEAT_SIZE = 2;
const W5_SEAL_TICK = 23;
const W5_PAYOUT_TICK = 45;
const W5_RESPAWN_TICK = 226;
/**
 * "Seat 0's mass = 41.50 + 0.8 × 20 = 57.50"; after tick 46 "`grownMass` = 15.99875 and its mass = 57.532 + 2 = 59.532
 * (± 0.001)": on seed 48 one of B's two detritus motes lands inside seat 0, which eats it at step 4 of tick 46.
 */
const W5_SEAT_MASS_AT_PAYOUT = 57.5;
const W5_GROWN_AFTER_PAYOUT = 15.99875;
const W5_FULL_MASS_AFTER_PAYOUT = 57.532;
const W5_SEAT_MASS_AFTER_PAYOUT = 59.532;
const W5_DETRITUS_AT_PAYOUT = 4;
const W5_DETRITUS_AFTER_MEAL = 2;
const W5_TOLERANCE = 0.001;
/** W8: the algae and the fragment 5 wu either side of seat 0's centre; "21.0167 (± 0.001)" after tick 1, "0.99705" and "21.99705 (± 0.0001)" after 60. */
const W8_SIDE_OFFSET_WU = 5;
const W8_END_TICK = 60;
const W8_MASS_AFTER_MEAL = 21.0167;
const W8_GROWN_AT_END = 0.99705;
const W8_MASS_AT_END = 21.99705;
const W8_MEAL_TOLERANCE = 0.001;
const W8_END_TOLERANCE = 0.0001;
/** W10: P (Toxin Vacuole II, mass 380, pinned) and seat 0 at size 1.3 (mass 494) 10 wu east of it. */
const W10_PREY_MASS = 380;
const W10_SEAT_SIZE = 1.3;
const W10_TOXIN_TIER = 2;
const W10_SECOND_TICK = HUNTING_TICK + ONE_TICK;
/** The row's ticks: cover ends 21 611, seal 21 635; the ratio release pinned from the #517 run (21 640 before it). */
const W10_COVER_END_TICK = 21_611;
const W10_SEAL_TICK = 21_635;
const W10_RELEASE_TICK = 21_642;
/** "Seat 0 ≈ 493.59 (± 0.01)" after tick 21 600: 494.00 less 0.41 of P's contact toxin, no base decay. */
const W10_SEAT_MASS_AFTER_START_TICK = 493.59;
/** "Seat 0 ≈ 493.20 (± 0.01)" after 21 601: the settle's 494.022 + (−0.412 × q), less 0.411 of contact toxin. */
const W10_SEAT_MASS_AFTER_SECOND_TICK = 493.2;
const W10_TOLERANCE = 0.01;
/** The wound recovers with the 6 s time constant: the trace checks at least that many ticks of it. */
const W10_RECOVERY_TICKS = wildCells.WILD_CELL_RECOVERY_SECONDS * TICK_HZ;
/**
 * The first tick seat 0 weighs 1.25 × P again, 348 ticks after the release; no new engulf of P before it. Since #677
 * the 494-mass seat swims at the full top speed and leaves P's toxin within a few ticks, so less drain slows its
 * recovery than when it swam at its mass curve's 96 wu/s (≥ 360 ticks before #677). Since #709 the release leaves the
 * pair deeper than the minimum centre distance, so separation pushes it out to that distance at once: one tick less.
 */
const W10_FIRST_HEAVY_ENOUGH_TICK = 21_990;
/** How long after the release the trace runs: past the tick seat 0 is heavy enough to start on P again. */
const W10_TRACE_TICKS = 600;
/** "Ratio 1.3 → massFactor 1.25 / 1.3": the cover rate (1/69.2 a tick), and the progress after the start tick. */
const W10_MASS_FACTOR = absorption.ENGULF_MASS_RATIO / W10_SEAT_SIZE;
const W10_COVER_RATE_PER_TICK = TICK_INTERVAL_S / (ENGULF_BASE_DURATION_SECONDS * W10_MASS_FACTOR);

describe('ecology/acceptance.md §8.1: what happens to a wild cell sticks', () => {
  it('W5: seat 0 at size 2 eats B on tick 45 and keeps the meal as growth; B is back at the starting mass on tick 226', async () => {
    await placedSolo('W5')
      .placeCell({ playerIndex: 0, mass: PREY_MASS })
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: W5_SEAT_SIZE, eastOfFirstCellWu: CENTRE_DISTANCE_WU })
      .advance(W5_RESPAWN_TICK)
      .expect('B sealed on tick 23', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W5_SEAL_TICK)
      .toBeAtLeast(ENGULF_SEAL_PROGRESS)
      .expect('not yet sealed the tick before', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W5_SEAL_TICK - ONE_TICK)
      .toBeLessThan(ENGULF_SEAL_PROGRESS)
      .expect("B carried at its offset past seat 0's wander decision on tick 30", (view) => distanceFromSeat(view, 0))
      .atTick(W5_PAYOUT_TICK - ONE_TICK)
      .toBeCloseTo(CENTRE_DISTANCE_WU, OFFSET_TOLERANCE_WU)
      .expect('seat 0 wanders from tick 30: a target, not a hunt', targetOfSeat)
      .atTick(W5_PAYOUT_TICK - ONE_TICK)
      .toSatisfy((target) => target !== undefined, 'a wander target')
      .expect('B absorbed on tick 45', (view) => absorbedThisTick(view).map(([, playerId]) => playerId))
      .atTick(W5_PAYOUT_TICK)
      .toSatisfy((ids) => ids.length === 1 && ids[0] !== null, "one cell_absorbed of B's player")
      .expect("B's cell removed", (view) => cellOf(view, 0))
      .atTick(W5_PAYOUT_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('B spectating', (view) => progressOf(view, 0)?.lifeState)
      .atTick(W5_PAYOUT_TICK)
      .toBe(PLAYER_LIFE_STATE.spectating)
      .expect("B spectates seat 0's cell", (view) => progressOf(view, 0)?.spectatingCellId === placedSeat(view)?.cellId)
      .atTick(W5_PAYOUT_TICK)
      .toBe(true)
      .expect("seat 0's mass = 41.50 + 0.8 × 20 = 57.50 on tick 45: the meal is kept", massOfSeat)
      .atTick(W5_PAYOUT_TICK)
      .toBeCloseTo(W5_SEAT_MASS_AT_PAYOUT, W5_TOLERANCE)
      .expect("seat 0's grownMass = 16 − 37.5 × D after tick 46", (view) => placedSeat(view)?.grownMass)
      .atTick(W5_PAYOUT_TICK + ONE_TICK)
      .toBeCloseTo(W5_GROWN_AFTER_PAYOUT, W5_TOLERANCE)
      .expect("seat 0's fullMass = 2 × (20 + 46/60) + 15.99875 after tick 46", (view) => placedSeat(view)?.fullMass)
      .atTick(W5_PAYOUT_TICK + ONE_TICK)
      .toBeCloseTo(W5_FULL_MASS_AFTER_PAYOUT, W5_TOLERANCE)
      .expect('detritus 2 motes = 4 mass on tick 45', detritusInDish)
      .atTick(W5_PAYOUT_TICK)
      .toBe(W5_DETRITUS_AT_PAYOUT)
      .expect('seat 0 eats the detritus mote inside it on tick 46', detritusInDish)
      .atTick(W5_PAYOUT_TICK + ONE_TICK)
      .toBe(W5_DETRITUS_AFTER_MEAL)
      .expect("seat 0's mass = 2 × (20 + 46/60) + 15.99875 + 2 after tick 46", massOfSeat)
      .atTick(W5_PAYOUT_TICK + ONE_TICK)
      .toBeCloseTo(W5_SEAT_MASS_AFTER_PAYOUT, W5_TOLERANCE)
      .expect('B alive on tick 226', (view) => progressOf(view, 0)?.lifeState)
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

  it('W8: seat 0 eats the algae inside it on tick 1, never the fragment, and keeps the meal as growth less the decay', async () => {
    const algaeAt = { x: BROTH_POINT.x - W8_SIDE_OFFSET_WU, y: BROTH_POINT.y };
    const fragmentAt = { x: BROTH_POINT.x + W8_SIDE_OFFSET_WU, y: BROTH_POINT.y };
    await placedSolo('W8')
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: WORLD_SIZE, at: ZONE.broth })
      .placeMote({ moteKind: FOOD_KIND.algae, at: algaeAt })
      .placeFragment({ tag: DNA_TAG.photic, at: fragmentAt })
      .advance(W8_END_TICK)
      .expect('the algae mote is gone after tick 1', foodCount)
      .atTick(ONE_TICK)
      .toBe(0)
      .expect('the fragment is still there after tick 1', fragmentCount)
      .atTick(ONE_TICK)
      .toBe(1)
      .expect("seat 0's mass = 20 + 1/60 + 1 after tick 1", massOfSeat)
      .atTick(ONE_TICK)
      .toBeCloseTo(W8_MASS_AFTER_MEAL, W8_MEAL_TOLERANCE)
      .expect("seat 0's grownMass = 0.99705 after tick 60", (view) => placedSeat(view)?.grownMass)
      .atTick(W8_END_TICK)
      .toBeCloseTo(W8_GROWN_AT_END, W8_END_TOLERANCE)
      .expect("seat 0's mass = 21.99705 after tick 60", massOfSeat)
      .atTick(W8_END_TICK)
      .toBeCloseTo(W8_MASS_AT_END, W8_END_TOLERANCE)
      .expect('the fragment is still in the dish after tick 60', fragmentCount)
      .atTick(W8_END_TICK)
      .toBe(1)
      .runDeterministic();
  });
  it('W10: a wild predator bleeds the Toxin Vacuole drain, releases by ratio before the payout and keeps the wound', async () => {
    const traceEnd = W10_RELEASE_TICK + W10_TRACE_TICKS;
    const trace = new Map<number, SeatTraceRow>();
    await placedSolo('W10')
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS })
      .atTick(HUNTING_TICK)
      .placeCell({
        playerIndex: 0,
        mass: W10_PREY_MASS,
        isPinned: true,
        at: ZONE.broth,
        traits: [{ traitId: 'toxin_vacuole', tier: W10_TOXIN_TIER }],
      })
      .atTick(HUNTING_TICK)
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: W10_SEAT_SIZE, eastOfFirstCellWu: CENTRE_DISTANCE_WU })
      .between(W10_RELEASE_TICK + ONE_TICK, traceEnd + ONE_TICK, player(0).does(recordSeatTrace(trace)))
      .advance(traceEnd + ONE_TICK)
      .expect(
        'the engulf starts on tick 21 600 from progress 0: one cover tick done',
        (view) => cellOf(view, 0)?.engulfProgress,
      )
      .atTick(HUNTING_TICK)
      .toBeCloseTo(W10_COVER_RATE_PER_TICK, PROGRESS_TOLERANCE)
      .expect('P being engulfed', (view) => cellOf(view, 0)?.states)
      .atTick(HUNTING_TICK)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect("seat 0's mass ≈ 493.59 after tick 21 600: drained like any cell, no base decay", massOfSeat)
      .atTick(HUNTING_TICK)
      .toBeCloseTo(W10_SEAT_MASS_AFTER_START_TICK, W10_TOLERANCE)
      .expect("seat 0's mass ≈ 493.20 after tick 21 601: the loss recovers by q, the toxin takes more", massOfSeat)
      .atTick(W10_SECOND_TICK)
      .toBeCloseTo(W10_SEAT_MASS_AFTER_SECOND_TICK, W10_TOLERANCE)
      .expect('cover ends on tick 21 611, into the wrap band', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_COVER_END_TICK)
      .toBeGreaterThan(ENGULF_WRAP_START_PROGRESS)
      .expect('still in cover the tick before', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_COVER_END_TICK - ONE_TICK)
      .toBeLessThan(ENGULF_WRAP_START_PROGRESS)
      .expect('sealed on tick 21 635', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_SEAL_TICK)
      .toBeGreaterThan(ENGULF_SEAL_PROGRESS)
      .expect('not yet sealed the tick before', (view) => cellOf(view, 0)?.engulfProgress)
      .atTick(W10_SEAL_TICK - ONE_TICK)
      .toBeLessThan(ENGULF_SEAL_PROGRESS)
      .expect('still held the tick before the release', (view) => cellOf(view, 0)?.states)
      .atTick(W10_RELEASE_TICK - ONE_TICK)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('released by ratio on the pinned tick, from the absorb phase', releaseReasons)
      .atTick(W10_RELEASE_TICK)
      .toEqual(['ratio'])
      .expect(
        'seat 0 below 1.1 × P at the release',
        (view) => (massOfSeat(view) ?? Number.NaN) < absorption.ENGULF_RELEASE_RATIO * (massOf(view, 0) ?? 0),
      )
      .atTick(W10_RELEASE_TICK)
      .toBe(true)
      .expect('P alive and free', (view) => cellOf(view, 0)?.states)
      .atTick(W10_RELEASE_TICK)
      .toEqual([])
      .expect('seat 0 free with progress 0 and no growth', (view) => [
        statesOfSeat(view),
        progressOfSeat(view),
        placedSeat(view)?.grownMass,
      ])
      .atTick(W10_RELEASE_TICK)
      .toEqual([[], 0, 0])
      .runDeterministic();
    expectWoundKeptAfterRelease(trace);
  });
});

/**
 * W10 after the release: on every tick seat 0 is clear of P's toxin (contact) and not sprinting, its deficit is the
 * previous tick's × q; it weighs 1.25 × P again only on the pinned tick, and starts no new engulf of P before it.
 */
function expectWoundKeptAfterRelease(trace: ReadonlyMap<number, SeatTraceRow>): void {
  const recoveryPerTick = wildRecoveryFactorPerTick(DEFAULT_BALANCE);
  let checkedTicks = 0;
  for (const [tick, row] of trace) {
    const previous = trace.get(tick - ONE_TICK);
    if (previous !== undefined && row.gap > 0 && !row.isSeatSprinting && !row.isPreyEngulfed) {
      const expectedDeficit = (previous.fullMass - previous.seatMass) * recoveryPerTick;
      expect(Math.abs(row.fullMass - row.seatMass - expectedDeficit)).toBeLessThanOrEqual(W10_TOLERANCE);
      checkedTicks += 1;
    }
    if (row.isPreyEngulfed && previous !== undefined && !previous.isPreyEngulfed) {
      expect(tick).toBeGreaterThanOrEqual(W10_FIRST_HEAVY_ENOUGH_TICK);
      expect(previous.seatMass).toBeGreaterThanOrEqual(absorption.ENGULF_MASS_RATIO * previous.preyMass);
    }
  }
  expect(checkedTicks).toBeGreaterThan(W10_RECOVERY_TICKS);
  const firstHeavyEnough = [...trace].find(([, row]) => row.seatMass >= absorption.ENGULF_MASS_RATIO * row.preyMass);
  expect(firstHeavyEnough?.[0]).toBe(W10_FIRST_HEAVY_ENOUGH_TICK);
  // No meal after the release: growth only goes below zero, by what a sprint spends (the lead ruling on ticket #551).
  expect([...trace.values()].every((row) => row.grownMass <= 0)).toBe(true);
}
