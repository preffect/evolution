// docs/traits/constants-and-acceptance.md §6, the engulf rows a trait decides from the predator's side or by
// armour and poison: T3 (Cell Wall), T6 (Food Vacuole), T18 and T21 (Toxin Vacuole), each
// run twice and hash-compared. Traits are fixture-granted; masses are derived from the tier tables and
// the shared constants (#212), and each row also runs its traitless control where the table gives one,
// so a row can only pass on the trait's effect. The escape rows are `traits-engulf-escape.gameplay.test.ts`;
// T4's seeded spit-out is `simulation/engulf-drain.integration.test.ts`: the runner cannot place on seed 42, whose
// stream the row's draws come from, and #402 tracks the runner option that would bring T4 back here.

import { describe, expect, it } from 'vitest';
import { CELL_STATE, DEFAULT_BALANCE, ENGULF_RELEASE_REASON, foldModifiers } from '@evolution/shared';
import { cellOf } from '../gameplay/evolution-views.js';
import {
  E9_PAYOUT_TICK,
  E9_SEAL_TICK,
  PREDATOR_MASS,
  PREY_MASS,
  absorption,
  absorptionsOfPredator,
  engulfPairOf,
  massOfPredator,
  preyCell,
  progressOfPrey,
  releaseReasons,
  statesOfPrey,
} from './engulf-setups.js';
import { MASS_TOLERANCE, decayed, tierOneModifier } from './shared-setups.js';
import { HELD_PAIR_OUTCOME, drainedMass, modelHeldPair } from './trait-engulf-setups.js';

const ROW_TICKS = 120;
/** T3: B with Cell Wall I 5 wu from A; 28 never starts (1.40 × 20), 29 does. */
const T3_ROW = { distanceWu: 5, underMass: 28, overMass: 29, coverEndTick: 11, sealTick: 32, payoutTick: 69 };
/** T6: Food Vacuole I absorbs at 1/(36 × 0.8) a tick. */
const T6_ROW = { payoutTick: 33 };
/** T18 (#154): B 80 with Toxin Vacuole I against A 101; III against A 128 (released) and 130 (absorbed); no toxin, 72. */
const T18 = {
  preyMass: 80,
  predatorMass: 101,
  sealTick: 36,
  releaseTick: 51,
  topTierPredatorMass: 128,
  topTierReleaseTick: 62,
  topTierHeavyPredatorMass: 130,
  topTierHeavyPayoutTick: 64,
  controlPayoutTick: 72,
};
/** T21 (#154): a 500 predator completes a meal of a 100 Toxin Vacuole III prey on tick 36 and gains by it. */
const T21 = { preyMass: 100, predatorMass: 500, coverTicks: 6, payoutTick: 36 };

const massOfPrey = (view: Parameters<typeof massOfPredator>[0]) => cellOf(view, 1)?.mass;
/** `canContinueEngulf` on the view's masses: predator ≥ prey × (ENGULF_RELEASE_RATIO + no membrane bonus). */
const holdsOnRatio = (view: Parameters<typeof massOfPredator>[0]) =>
  (massOfPredator(view) ?? 0) >= (massOfPrey(view) ?? 0) * absorption.ENGULF_RELEASE_RATIO;

describe('traits/constants-and-acceptance.md §6: the engulf rows armour, poison and digestion decide (#260)', () => {
  it('T3: a Cell Wall I prey needs 1.40 × its mass to start, and dissolves at × 1.2', async () => {
    await engulfPairOf('T3 at 28', { mass: T3_ROW.underMass }, { traits: ['cell_wall'] }, T3_ROW.distanceWu)
      .advance(ROW_TICKS)
      .expect('never engulfed: 28 decays under 1.40 × 20 before its first check', statesOfPrey)
      .atEnd()
      .toEqual([])
      .expect('A absorptions = 0', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .runDeterministic();

    await engulfPairOf('T3 at 29', { mass: T3_ROW.overMass }, { traits: ['cell_wall'] }, T3_ROW.distanceWu)
      .advance(T3_ROW.payoutTick)
      .expect('claimed on tick 1', statesOfPrey)
      .atTick(1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('still in cover on tick 10', progressOfPrey)
      .atTick(T3_ROW.coverEndTick - 1)
      .toBeLessThan(absorption.ENGULF_WRAP_START_PROGRESS)
      .expect('cover ends on tick 11', progressOfPrey)
      .atTick(T3_ROW.coverEndTick)
      .toBeGreaterThan(absorption.ENGULF_WRAP_START_PROGRESS - absorption.ENGULF_PROGRESS_EPSILON)
      .expect('not sealed on tick 31', progressOfPrey)
      .atTick(T3_ROW.sealTick - 1)
      .toBeLessThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('sealed on tick 32', progressOfPrey)
      .atTick(T3_ROW.sealTick)
      .toBeGreaterThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('held on the release ratio 1.25 through tick 68', statesOfPrey)
      .atTick(T3_ROW.payoutTick - 1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('absorbed on tick 69', preyCell)
      .atTick(T3_ROW.payoutTick)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('A mass = decayed(29, 69) + 0.8 × 20', massOfPredator)
      .atTick(T3_ROW.payoutTick)
      .toBeCloseTo(
        decayed(T3_ROW.overMass, T3_ROW.payoutTick) + PREY_MASS * absorption.ENGULF_MASS_YIELD,
        MASS_TOLERANCE,
      )
      .runDeterministic();
  });

  it('T6: a Food Vacuole I predator absorbs on tick 33 and keeps 0.85 of the prey', async () => {
    const yieldWithVacuole = absorption.ENGULF_MASS_YIELD + tierOneModifier('food_vacuole', 'engulfMassYieldBonus');
    await engulfPairOf('T6', { traits: ['food_vacuole'] })
      .advance(T6_ROW.payoutTick)
      .expect('sealed on tick 18: the vacuole does not touch cover or wrap', progressOfPrey)
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, 1e-4)
      .expect('still being engulfed on tick 32', statesOfPrey)
      .atTick(T6_ROW.payoutTick - 1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('absorbed on tick 33, three ticks before E9', preyCell)
      .atTick(T6_ROW.payoutTick)
      .toSatisfy((cell) => cell === undefined && T6_ROW.payoutTick < E9_PAYOUT_TICK, 'no cell')
      .expect('A mass = decayed(100, 33) + 20 × 0.85', massOfPredator)
      .atTick(T6_ROW.payoutTick)
      .toBeCloseTo(decayed(PREDATOR_MASS, T6_ROW.payoutTick) + PREY_MASS * yieldWithVacuole, MASS_TOLERANCE)
      .runDeterministic();
  });

  it('T18: a swallowed Toxin Vacuole drains its predator under the release ratio before the payout', async () => {
    const toxinPair = (name: string, predatorMass: number, tier: number) =>
      engulfPairOf(name, { mass: predatorMass }, { mass: T18.preyMass, traits: [{ traitId: 'toxin_vacuole', tier }] });
    // The release tick and A's mass at it, stepped from the shared formulas rather than read off the row.
    const tierTables = DEFAULT_BALANCE.traits.TRAIT_TIERS;
    const model = modelHeldPair({
      predatorMass: T18.predatorMass,
      preyMass: T18.preyMass,
      predator: foldModifiers([], tierTables),
      prey: foldModifiers([{ traitId: 'toxin_vacuole', tier: 1 }], tierTables),
      maxTicks: T18.controlPayoutTick,
    });
    expect(model.kind, 'the model releases A on the ratio').toBe(HELD_PAIR_OUTCOME.ratio);
    expect(model.tick, "the row's release tick").toBe(T18.releaseTick);

    await toxinPair('T18', T18.predatorMass, 1)
      .advance(T18.controlPayoutTick)
      .expect('sealed on tick 36', progressOfPrey)
      .atTick(T18.sealTick)
      .toBeGreaterThan(absorption.ENGULF_SEAL_PROGRESS)
      .expect('A still holds on the ratio on tick 50', holdsOnRatio)
      .atTick(T18.releaseTick - 1)
      .toBe(true)
      .expect('A below 1.10 × B on tick 51', holdsOnRatio)
      .atTick(T18.releaseTick)
      .toBe(false)
      .expect('released from absorb on tick 51 on the ratio', releaseReasons)
      .atTick(T18.releaseTick)
      .toEqual([ENGULF_RELEASE_REASON.ratio])
      .expect('A mass at the release is the step model’s', massOfPredator)
      .atTick(T18.releaseTick)
      .toBeCloseTo(model.predatorMass, MASS_TOLERANCE)
      .expect('B free and alive at the end', statesOfPrey)
      .atEnd()
      .toEqual([])
      .expect('no payout', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .runDeterministic();

    await toxinPair('T18 Toxin Vacuole III', T18.topTierPredatorMass, 3)
      .advance(T18.topTierReleaseTick)
      .expect('A at 1.6 × B released on tick 62', releaseReasons)
      .atTick(T18.topTierReleaseTick)
      .toEqual([ENGULF_RELEASE_REASON.ratio])
      .runDeterministic();

    await toxinPair('T18 Toxin Vacuole III against 130', T18.topTierHeavyPredatorMass, 3)
      .advance(T18.topTierHeavyPayoutTick)
      .expect('A at 1.625 × B is never released', releaseReasons)
      .atTick(T18.topTierHeavyPayoutTick - 1)
      .toEqual([])
      .expect('A absorbs B on tick 64', preyCell)
      .atTick(T18.topTierHeavyPayoutTick)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .runDeterministic();

    await engulfPairOf('T18 without the toxin', { mass: T18.predatorMass }, { mass: T18.preyMass })
      .advance(T18.controlPayoutTick)
      .expect('still being engulfed on tick 71', statesOfPrey)
      .atTick(T18.controlPayoutTick - 1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect('A absorbs B on tick 72', preyCell)
      .atTick(T18.controlPayoutTick)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .runDeterministic();
  });

  it('T21: a heavy predator pays a dose set by the toxic prey, so its completed meal still gains mass', async () => {
    const toxin = { traitId: 'toxin_vacuole', tier: 3 } as const;
    const toxinFraction = DEFAULT_BALANCE.traits.TRAIT_TIERS.toxin_vacuole[2]!.toxinDrainFractionPerSecond!;
    // Cover at the contact share of A's own mass, then the swallowed dose on B's mass as B decays.
    const beforeYield = drainedMass(T21.predatorMass, [
      { ticks: T21.coverTicks, contactFractionPerSecond: toxinFraction },
      {
        ticks: T21.payoutTick - T21.coverTicks,
        dose: {
          preyMass: decayed(T21.preyMass, T21.coverTicks),
          fractionPerSecond: toxinFraction * absorption.ENGULF_SWALLOWED_TOXIN_MULTIPLIER,
        },
      },
    ]);
    const afterYield = beforeYield + decayed(T21.preyMass, T21.payoutTick) * absorption.ENGULF_MASS_YIELD;
    await engulfPairOf('T21', { mass: T21.predatorMass }, { mass: T21.preyMass, traits: [toxin] })
      .advance(T21.payoutTick)
      .expect('sealed on tick 18', progressOfPrey)
      .atTick(E9_SEAL_TICK)
      .toBeCloseTo(absorption.ENGULF_SEAL_PROGRESS, 1e-4)
      .expect('absorbed on tick 36', preyCell)
      .atTick(T21.payoutTick)
      .toSatisfy((cell) => cell === undefined, 'no cell')
      .expect('A after the yield ≈ 547.89: the dose and the yield leave it above its start', massOfPredator)
      .atTick(T21.payoutTick)
      .toBeCloseTo(afterYield, MASS_TOLERANCE)
      .expect('net gain over the meal', (view) => (massOfPredator(view) ?? 0) > T21.predatorMass)
      .atTick(T21.payoutTick)
      .toBe(true)
      .runDeterministic();
  });
});
