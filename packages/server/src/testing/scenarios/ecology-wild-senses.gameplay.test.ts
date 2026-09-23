// docs/ecology/acceptance.md §8.1, the rows of what a wild cell notices and does about it (W7's wild variant, W12,
// W13, W14), each run twice and hash-compared: wild hunts and flees wild from tick 0, wild eats wild and keeps the
// meal, a mote in sight is grazed and one out of sight is not, and a flee sprint is the player's own, its cost spent
// from the growth first and the rest a wound (the lead's ruling on the #594 review). The "no player" rows keep the one player idle at the far side of the dish,
// out of every wild cell's sight; placing it vacates the seeded seats (docs/testing/scenario-runner.md §8.1).

import { describe, it } from 'vitest';
import { DEFAULT_BALANCE, DNA_TAGS, FOOD_KIND, radiusForMass, secondsToTicks, type Vec2 } from '@evolution/shared';
import { cellOf, progressOf, wildCellOf, wildSeatOf } from '../gameplay/evolution-views.js';
import type { EvolutionView } from '../gameplay/evolution-views.js';
import { player, targetPoint, type PlayerScript } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { wildRecoveryFactorPerTick } from '../../game/wild/wild-settle.js';
import { PROGRESS_TOLERANCE, absorption, detritusInDish } from './engulf-setups.js';
import { placedSolo } from './shared-setups.js';
import { PLACED_SEAT, WILD_RESPAWN_TICKS, absorbedThisTick, worldMassAtTick } from './wild-setups.js';

const { growth, controls } = DEFAULT_BALANCE;
const ONE_TICK = 1;
/** The idle player, out of every wild cell's sight: the "no player" rows. */
const FAR_SIDE: Vec2 = { x: -BROTH_POINT.x, y: 0 };
const OFFSET_TOLERANCE_WU = 0.01;
/** W7 wild variant: seat 2 at size 1.0 at the broth point, seat 1 at size 1.5 140 wu east of it. */
const W7_PREY_SEAT = 2;
const W7_HUNTER_SEAT = 1;
const W7_HUNTER_SIZE = 1.5;
const W7_GAP_WU = 140;
/** W12: seat 1 at size 2.0 at the broth point, seat 0 at size 1.0 10 wu east; ratio 2 → 1/45 a tick. */
const W12_PREDATOR_SEAT = 1;
const W12_PREDATOR_SIZE = 2;
const W12_PREY_EAST_WU = 10;
const W12_SEAL_TICK = 23;
const W12_PAYOUT_TICK = 45;
/** "Seat 1's mass = 41.50 + 0.8 × 20.75 = 58.10 (± 0.01)"; after 46, growth 16.5987 (± 0.0001), full 58.132 (± 0.001). */
const W12_MASS_AT_PAYOUT = 58.1;
const W12_GROWN_AFTER = 16.5987;
const W12_FULL_AFTER = 58.132;
const W12_DETRITUS_MASS = 4;
/** W13: an algae mote 290 wu east of seat 0 (sight 301.8 on tick 30); the variant 310 wu east. */
const W13_IN_SIGHT_WU = 290;
const W13_OUT_OF_SIGHT_WU = 310;
const W13_DECISION_TICK = 30;
/** W14: A at 400, seat 0 at size 10.0 100 wu east; A charges it through tick 30; the sprint costs 5 % of 205.00. */
const W14_PLAYER_MASS = 400;
const W14_SEAT_SIZE = 10;
const W14_SEAT_EAST_WU = 100;
/** W14's variant: A idle at the row's old 200 wu, whose own sprint cannot reach seat 0: no flee sprint. */
const W14_IDLE_THREAT_EAST_WU = 200;
const W14_DECISION_TICK = 30;
const W14_MASS_AFTER_SPRINT = 194.75;
const W14_SPENT = 10.25;
/** q = 1 − 1/360: the share of a wound still missing one tick later. */
const recoveryPerTick = wildRecoveryFactorPerTick(DEFAULT_BALANCE);
const W14_READ_TICK = 90;
const W14_LAST_TICK = 209;
const MASS_TOLERANCE = 0.01;
/** W14: A charges east at full throttle through tick 30, then stops (its target on its own centre). */
const W14_CHARGE_EAST_WU = 1000;
const holdStill: PlayerScript<unknown> = (context) =>
  context.cell === undefined ? null : { targetX: context.cell.x, targetY: context.cell.y };

const seatCell = (seat: number) => (view: EvolutionView) => wildCellOf(view, seat);
const seatTarget = (seat: number) => (view: EvolutionView) => {
  const record = wildSeatOf(view, seat);
  return record === undefined ? undefined : { x: record.targetX, y: record.targetY };
};

/** The one player idle at the far side; the rows place their wild cells at absolute points. */
function wildOnly(name: string) {
  return placedSolo(name).placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: FAR_SIDE });
}

describe('ecology/acceptance.md §8.1: what a wild cell notices', () => {
  it('W7 wild variant: seat 1 hunts seat 2 on tick 1, and seat 2 flees seat 1 on tick 2, neither sprinting', async () => {
    const hunterAt = { x: BROTH_POINT.x + W7_GAP_WU, y: BROTH_POINT.y };
    const preyRadiusOnTick2 = radiusForMass(worldMassAtTick(2), growth);
    const fleeX = BROTH_POINT.x - controls.STEER_FULL_THROTTLE_RADII * preyRadiusOnTick2;
    await wildOnly('W7 wild')
      .placeWildCell({ seat: W7_PREY_SEAT, sizeFactor: 1, at: BROTH_POINT })
      .placeWildCell({ seat: W7_HUNTER_SEAT, sizeFactor: W7_HUNTER_SIZE, at: hunterAt })
      .advance(2)
      .expect("seat 1 targets seat 2's centre on tick 1", seatTarget(W7_HUNTER_SEAT))
      .atTick(ONE_TICK)
      .toEqual({ x: BROTH_POINT.x, y: BROTH_POINT.y })
      .expect('seat 1 does not sprint (140 > 3 radii)', (view) => seatCell(W7_HUNTER_SEAT)(view)?.sprintRemainingTicks)
      .atTick(ONE_TICK)
      .toBe(0)
      .expect('seat 2 flees west on tick 2: its centre + (−1, 0) × 2 radii', seatTarget(W7_PREY_SEAT))
      .atTick(2)
      .toSatisfy(
        (target) =>
          target !== undefined &&
          Math.abs((target.x ?? Number.NaN) - fleeX) <= OFFSET_TOLERANCE_WU &&
          target.y === BROTH_POINT.y,
        `(${fleeX.toFixed(2)}, 0)`,
      )
      .expect('seat 2 does not sprint (> 4 radii)', (view) => seatCell(W7_PREY_SEAT)(view)?.sprintRemainingTicks)
      .atTick(2)
      .toBe(0)
      .runDeterministic();
  });

  it('W12: wild eats wild: seat 1 swallows seat 0 on tick 45, keeps the meal as growth, and pays nobody DNA', async () => {
    const preyAt = { x: BROTH_POINT.x + W12_PREY_EAST_WU, y: BROTH_POINT.y };
    await wildOnly('W12')
      .placeWildCell({ seat: W12_PREDATOR_SEAT, sizeFactor: W12_PREDATOR_SIZE, at: BROTH_POINT })
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: 1, at: preyAt })
      .advance(W12_PAYOUT_TICK + ONE_TICK)
      .expect(
        'the engulf starts on tick 1: one cover tick at 1/45',
        (view) => seatCell(PLACED_SEAT)(view)?.engulfProgress,
      )
      .atTick(ONE_TICK)
      .toBeCloseTo(1 / W12_PAYOUT_TICK, PROGRESS_TOLERANCE)
      .expect("seat 1's hunt targets seat 0's centre on tick 1 and does not sprint", (view) => [
        seatTarget(W12_PREDATOR_SEAT)(view),
        seatCell(W12_PREDATOR_SEAT)(view)?.sprintRemainingTicks,
      ])
      .atTick(ONE_TICK)
      .toEqual([preyAt, 0])
      .expect('seat 0 sealed on tick 23', (view) => seatCell(PLACED_SEAT)(view)?.engulfProgress)
      .atTick(W12_SEAL_TICK)
      .toBeAtLeast(absorption.ENGULF_SEAL_PROGRESS)
      .expect("seat 0's cell absorbed on tick 45 with no player", (view) => absorbedThisTick(view))
      .atTick(W12_PAYOUT_TICK)
      .toSatisfy(
        (absorbed) => absorbed.length === 1 && absorbed[0]![1] === null,
        'one cell_absorbed with playerId null',
      )
      .expect("seat 1's mass = 41.50 + 0.8 × 20.75", (view) => seatCell(W12_PREDATOR_SEAT)(view)?.mass)
      .atTick(W12_PAYOUT_TICK)
      .toBeCloseTo(W12_MASS_AT_PAYOUT, MASS_TOLERANCE)
      .expect('detritus 2 motes = 4 mass', detritusInDish)
      .atTick(W12_PAYOUT_TICK)
      .toBe(W12_DETRITUS_MASS)
      .expect('seat 0 vacant, respawnInTicks 600', (view) => [
        wildSeatOf(view, PLACED_SEAT)?.cellId,
        wildSeatOf(view, PLACED_SEAT)?.respawnInTicks,
      ])
      .atTick(W12_PAYOUT_TICK)
      .toEqual([null, WILD_RESPAWN_TICKS])
      .expect('no DNA, tag points or score to the player', (view) => {
        const progress = progressOf(view, 0);
        const tags = DNA_TAGS.reduce((sum, tag) => sum + (progress?.dnaTagPoints[tag] ?? 0), 0);
        return [progress?.dnaCumulative, tags, progress?.score, progress?.wildAbsorptions];
      })
      .atTick(W12_PAYOUT_TICK)
      .toEqual([0, 0, 0, 0])
      .expect(
        "seat 1's grownMass = 16.6 − 38.1 × D after tick 46",
        (view) => wildSeatOf(view, W12_PREDATOR_SEAT)?.grownMass,
      )
      .atTick(W12_PAYOUT_TICK + ONE_TICK)
      .toBeCloseTo(W12_GROWN_AFTER, MASS_TOLERANCE / 100)
      .expect(
        "seat 1's fullMass = 2 × (20 + 46/60) + 16.5987 after tick 46",
        (view) => wildSeatOf(view, W12_PREDATOR_SEAT)?.fullMass,
      )
      .atTick(W12_PAYOUT_TICK + ONE_TICK)
      .toBeCloseTo(W12_FULL_AFTER, MASS_TOLERANCE / 10)
      .runDeterministic();
  });

  it('W13: seat 0 grazes the algae mote in sight on tick 30, and wanders when the mote is just out of sight', async () => {
    const graze = (name: string, eastWu: number) =>
      wildOnly(name)
        .placeWildCell({ seat: PLACED_SEAT, sizeFactor: 1, at: BROTH_POINT })
        .placeMote({ moteKind: FOOD_KIND.algae, at: { x: BROTH_POINT.x + eastWu, y: BROTH_POINT.y } })
        .advance(W13_DECISION_TICK);
    await graze('W13', W13_IN_SIGHT_WU)
      .expect("seat 0's target is the mote's centre", seatTarget(PLACED_SEAT))
      .atTick(W13_DECISION_TICK)
      .toEqual({ x: BROTH_POINT.x + W13_IN_SIGHT_WU, y: BROTH_POINT.y })
      .expect('no sprint', (view) => seatCell(PLACED_SEAT)(view)?.sprintRemainingTicks)
      .atTick(W13_DECISION_TICK)
      .toBe(0)
      .runDeterministic();
    await graze('W13 out of sight', W13_OUT_OF_SIGHT_WU)
      .expect('a wander target, never the mote', seatTarget(PLACED_SEAT))
      .atTick(W13_DECISION_TICK)
      .toSatisfy(
        (target) => target !== undefined && target.x !== null && target.x !== BROTH_POINT.x + W13_OUT_OF_SIGHT_WU,
        'a target that is not the mote',
      )
      .runDeterministic();
  });

  it('W14: seat 0 flees a charging A and sprints on tick 30; with no growth to spend, the cost is a wound that recovers', async () => {
    const seatMass = (view: EvolutionView) => seatCell(PLACED_SEAT)(view)?.mass;
    const deficit = (view: EvolutionView) => {
      const seat = wildSeatOf(view, PLACED_SEAT);
      const mass = seatMass(view);
      return seat === undefined || mass === undefined ? undefined : seat.fullMass - mass;
    };
    await placedSolo('W14')
      .placeCell({ playerIndex: 0, mass: W14_PLAYER_MASS })
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: W14_SEAT_SIZE, eastOfFirstCellWu: W14_SEAT_EAST_WU })
      .between(
        ONE_TICK,
        W14_DECISION_TICK,
        player(0).does(targetPoint(BROTH_POINT.x + W14_CHARGE_EAST_WU, BROTH_POINT.y)),
      )
      .atTick(W14_DECISION_TICK + ONE_TICK, player(0).does(holdStill))
      .advance(W14_LAST_TICK)
      .expect("the sprint starts on tick 30 as a player's: both counters one tick down at the end of it", (view) => [
        seatCell(PLACED_SEAT)(view)?.sprintRemainingTicks,
        seatCell(PLACED_SEAT)(view)?.sprintCooldownRemainingTicks,
      ])
      .atTick(W14_DECISION_TICK)
      .toEqual([
        secondsToTicks(controls.SPRINT_DURATION_SECONDS) - ONE_TICK,
        secondsToTicks(controls.SPRINT_COOLDOWN_SECONDS) - ONE_TICK,
      ])
      .expect('mass 205.00 − 5 % = 194.75', seatMass)
      .atTick(W14_DECISION_TICK)
      .toBeCloseTo(W14_MASS_AFTER_SPRINT, MASS_TOLERANCE)
      .expect('deficit 10.25 × q^60 = 8.67 after tick 90: the cost below the base recovers like a wound', deficit)
      .atTick(W14_READ_TICK)
      .toBeCloseTo(W14_SPENT * recoveryPerTick ** (W14_READ_TICK - W14_DECISION_TICK), MASS_TOLERANCE)
      .expect('grownMass 0: it had no growth to spend', (view) => wildSeatOf(view, PLACED_SEAT)?.grownMass)
      .atTick(W14_READ_TICK)
      .toBe(0)
      .expect('deficit 10.25 × q^179 after tick 209: it sprinted exactly once (the cooldown runs to tick 210)', deficit)
      .atTick(W14_LAST_TICK)
      .toBeCloseTo(W14_SPENT * recoveryPerTick ** (W14_LAST_TICK - W14_DECISION_TICK), MASS_TOLERANCE)
      .expect('A still alive and idle', (view) => cellOf(view, 0) !== undefined)
      .atTick(W14_LAST_TICK)
      .toBe(true)
      .runDeterministic();
    await placedSolo('W14 idle threat')
      .placeCell({ playerIndex: 0, mass: W14_PLAYER_MASS })
      .placeWildCell({ seat: PLACED_SEAT, sizeFactor: W14_SEAT_SIZE, eastOfFirstCellWu: W14_IDLE_THREAT_EAST_WU })
      .advance(W14_DECISION_TICK)
      .expect('an idle A 200 wu off cannot reach seat 0 on its own sprint: it flees at normal speed', (view) => [
        seatTarget(PLACED_SEAT)(view)?.x !== null,
        seatCell(PLACED_SEAT)(view)?.sprintRemainingTicks,
      ])
      .atTick(W14_DECISION_TICK)
      .toEqual([true, 0])
      .runDeterministic();
  });
});
