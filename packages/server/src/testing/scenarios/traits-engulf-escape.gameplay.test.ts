// docs/traits/constants-and-acceptance.md §6, the engulf rows decided by how a prey moves or how a predator grips:
// T13 (Amoeba Pseudopods), T14 (Cytoskeleton Lattice), T15 (Cilia Fringe), T16 (Paramecium Cilia), T17
// (Simple Flagellum) and T19 (Mitochondrion), each run twice and hash-compared. Where the table gives
// the traitless prey's outcome for the same input, the control runs too, so a row can only pass on the
// trait's effect; the controls E11 already pins (sprint at 13 escapes on 29, at 14 is absorbed) are not
// repeated. The setup and the input scripts are `engulf-setups.ts`.

import { describe, it } from 'vitest';
import { ENGULF_RELEASE_REASON, ENGULF_SEAL_PROGRESS, PLAYER_LIFE_STATE } from '@evolution/shared';
import {
  PREDATOR_MASS,
  PREY_MASS,
  absorption,
  absorptionsOfPredator,
  engulfPairOf,
  lifeStateOfPrey,
  massOfPredator,
  preyCell,
  progressOfPrey,
  releaseReasons,
  sprintsAwayFrom,
  steersAwayFrom,
  type EngulfSide,
} from './engulf-setups.js';
import { MASS_TOLERANCE, decayed } from './shared-setups.js';

const ROW_TICKS = 120;
const TOP_TIER = 3;
const topTier = (traitId: string): EngulfSide => ({ traits: [{ traitId, tier: TOP_TIER }] });

/** The pair with `predator` / `prey` sides, run to `ticks` under `input`, released on `releaseTick` as `escaped`. */
function expectEscape(
  name: string,
  sides: { predator?: EngulfSide; prey?: EngulfSide },
  input: ReturnType<typeof steersAwayFrom>,
  releaseTick: number,
) {
  return input(engulfPairOf(name, sides.predator, sides.prey))
    .advance(Math.max(releaseTick, ROW_TICKS))
    .expect(`released on tick ${releaseTick}`, releaseReasons)
    .atTick(releaseTick)
    .toEqual([ENGULF_RELEASE_REASON.escaped])
    .expect('B alive at the end of the row', lifeStateOfPrey)
    .atEnd()
    .toBe(PLAYER_LIFE_STATE.alive)
    .runDeterministic();
}

/** Same, but the prey is sealed on `sealTick` and absorbed on `payoutTick`. */
interface AbsorbedOutcome {
  readonly input?: ReturnType<typeof steersAwayFrom>;
  readonly sealTick: number;
  readonly payoutTick: number;
}

function expectAbsorbed(
  name: string,
  sides: { predator?: EngulfSide; prey?: EngulfSide },
  { input, sealTick, payoutTick }: AbsorbedOutcome,
) {
  const pair = engulfPairOf(name, sides.predator, sides.prey);
  return (input === undefined ? pair : input(pair))
    .advance(payoutTick)
    .expect(`not sealed on tick ${sealTick - 1}`, progressOfPrey)
    .atTick(sealTick - 1)
    .toBeLessThan(ENGULF_SEAL_PROGRESS)
    .expect(`sealed on tick ${sealTick}`, progressOfPrey)
    .atTick(sealTick)
    .toBeGreaterThan(ENGULF_SEAL_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON)
    .expect('never released', releaseReasons)
    .atTick(payoutTick - 1)
    .toEqual([])
    .expect(`absorbed on tick ${payoutTick}`, preyCell)
    .atTick(payoutTick)
    .toSatisfy((cell) => cell === undefined, 'no cell')
    .expect('A absorptions = 1', absorptionsOfPredator)
    .atTick(payoutTick)
    .toBe(1);
}

describe('traits/constants-and-acceptance.md §6: the engulf rows grip and movement decide (#260)', () => {
  it('T13: Amoeba Pseudopods III wraps faster and holds a sprinting prey that escapes a plain predator', async () => {
    const amoeba = { predator: topTier('amoeba_pseudopods') };
    await expectAbsorbed('T13 (a) idle', amoeba, { sealTick: 14, payoutTick: 32 })
      .expect('A mass = decayed(100, 32) + 0.8 × 20', massOfPredator)
      .atTick(32)
      .toBeCloseTo(decayed(PREDATOR_MASS, 32) + PREY_MASS * absorption.ENGULF_MASS_YIELD, MASS_TOLERANCE)
      .runDeterministic();
    await expectAbsorbed('T13 (b) sprint at 10', amoeba, {
      input: sprintsAwayFrom(10),
      sealTick: 19,
      payoutTick: 37,
    }).runDeterministic();
    // The arm grab (#735) draws a prey that stops fighting back in from the arm's reach, so the window closes a tick
    // earlier (sprint at 7 escaped before it); a prey that keeps swimming away drains out on the arm, a tick later.
    await expectEscape('T13 (c) sprint at 6', amoeba, sprintsAwayFrom(6), 28);
    await expectAbsorbed('T13 (c) sprint at 7, held by the arm', amoeba, {
      input: sprintsAwayFrom(7),
      sealTick: 22,
      payoutTick: 40,
    }).runDeterministic();
    await expectEscape(
      'T13 (d) Amoeba I, sprint at 10',
      { predator: { traits: ['amoeba_pseudopods'] } },
      sprintsAwayFrom(10),
      31,
    );
  });

  it('T14: a Cytoskeleton Lattice III prey steering away from tick 14 slows the wrap enough to break free', async () => {
    const lattice = { prey: topTier('cytoskeleton') };
    // Since ticket #819 the kept grab holds and seals B until it is clear of A: from tick 16 (the row's input before)
    // it is sealed on tick 30, so the row steers from 14, the last tick that still gets out.
    await expectEscape('T14 steering from 14', lattice, steersAwayFrom(14), 45);
    await expectAbsorbed(
      'T14 plain prey steering from 14',
      {},
      { input: steersAwayFrom(14), sealTick: 23, payoutTick: 41 },
    ).runDeterministic();
    await expectEscape('T14 steering from 10', lattice, steersAwayFrom(10), 39);
  });

  it('T15: a Cilia Fringe III prey slips the grip and escapes from tick 8', async () => {
    // Since ticket #819 the kept grab holds and seals B until it is clear of A: from tick 12 (the row's input before)
    // it is sealed on tick 25 as a plain prey is, so the row steers from 8, the last tick that still gets out.
    await expectEscape('T15 steering from 8', { prey: topTier('cilia') }, steersAwayFrom(8), 37);
    await expectAbsorbed(
      'T15 plain prey steering from 8',
      {},
      { input: steersAwayFrom(8), sealTick: 29, payoutTick: 47 },
    ).runDeterministic();
  });

  it('T16: Paramecium Cilia III with Cilia Fringe I escapes from tick 13, where a plain prey is absorbed', async () => {
    const paramecium = { prey: { traits: [{ traitId: 'paramecium_cilia', tier: TOP_TIER }, 'cilia'] } };
    // Since ticket #819 the kept grab holds and seals B until it is clear of A: from tick 15 (the row's input before)
    // it is sealed on tick 28, so the row steers from 13, the last tick that still gets out.
    await expectEscape('T16 steering from 13', paramecium, steersAwayFrom(13), 40);
    await steersAwayFrom(13)(engulfPairOf('T16 plain prey steering from 13'))
      .advance(ROW_TICKS)
      .expect('a plain prey is absorbed: steering gets it out only from tick 4 or earlier (E11)', absorptionsOfPredator)
      .atEnd()
      .toBe(1)
      .runDeterministic();
  });

  it('T17: a Simple Flagellum prey sprints clear later than a plain one can', async () => {
    await expectEscape(
      'T17 Flagellum III sprint at 14',
      { prey: topTier('simple_flagellum') },
      sprintsAwayFrom(14),
      31,
    );
    await expectEscape(
      'T17 Flagellum I sprint at 13',
      { prey: { traits: ['simple_flagellum'] } },
      sprintsAwayFrom(13),
      31,
    );
  });

  it('T19: a Mitochondrion III prey sprinting at 13 gets out a tick before a plain one, by the sprint alone', async () => {
    await expectEscape('T19 sprint at 13', { prey: topTier('mitochondrion') }, sprintsAwayFrom(13), 31);
  });
});
