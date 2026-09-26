// docs/traits/constants-and-acceptance.md §6, T4: a Diatom Shell prey spat out by the seeded `engulf` stream, run
// twice and hash-compared at every tick. The spit-out is a draw of the seed-42 stream, so the row runs on the
// table seed with its gel patches cleared (`engulfPairOnTableSeedOf`, #402); the spit-out tick is derived from that
// stream, and the table's tick 39 is a drift guard on the derivation. Traits are fixture-granted.

import { describe, expect, it } from 'vitest';
import {
  CELL_STATE,
  DEFAULT_BALANCE,
  ENGULF_RELEASE_REASON,
  RANDOM_STREAM,
  createSeededRandom,
  secondsToTicks,
  spitOutChancePerTick,
} from '@evolution/shared';
import { TABLE_SEED } from '../gameplay/evolution-adapter.js';
import { cellOf, distanceBetweenCells, type EvolutionView } from '../gameplay/evolution-views.js';
import {
  E9_COVER_END_TICK,
  PREDATOR_MASS,
  PREY_MASS,
  absorption,
  absorptionsOfPredator,
  engulfPairOnTableSeedOf,
  massOfPredator,
  progressOfPrey,
  releaseReasons,
  statesOfPrey,
  type EngulfSide,
} from './engulf-setups.js';
import { MASS_TOLERANCE } from './shared-setups.js';
import { drainedMass } from './trait-engulf-setups.js';

const ROW_TICKS = 120;
/** Unspat, the absorb at × 1.4 would pay out on tick 44: the spit-out must come first. */
const UNSPAT_PAYOUT_TICK = 44;
/** What the row states: it moves only when the stream or the rules really change. */
const TABLE_SPIT_OUT_TICK = 39;
const TOP_TIER = 3;
const diatomTiers = DEFAULT_BALANCE.traits.TRAIT_TIERS.diatom_shell;
const diatomShell = (tier: number): EngulfSide => ({ traits: [{ traitId: 'diatom_shell', tier }] });

/**
 * The tick a spiny prey is spat out, from the table seed's own `engulf` stream: the prey rolls once per tick from
 * the first wrap tick (the tick after progress reaches the wrap band, E9's tick 7), and the first draw under the
 * per-tick chance spits it out (docs/ecology/absorption.md §6.1). Undefined when no draw before the payout lands.
 */
function spitOutTickOf(chancePerSecond: number): number | undefined {
  const firstWrapTick = E9_COVER_END_TICK + 1;
  const stream = createSeededRandom(TABLE_SEED).fork(RANDOM_STREAM.engulf);
  const chance = spitOutChancePerTick(chancePerSecond);
  for (let draw = 0; draw < UNSPAT_PAYOUT_TICK; draw += 1) {
    if (stream.nextFloat() < chance) return firstWrapTick + draw;
  }
  return undefined;
}

/** `A.radius − B.radius × ENGULF_COVERAGE_FRACTION`: nearer than this, an engulf could start. */
function contactMarginOfPair(view: EvolutionView): number | undefined {
  const predator = cellOf(view, 0);
  const prey = cellOf(view, 1);
  const distance = distanceBetweenCells(view, 0, 1);
  if (predator === undefined || prey === undefined || distance === undefined) return undefined;
  return distance - (predator.radius - prey.radius * absorption.ENGULF_COVERAGE_FRACTION);
}

describe('traits/constants-and-acceptance.md §6: T4, the Diatom Shell spit-out on the seeded stream (#260, #402)', () => {
  const spitOutTick = spitOutTickOf(diatomTiers[0]!.spitOutChancePerSecond!)!;
  const refractoryEndTick = spitOutTick + secondsToTicks(absorption.ENGULF_SPIT_OUT_REFRACTORY_SECONDS);

  it('derives the spit-out tick the table states, before the absorb could pay out', () => {
    expect(spitOutTick, 'the seed-42 stream draws under the Diatom Shell I chance before the payout').toBeDefined();
    expect(spitOutTick).toBe(TABLE_SPIT_OUT_TICK);
  });

  it('T4: B is spat out on the derived tick with A bled by the spike dose, and is never engulfed again', async () => {
    // The spike dose reads B's mass (#154); B sits at the starting mass, so it never decays.
    const massAtSpitOut = drainedMass(PREDATOR_MASS, [
      { ticks: 1 },
      {
        ticks: spitOutTick - 1,
        dose: { preyMass: PREY_MASS, fractionPerSecond: diatomTiers[0]!.spikeDrainFractionPerSecond! },
      },
    ]);
    let row = engulfPairOnTableSeedOf('T4', {}, diatomShell(1))
      .hashEvery(1)
      .advance(ROW_TICKS)
      .expect('held through the tick before the spit-out', statesOfPrey)
      .atTick(spitOutTick - 1)
      .toEqual([CELL_STATE.beingEngulfed])
      .expect(`spat out on tick ${spitOutTick}`, releaseReasons)
      .atTick(spitOutTick)
      .toEqual([ENGULF_RELEASE_REASON.spatOut])
      .expect('progress back to 0', progressOfPrey)
      .atTick(spitOutTick)
      .toBe(0)
      .expect('A paid the spike dose until the spit-out', massOfPredator)
      .atTick(spitOutTick)
      .toBeCloseTo(massAtSpitOut, MASS_TOLERANCE)
      .expect('A absorptions = 0', absorptionsOfPredator)
      .atEnd()
      .toBe(0)
      .expect('the pair separated past the contact bound by the end', contactMarginOfPair)
      .atEnd()
      .toBeGreaterThan(0);
    // The refractory (to `refractoryEndTick`) and separation keep B free for the rest of the row.
    for (let tick = spitOutTick; tick <= ROW_TICKS; tick += 1) {
      row = row.expect(`B free on tick ${tick}`, statesOfPrey).atTick(tick).toEqual([]);
    }
    expect(refractoryEndTick).toBeLessThan(ROW_TICKS);
    await row.runDeterministic();
  });

  it('Diatom Shell III rolls the same stream, so the same draw spits B out on the same tick', async () => {
    expect(spitOutTickOf(diatomTiers[TOP_TIER - 1]!.spitOutChancePerSecond!)).toBe(spitOutTick);
    await engulfPairOnTableSeedOf('T4 Diatom Shell III', {}, diatomShell(TOP_TIER))
      .hashEvery(1)
      .advance(spitOutTick)
      .expect(`spat out on tick ${spitOutTick}`, releaseReasons)
      .atTick(spitOutTick)
      .toEqual([ENGULF_RELEASE_REASON.spatOut])
      .runDeterministic();
  });
});
