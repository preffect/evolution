// docs/ecology/acceptance.md §8.2, the giants' lifecycle rows of slice 2 (giants.md §3.5.17): G9 (a player swallows
// a giant: the DNA bonus, the fact's effect field, the 90 s respawn), G11 (the ceiling a giant's growth stops at) and
// G12 (the die-off never counts a giant), each run twice and hash-compared. G1 is a world-creation row on a patched
// balance (`wild/giant-seats.test.ts`), G8 the pure speed row (`wild/giant-build.test.ts`); G9's tick-21 600 variant
// is pinned on the payout itself (`simulation/engulf-payout-giants.test.ts`), sparing a 21 600-tick seeded preamble.
// The placed rows run on seed 48 (docs/testing/scenario-runner.md §8.1); the "no player" rows keep the one player idle
// away from every placed cell. A placed giant decides first on its seat's tick (24, 25, 26), so the rows that end
// sooner see it sit where it is put; its minds are ecology-giant-minds and ecology-giant-diet.

import { describe, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DNA_TAG,
  EFFECT_KIND,
  ENGULF_SEAL_PROGRESS,
  GIANT_SPECIES,
  TICK_HZ,
  distanceBetween,
  type Vec2,
} from '@evolution/shared';
import { giantBuildOf } from '../../game/wild/giant-build.js';
import {
  cellOf,
  detritusMass,
  effectsOfKind,
  giantCellOf,
  giantSeatOf,
  massOf,
  progressOf,
  wildCellOf,
  wildSeatOf,
  type EvolutionView,
} from '../gameplay/evolution-views.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { absorption } from './engulf-setups.js';
import { MASS_TOLERANCE, decayed, expectedDetritusMass, placedSolo } from './shared-setups.js';
import { PLACED_SEAT, worldMassAtTick } from './wild-setups.js';

const { ecology, giants, growth, wildCells } = DEFAULT_BALANCE;
const ONE_TICK = 1;
const AMOEBA = GIANT_SPECIES.amoeba;
/** Where the "no player" rows keep their idle player: clear of every placed cell. */
const IDLE_CORNER: Vec2 = { x: -1500, y: 1500 };
const GIANT_RESPAWN_TICKS = giants.GIANT_RESPAWN_SECONDS * TICK_HZ;

/**
 * G9: A at 2 000, the amoeba born 1 000 10 wu east: ratio 2 at placement, 1/45 a tick, but A decays from tick 1 (the
 * amoeba, with no growth, does not), so the rate falls just under 1/45: sealed on 23, paid out on 46, not 45.
 */
const G9_PREDATOR_MASS = 2000;
const G9_AMOEBA_BORN_MASS = 1000;
const G9_CENTRE_DISTANCE_WU = 10;
const G9_SEAL_TICK = 23;
const G9_PAYOUT_TICK = 46;
const G9_PAYOUT_MASS = decayed(G9_PREDATOR_MASS, G9_PAYOUT_TICK) + G9_AMOEBA_BORN_MASS * absorption.ENGULF_MASS_YIELD;
/** The wild count (W4): vacated on 46, `respawnInTicks` 5 400, alive again on the tick after it reaches zero. */
const G9_RESPAWN_TICK = G9_PAYOUT_TICK + GIANT_RESPAWN_TICKS + ONE_TICK;
const NUCLEOID_I = DEFAULT_BALANCE.traits.TRAIT_TIERS.nucleoid[0]!.dnaGainMultiplier!;

/**
 * G11: the amoeba born 1 400 eats seat 0 at size 20 (400 + t/3) on tick 33, then settles at the ceiling on tick 34.
 * Step 4 skips the hunter (giants.md §3.5.7), so the prey's detritus, which lands inside it, stays in the dish.
 */
const G11_AMOEBA_BORN_MASS = 1400;
const G11_SEAT_SIZE = 20;
const G11_PAYOUT_TICK = 33;
const G11_PREY_MASS = G11_SEAT_SIZE * worldMassAtTick(G11_PAYOUT_TICK);
const G11_CEILING_GROWTH = giants.GIANT_MASS_CEILING - G11_AMOEBA_BORN_MASS;

/** G12: three giants (3 400 with seat 0) against a 720 budget; seat 0 at 30 (600, under) or 40 (800, over). */
const G12_UNDER_SIZE = 30;
const G12_OVER_SIZE = 40;
const G12_READ_TICK = 60;
const G12_GIANTS = [
  { species: GIANT_SPECIES.amoeba, bornMass: 900, at: { x: 1500, y: 0 } },
  { species: GIANT_SPECIES.paramecium, bornMass: 900, at: { x: 0, y: 1500 } },
  { species: GIANT_SPECIES.diatom, bornMass: 1000, at: { x: 0, y: -1500 } },
] as const;
const G12_SEAT_AT: Vec2 = { x: -1500, y: 0 };
const LEFT_PER_TICK = 1 - wildCells.WILD_CELL_STARVATION_FRACTION_PER_SECOND / TICK_HZ;

const amoebaProgress = (view: EvolutionView) => giantCellOf(view, AMOEBA)?.engulfProgress;
const giantsStarving = (view: EvolutionView) => G12_GIANTS.map(({ species }) => giantCellOf(view, species)?.isStarving);
const giantMasses = (view: EvolutionView) => G12_GIANTS.map(({ species }) => giantCellOf(view, species)?.mass);

function placedG9(name: string, traits: readonly string[] = []) {
  return placedSolo(name)
    .placeCell({ playerIndex: 0, mass: G9_PREDATOR_MASS, traits })
    .placeGiant({ species: AMOEBA, bornMass: G9_AMOEBA_BORN_MASS, eastOfFirstCellWu: G9_CENTRE_DISTANCE_WU });
}

function placedG12(name: string, seatSize: number) {
  let builder = placedSolo(name)
    .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: IDLE_CORNER })
    .placeWildCell({ seat: PLACED_SEAT, sizeFactor: seatSize, at: G12_SEAT_AT });
  for (const giant of G12_GIANTS) {
    builder = builder.placeGiant(giant);
  }
  return builder.advance(G12_READ_TICK);
}

describe('ecology/acceptance.md §8.2: the giants seated, eaten and respawned', () => {
  it('G9: A swallows the amoeba on tick 46 for the 200 DNA bonus, and the amoeba is back 90 s later', async () => {
    await placedG9('G9')
      .advance(G9_RESPAWN_TICK)
      .capture('amoeba cell id', (view) => giantCellOf(view, AMOEBA)?.id)
      .atTick(0)
      .expect('not sealed on tick 22', amoebaProgress)
      .atTick(G9_SEAL_TICK - ONE_TICK)
      .toBeLessThan(ENGULF_SEAL_PROGRESS)
      .expect('sealed on tick 23, before its first decision on tick 24', amoebaProgress)
      .atTick(G9_SEAL_TICK)
      .toBeGreaterThan(ENGULF_SEAL_PROGRESS)
      .expect('not paid out on tick 45', (view) => progressOf(view, 0)?.wildAbsorptions)
      .atTick(G9_PAYOUT_TICK - ONE_TICK)
      .toBe(0)
      .expect('A mass = decayed(2000, 46) + 0.8 × 1000', (view) => massOf(view, 0))
      .atTick(G9_PAYOUT_TICK)
      .toBeCloseTo(G9_PAYOUT_MASS, MASS_TOLERANCE)
      .expect('A DNA = 200 exactly: no base, no share', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(G9_PAYOUT_TICK)
      .toBe(giants.GIANT_DNA_BONUS)
      .expect('predatory + 10', (view) => progressOf(view, 0)?.dnaTagPoints[DNA_TAG.predatory])
      .atTick(G9_PAYOUT_TICK)
      .toBe(absorption.ENGULF_PREDATORY_TAG_POINTS)
      .expect('wildAbsorptions 1, absorptions 0', (view) => [
        progressOf(view, 0)?.wildAbsorptions,
        progressOf(view, 0)?.absorptions,
      ])
      .atTick(G9_PAYOUT_TICK)
      .toEqual([1, 0])
      .expect('score + 200', (view) => progressOf(view, 0)?.score)
      .atTick(G9_PAYOUT_TICK)
      .toBe(giants.GIANT_DNA_BONUS)
      .expect('cell_absorbed: no prey player, 200 DNA, the amoeba species', (view) =>
        effectsOfKind(view, EFFECT_KIND.cellAbsorbed).map((effect) => [
          effect.cellId === view.captured('amoeba cell id'),
          effect.playerId,
          effect.predatorDnaGained,
          effect.preyGiantSpecies,
        ]),
      )
      .atTick(G9_PAYOUT_TICK)
      .toEqual([[true, null, giants.GIANT_DNA_BONUS, AMOEBA]])
      .expect('the seat counts down 5 400 ticks', (view) => [
        giantSeatOf(view, AMOEBA)?.cellId,
        giantSeatOf(view, AMOEBA)?.respawnInTicks,
      ])
      .atTick(G9_PAYOUT_TICK)
      .toEqual([null, GIANT_RESPAWN_TICKS])
      .expect('still vacant the tick before', (view) => giantSeatOf(view, AMOEBA)?.cellId)
      .atTick(G9_RESPAWN_TICK - ONE_TICK)
      .toBeNull()
      .expect('a new amoeba: a born mass in [900, 1500)', (view) => giantCellOf(view, AMOEBA)?.mass)
      .atTick(G9_RESPAWN_TICK)
      .toSatisfy(
        (mass) =>
          mass !== undefined &&
          mass >= giants.GIANT_BORN_MASS_MIN_BY_SPECIES.giant_amoeba &&
          mass < giants.GIANT_BORN_MASS_MAX_BY_SPECIES.giant_amoeba,
        'within the amoeba range',
      )
      .expect('no growth', (view) => giantSeatOf(view, AMOEBA)?.grownMass)
      .atTick(G9_RESPAWN_TICK)
      .toBe(0)
      .expect('its build', (view) => giantCellOf(view, AMOEBA)?.traits)
      .atTick(G9_RESPAWN_TICK)
      .toEqual(giantBuildOf(AMOEBA, DEFAULT_BALANCE))
      .expect('at least 1 500 wu from A', (view) => {
        const amoeba = giantCellOf(view, AMOEBA);
        const eater = cellOf(view, 0);
        return amoeba === undefined || eater === undefined ? undefined : distanceBetween(amoeba, eater);
      })
      .atTick(G9_RESPAWN_TICK)
      .toBeGreaterThan(giants.GIANT_MIN_PLAYER_DISTANCE_WU)
      .runDeterministic();
  });

  it("G9 (Nucleoid I): the bonus goes through the eater's gain multiplier, 210", async () => {
    await placedG9('G9 Nucleoid I', ['nucleoid'])
      .advance(G9_PAYOUT_TICK)
      .expect('A DNA = 200 × 1.05', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(G9_PAYOUT_TICK)
      .toBeCloseTo(giants.GIANT_DNA_BONUS * NUCLEOID_I, MASS_TOLERANCE)
      .runDeterministic();
  });

  it('G11: the amoeba swallows a 411 wild cell on tick 33 and keeps only what fits under the 1 500 ceiling', async () => {
    await placedSolo('G11')
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: IDLE_CORNER })
      .placeGiant({ species: AMOEBA, bornMass: G11_AMOEBA_BORN_MASS, at: BROTH_POINT })
      .placeWildCell({
        seat: PLACED_SEAT,
        sizeFactor: G11_SEAT_SIZE,
        at: { x: BROTH_POINT.x + G9_CENTRE_DISTANCE_WU, y: BROTH_POINT.y },
      })
      .advance(G11_PAYOUT_TICK + ONE_TICK)
      .expect('seat 0 still there the tick before', (view) => wildCellOf(view, PLACED_SEAT)?.mass)
      .atTick(G11_PAYOUT_TICK - ONE_TICK)
      .toBeCloseTo(G11_SEAT_SIZE * worldMassAtTick(G11_PAYOUT_TICK - ONE_TICK), MASS_TOLERANCE)
      .expect('seat 0 absorbed on tick 33', (view) => wildSeatOf(view, PLACED_SEAT)?.cellId)
      .atTick(G11_PAYOUT_TICK)
      .toBeNull()
      .expect('the amoeba = 1400 + 0.8 × 411', (view) => giantCellOf(view, AMOEBA)?.mass)
      .atTick(G11_PAYOUT_TICK)
      .toBeCloseTo(G11_AMOEBA_BORN_MASS + G11_PREY_MASS * absorption.ENGULF_MASS_YIELD, MASS_TOLERANCE)
      .expect('after tick 34: fullMass 1500, grownMass 100, mass 1500 (the meal past the ceiling lost)', (view) => [
        giantSeatOf(view, AMOEBA)?.fullMass,
        giantSeatOf(view, AMOEBA)?.grownMass,
        giantCellOf(view, AMOEBA)?.mass,
      ])
      .atTick(G11_PAYOUT_TICK + ONE_TICK)
      .toEqual([giants.GIANT_MASS_CEILING, G11_CEILING_GROWTH, giants.GIANT_MASS_CEILING])
      .expect('the detritus inside it not eaten', (view) => detritusMass(view, ecology.DETRITUS_MOTE_MASS))
      .atTick(G11_PAYOUT_TICK + ONE_TICK)
      .toBe(expectedDetritusMass(G11_PREY_MASS))
      .expect('no DNA, tag points or score to anyone', (view) => [
        progressOf(view, 0)?.dnaCumulative,
        progressOf(view, 0)?.dnaTagPoints[DNA_TAG.predatory],
        progressOf(view, 0)?.score,
      ])
      .atTick(G11_PAYOUT_TICK + ONE_TICK)
      .toEqual([0, 0, 0])
      .runDeterministic();
  });

  it('G12: three giants never count toward the budget: seat 0 at 600 never starves, nor does any giant', async () => {
    await placedG12('G12', G12_UNDER_SIZE)
      .expect('seat 0 not starving', (view) => wildSeatOf(view, PLACED_SEAT)?.isStarving)
      .atTick(ONE_TICK)
      .toBe(false)
      .expect('seat 0 still not starving at tick 60', (view) => wildSeatOf(view, PLACED_SEAT)?.isStarving)
      .atTick(G12_READ_TICK)
      .toBe(false)
      .expect('no giant starving', giantsStarving)
      .atTick(G12_READ_TICK)
      .toEqual([false, false, false])
      .expect('every giant at its born mass', giantMasses)
      .atTick(G12_READ_TICK)
      .toEqual(G12_GIANTS.map(({ bornMass }) => bornMass))
      .runDeterministic();
  });

  it('G12 (seat 0 at 800): seat 0 starves from tick 1 as in W15, and no giant ever does', async () => {
    await placedG12('G12 over', G12_OVER_SIZE)
      .expect('seat 0 starving after tick 1', (view) => wildSeatOf(view, PLACED_SEAT)?.isStarving)
      .atTick(ONE_TICK)
      .toBe(true)
      .expect('mass = 40 × 20.0167 × (1 − 1/600)', (view) => wildCellOf(view, PLACED_SEAT)?.mass)
      .atTick(ONE_TICK)
      .toBeCloseTo(G12_OVER_SIZE * worldMassAtTick(ONE_TICK) * LEFT_PER_TICK, MASS_TOLERANCE)
      .expect('no giant starving', giantsStarving)
      .atTick(G12_READ_TICK)
      .toEqual([false, false, false])
      .expect('every giant at its born mass', giantMasses)
      .atTick(G12_READ_TICK)
      .toEqual(G12_GIANTS.map(({ bornMass }) => bornMass))
      .runDeterministic();
  });
});
