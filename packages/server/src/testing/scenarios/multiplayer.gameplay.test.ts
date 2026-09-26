// The multiplayer events of #199 that no design-table row covers, each run twice and hash-compared: a player leaving
// the room mid-engulf on either side (ecology/absorption.md §6.3), two bots charging each other (ecology/mass-and-movement.md
// §5.3) and a seeded bot playthrough of hunters and foragers held to the dish's invariants (`playthrough-invariants.ts`).
// The other #199 events are table rows already: respawn is G8 and G8b (game-design-session.gameplay.test.ts,
// respawn-input.gameplay.test.ts) and T12 (traits-death.gameplay.test.ts); the late join with the entry floor is P7, P8,
// G9 and G14 (progression.gameplay.test.ts, game-design-session.gameplay.test.ts).

import { describe, it } from 'vitest';
import {
  CELL_KIND,
  DEFAULT_BALANCE,
  ENGULF_RELEASE_REASON,
  PLAYER_LIFE_STATE,
  TICK_HZ,
  TICK_INTERVAL_S,
} from '@evolution/shared';
import { createStrategyByName } from '../../game/bots/strategy-catalog.js';
import { BOT_STRATEGY_NAME } from '../../game/bots/strategy-constants.js';
import {
  PLACED_ROW_SEED,
  TABLE_SEED,
  evolutionAdapter,
  evolutionScenario as scenario,
  type EvolutionScenarioSnapshot,
} from '../gameplay/evolution-adapter.js';
import { cellOf, massOf, progressOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { createScriptedStrategy, type PlayerScript } from '../gameplay/index.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import {
  E9_PAYOUT_MASS,
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  ENGULF_SEAL_PROGRESS,
  PREY_MASS,
  PROGRESS_TOLERANCE,
  absorbedCellIds,
  absorptionsOfPredator,
  detritusInDish,
  dnaOfPredator,
  engulfPair,
  lifeStateOfPrey,
  overlapOfPair,
  progressOfPrey,
  releaseReasons,
  statesOfPredator,
  statesOfPrey,
} from './engulf-setups.js';
import { playthroughViolations } from './playthrough-invariants.js';
import { FULL_THROTTLE_RADII, MASS_TOLERANCE, decayed, expectedDetritusMass } from './shared-setups.js';

const { growth } = DEFAULT_BALANCE;
/** Two ticks after E9's seal and well before its payout: the engulf is past the point the prey can swim out of. */
const LEAVE_TICK = E9_SEAL_TICK + 2;
/** Past E9's payout tick, so a payout the leave failed to cancel would have landed. */
const LEAVE_RUN_TICKS = E9_PAYOUT_TICK + 1;
/** A released prey stays where it is: the carried centre, to the float noise of one idle step. */
const RELEASED_CENTRE_TOLERANCE_WU = 1e-9;

/** Two protocells of equal mass (ratio 1, under every engulf ratio), 100 wu apart on the broth line. */
const CHARGER_MASS = growth.CELL_STARTING_MASS;
const CHARGER_GAP_WU = 100;
const COLLISION_TICKS = 3 * TICK_HZ;
/** The pair is symmetric: the midpoint of the centres never moves. */
const MIDPOINT_TOLERANCE_WU = 1e-6;
/**
 * The deepest overlap two cells closing at full speed can hold (ecology/mass-and-movement.md §5.3): each tick the pair
 * closes by at most twice `CELL_BASE_SPEED` × the tick, then separation removes `CELL_SEPARATION_FRACTION_PER_TICK`
 * of the overlap, so it settles where `f × (overlap + closing) = closing`: `(1 − f) × closing / f`.
 */
const SEPARATION_FRACTION = growth.CELL_SEPARATION_FRACTION_PER_TICK;
const MAX_CLOSING_PER_TICK_WU = 2 * growth.CELL_BASE_SPEED * TICK_INTERVAL_S;
const CHARGE_OVERLAP_BOUND_WU = ((1 - SEPARATION_FRACTION) * MAX_CLOSING_PER_TICK_WU) / SEPARATION_FRACTION;

/** Two hunters and two foragers in the seeded world for three minutes: the #376 predation bench's cast, one room. */
const PLAYTHROUGH_ROLES = [
  BOT_STRATEGY_NAME.hunter,
  BOT_STRATEGY_NAME.hunter,
  BOT_STRATEGY_NAME.forager,
  BOT_STRATEGY_NAME.forager,
] as const;
const PLAYTHROUGH_INDICES = [...PLAYTHROUGH_ROLES.keys()];
const PLAYTHROUGH_TICKS = 3 * 60 * TICK_HZ;
const INVARIANT_EVERY_TICKS = 10;

/** "Charges the other player": full throttle through the other player's centre, re-aimed every tick. */
const chargeTheOtherPlayer: PlayerScript<EvolutionScenarioSnapshot> = (context) => {
  const self = context.cell;
  const other = context.snapshot.cells.find(
    (cell) => cell.kind === CELL_KIND.player && cell.playerId !== context.actorId,
  );
  if (self === undefined || other === undefined) {
    return null;
  }
  const distance = Math.hypot(other.x - self.x, other.y - self.y);
  const reach = (FULL_THROTTLE_RADII * self.radius) / distance;
  return { targetX: self.x + (other.x - self.x) * reach, targetY: self.y + (other.y - self.y) * reach };
};
const createCharger = createScriptedStrategy('charger', chargeTheOtherPlayer);

/** Two protocells at the starting mass, `CHARGER_GAP_WU` apart on the broth line, each charging the other every tick. */
function chargingPair(name: string) {
  return scenario(name)
    .seed(PLACED_ROW_SEED)
    .players(2)
    .placeCell({ playerIndex: 0, mass: CHARGER_MASS })
    .placeCell({ playerIndex: 1, mass: CHARGER_MASS, eastOfFirstCellWu: CHARGER_GAP_WU })
    .bot(0, createCharger)
    .bot(1, createCharger)
    .advance(COLLISION_TICKS);
}

/**
 * How far the detritus on the leave tick misses the share the leaver's mass drops (docs/ecology/food-and-spawn.md §1):
 * what still lies in the dish plus what the survivor ate of it on that tick (eating is step 4 and decay step 5, so its
 * gain over one tick of decay), less `expectedDetritusMass` of the leaver's mass the tick before. 0 when all of it
 * is accounted for.
 */
function detritusMissing(view: EvolutionView, survivorIndex: number): number | undefined {
  const mass = massOf(view, survivorIndex);
  const survivorMassBefore = view.captured('survivor mass before the leave') as number | undefined;
  const leaverMassBefore = view.captured('leaver mass before the leave') as number | undefined;
  if (mass === undefined || survivorMassBefore === undefined || leaverMassBefore === undefined) {
    return undefined;
  }
  const eaten = mass - decayed(survivorMassBefore, 1);
  return expectedDetritusMass(leaverMassBefore) - (detritusInDish(view) + eaten);
}

function centreOf(view: EvolutionView, playerIndex: number): { x: number; y: number } | undefined {
  const cell = cellOf(view, playerIndex);
  return cell === undefined ? undefined : { x: cell.x, y: cell.y };
}

describe('ecology/absorption.md §6.3: a player leaves the room mid-engulf (#199)', () => {
  it('the prey leaves after the seal: its engulf aborts, it drops detritus, and the predator is paid nothing', async () => {
    await engulfPair('leave mid-engulf: prey')
      .playerLeavesAt(LEAVE_TICK, 1)
      .advance(LEAVE_RUN_TICKS)
      .capture('leaver mass before the leave', (view) => massOf(view, 1))
      .atTick(LEAVE_TICK - 1)
      .capture('survivor mass before the leave', (view) => massOf(view, 0))
      .atTick(LEAVE_TICK - 1)
      .expect('sealed before the leave', progressOfPrey)
      .atTick(LEAVE_TICK - 1)
      .toBeGreaterThan(ENGULF_SEAL_PROGRESS)
      .expect('the engulf aborts on the leave', releaseReasons)
      .atTick(LEAVE_TICK)
      .toEqual([ENGULF_RELEASE_REASON.aborted])
      .expect('the predator is free', statesOfPredator)
      .atTick(LEAVE_TICK)
      .toEqual([])
      .expect('the prey is gone', (view) => cellOf(view, 1))
      .atTick(LEAVE_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('the prey dropped the rounded share of its mass as detritus', (view) => detritusMissing(view, 0))
      .atTick(LEAVE_TICK)
      .toBeCloseTo(0, MASS_TOLERANCE)
      .expect('no absorption on the payout tick', absorbedCellIds)
      .atTick(E9_PAYOUT_TICK)
      .toEqual([])
      .expect('A absorptions = 0', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .expect('A earned no DNA', dnaOfPredator)
      .atEnd()
      .toBe(0)
      .expect("A never reaches E9's payout mass", (view) => massOf(view, 0))
      .atEnd()
      .toBeLessThan(E9_PAYOUT_MASS)
      .runDeterministic();
  });

  it('the predator leaves after the seal: the prey is released where it is and plays on', async () => {
    await engulfPair('leave mid-engulf: predator')
      .playerLeavesAt(LEAVE_TICK, 0)
      .advance(LEAVE_RUN_TICKS)
      .capture('carried centre', (view) => centreOf(view, 1))
      .atTick(LEAVE_TICK - 1)
      .capture('leaver mass before the leave', (view) => massOf(view, 0))
      .atTick(LEAVE_TICK - 1)
      .capture('survivor mass before the leave', (view) => massOf(view, 1))
      .atTick(LEAVE_TICK - 1)
      .expect('sealed before the leave', progressOfPrey)
      .atTick(LEAVE_TICK - 1)
      .toBeGreaterThan(ENGULF_SEAL_PROGRESS)
      .expect('the engulf aborts on the leave', releaseReasons)
      .atTick(LEAVE_TICK)
      .toEqual([ENGULF_RELEASE_REASON.aborted])
      .expect('the prey is free with no progress', (view) => [statesOfPrey(view), progressOfPrey(view)])
      .atTick(LEAVE_TICK)
      .toEqual([[], 0])
      .expect('released at its carried centre', (view) => {
        const carried = view.captured('carried centre') as { x: number; y: number };
        const centre = centreOf(view, 1);
        return centre === undefined ? undefined : Math.hypot(centre.x - carried.x, centre.y - carried.y);
      })
      .atTick(LEAVE_TICK)
      .toBeCloseTo(0, RELEASED_CENTRE_TOLERANCE_WU)
      .expect('the predator is gone', (view) => cellOf(view, 0))
      .atTick(LEAVE_TICK)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('B is alive past the payout tick', lifeStateOfPrey)
      .atEnd()
      .toBe(PLAYER_LIFE_STATE.alive)
      .expect('the predator dropped the rounded share of its mass as detritus', (view) => detritusMissing(view, 1))
      .atTick(LEAVE_TICK)
      .toBeCloseTo(0, MASS_TOLERANCE)
      .expect('B kept its mass: nothing was taken from it', (view) => massOf(view, 1))
      .atEnd()
      .toBeAtLeast(PREY_MASS)
      .expect('B still at progress 0', progressOfPrey)
      .atEnd()
      .toBeCloseTo(0, PROGRESS_TOLERANCE)
      .runDeterministic();
  });
});

describe('ecology/mass-and-movement.md §5.3: two bots colliding (#199)', () => {
  it('two equal cells charging each other only push apart: no engulf, no mass moves, the overlap stays bounded', async () => {
    const run = chargingPair('two chargers');
    for (let tick = 1; tick <= COLLISION_TICKS; tick += 1) {
      run
        .expect(`overlap on tick ${tick}`, overlapOfPair)
        .atTick(tick)
        .toBeAtMost(CHARGE_OVERLAP_BOUND_WU)
        .expect(`no engulf state on tick ${tick}`, (view) => [statesOfPredator(view), statesOfPrey(view)])
        .atTick(tick)
        .toEqual([[], []]);
    }
    await run
      .expect('they are in contact', overlapOfPair)
      .atEnd()
      .toBeGreaterThan(0)
      .expect('the midpoint never moved', (view) => ((cellOf(view, 0)?.x ?? 0) + (cellOf(view, 1)?.x ?? 0)) / 2)
      .atEnd()
      .toBeCloseTo(BROTH_POINT.x + CHARGER_GAP_WU / 2, MIDPOINT_TOLERANCE_WU)
      .expect('A kept its mass', (view) => massOf(view, 0))
      .atEnd()
      .toBeCloseTo(decayed(CHARGER_MASS, COLLISION_TICKS), MASS_TOLERANCE)
      .expect('B kept its mass', (view) => massOf(view, 1))
      .atEnd()
      .toBeCloseTo(decayed(CHARGER_MASS, COLLISION_TICKS), MASS_TOLERANCE)
      .runDeterministic();
  });

  // Known failure, ticket #709: two protocells at the starting mass charging head-on pass
  // through each other on tick 59. Separation runs once per tick after the move, so it holds the pair at
  // `CHARGE_OVERLAP_BOUND_WU` deep; the pair still closes `MAX_CLOSING_PER_TICK_WU` a tick, and once that is at least the
  // centre gap left (closing / f ≥ the sum of the radii: 36.7 ≥ 35.8 wu here) the move crosses the centres and the
  // separation pushes them out the far side. absorption.md §6.3: "Near-equal cells only push apart (§5.3)".
  it.fails('two equal cells charging each other never pass through each other', async () => {
    const run = chargingPair('two chargers pass through');
    for (let tick = 1; tick <= COLLISION_TICKS; tick += 1) {
      run
        .expect(`A still west of B on tick ${tick}`, (view) => (cellOf(view, 1)?.x ?? 0) - (cellOf(view, 0)?.x ?? 0))
        .atTick(tick)
        .toBeGreaterThan(0);
    }
    await run.runDeterministic();
  });
});

describe('seeded bot playthrough (#199)', () => {
  it('two hunters and two foragers play three minutes of the seeded world with every invariant holding', async () => {
    const run = scenario('bot playthrough').seed(TABLE_SEED).players(PLAYTHROUGH_ROLES.length);
    PLAYTHROUGH_ROLES.forEach((role, index) => {
      run.bot(index, createStrategyByName(role, evolutionAdapter.perception));
    });
    run.advance(PLAYTHROUGH_TICKS);
    for (let tick = INVARIANT_EVERY_TICKS; tick <= PLAYTHROUGH_TICKS; tick += INVARIANT_EVERY_TICKS) {
      run
        .expect(`the dish is sound on tick ${tick}`, (view) => playthroughViolations(view, DEFAULT_BALANCE))
        .atTick(tick)
        .toEqual([]);
    }
    await run
      .expect('the bots ate: every bot gained DNA', (view) =>
        PLAYTHROUGH_INDICES.map((index) => progressOf(view, index)?.dnaCumulative ?? 0),
      )
      .atEnd()
      .toSatisfy((dna) => (dna as number[]).every((value) => value > 0), 'every bot above 0 DNA')
      .expect('at least one cell was eaten by a bot: the engulf invariants were exercised', (view) =>
        PLAYTHROUGH_INDICES.reduce((eaten, index) => {
          const progress = progressOf(view, index);
          return eaten + (progress?.absorptions ?? 0) + (progress?.wildAbsorptions ?? 0);
        }, 0),
      )
      .atEnd()
      .toBeAtLeast(1)
      .runDeterministic();
  });
});
