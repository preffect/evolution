// docs/ecology/acceptance.md §8.2, the giants' diet of slice 3 (giants.md §3.5.7), each run twice and hash-compared:
// G5 (step 4 feeds the grazer algae and bacteria while it is hungry, never a fragment, and neither the hunter nor the
// drifter) and G6 (the grazer targets the nearest mote ahead of it first, the nearest in sight otherwise, and passes
// over food once sated). The placed rows run on seed 48 (docs/testing/scenario-runner.md §8.1).

import { describe, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  DEFAULT_BALANCE,
  DNA_TAG,
  FOOD_KIND,
  GIANT_SPECIES,
  type GiantSpecies,
  type Vec2,
} from '@evolution/shared';
import { fragmentCount, giantCellOf, giantSeatOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { BROTH_POINT } from '../gameplay/placement.js';
import { placedSolo } from './shared-setups.js';
import {
  CENTRE_BEFORE_DECISION,
  PARAMECIUM_DECISION_TICK,
  eastOfBroth,
  giantCentre,
  giantTarget,
  isWanderTargetOf,
} from './giant-setups.js';

const { growth } = DEFAULT_BALANCE;
const { amoeba: AMOEBA, paramecium: PARAMECIUM, diatom: DIATOM } = GIANT_SPECIES;
const ONE_TICK = 1;
/** Where the rows keep their idle player: far from every placed giant and mote. */
const IDLE_CORNER: Vec2 = { x: -1500, y: 1500 };

/** G5: the paramecium born 1 100 with an algae mote, a bacterium and a fragment inside it 5, 10 and 15 wu east. */
const G5_PARAMECIUM_BORN_MASS = 1100;
const G5_ALGAE_EAST_WU = 5;
const G5_BACTERIUM_EAST_WU = 10;
const G5_FRAGMENT_EAST_WU = 15;
const G5_READ_TICK = 60;
/** 1 100 + 1 (algae) + 3 (bacterium); after tick 60, 3.5471 of growth left (± 0.0001). */
const G5_MASS_AFTER_MEAL = 1104;
const G5_GROWN_AFTER = 3.5471;
const G5_GROWTH_DIGITS = 4;
/**
 * Sated: born 1 100 with 110 of growth, which a tick's decay (about 0.0084) leaves at or over the 100 appetite through
 * G6's tick 25 (placed at exactly 100 it would be hungry again after the first settle); after tick 1, 1 210 − 1 190 × G
 * = 1 209.99157 (± 0.00001).
 */
const G5_SATED_GROWTH = 110;
const G5_SATED_MASS_AFTER = 1209.99157;
const G5_SATED_DIGITS = 5;
const G5_AMOEBA_BORN_MASS = 1000;
const G5_DIATOM_BORN_MASS = 1200;
/** G6: P 300 wu out at 45° left of ahead (east), Q 200 wu behind. */
const G6_P: Vec2 = { x: BROTH_POINT.x + 212.13, y: 212.13 };
const G6_Q: Vec2 = { x: 1300, y: 0 };

const moteKinds = (view: EvolutionView): string[] => view.snapshot.food.spawned.map((mote) => mote.kind).sort();

/** The species' giant at the broth point with `grownMass` of growth, the player idle in the corner. */
function giantAtBroth(name: string, species: GiantSpecies, bornMass: number, grownMass = 0) {
  return placedSolo(name)
    .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, at: IDLE_CORNER })
    .placeGiant({ species, bornMass, grownMass, at: BROTH_POINT });
}

/** G5's three morsels inside the paramecium. */
function withMorsels(run: ReturnType<typeof giantAtBroth>) {
  return run
    .placeMote({ moteKind: FOOD_KIND.algae, at: eastOfBroth(G5_ALGAE_EAST_WU) })
    .placeMote({
      moteKind: FOOD_KIND.bacterium,
      variant: BACTERIUM_VARIANT.plain,
      at: eastOfBroth(G5_BACTERIUM_EAST_WU),
    })
    .placeFragment({ tag: DNA_TAG.motile, at: eastOfBroth(G5_FRAGMENT_EAST_WU) });
}

describe("ecology/acceptance.md §8.2: the grazer's diet (G5)", () => {
  it('G5: the paramecium eats the algae mote and the bacterium on tick 1, never the fragment, and grows', async () => {
    await withMorsels(giantAtBroth('G5', PARAMECIUM, G5_PARAMECIUM_BORN_MASS))
      .advance(G5_READ_TICK)
      .expect('the algae and the bacterium gone, the fragment not', (view) => [moteKinds(view), fragmentCount(view)])
      .atTick(ONE_TICK)
      .toEqual([[], 1])
      .expect('mass = 1100 + 1 + 3', (view) => giantCellOf(view, PARAMECIUM)?.mass)
      .atTick(ONE_TICK)
      .toBeCloseTo(G5_MASS_AFTER_MEAL, G5_GROWTH_DIGITS)
      .expect('grownMass 3.5471 after tick 60', (view) => giantSeatOf(view, PARAMECIUM)?.grownMass)
      .atTick(G5_READ_TICK)
      .toBeCloseTo(G5_GROWN_AFTER, G5_GROWTH_DIGITS)
      .expect('mass 1103.5471 after tick 60', (view) => giantCellOf(view, PARAMECIUM)?.mass)
      .atTick(G5_READ_TICK)
      .toBeCloseTo(G5_PARAMECIUM_BORN_MASS + G5_GROWN_AFTER, G5_GROWTH_DIGITS)
      .runDeterministic();
  });

  it('G5 (sated, grownMass 110): a sated grazer passes over all three', async () => {
    const sated = giantAtBroth('G5 sated', PARAMECIUM, G5_PARAMECIUM_BORN_MASS, G5_SATED_GROWTH);
    await withMorsels(sated)
      .advance(ONE_TICK)
      .expect('all three still there', (view) => [moteKinds(view), fragmentCount(view)])
      .atTick(ONE_TICK)
      .toEqual([[FOOD_KIND.algae, FOOD_KIND.bacterium], 1])
      .expect('mass = 1210 − 1190 × G', (view) => giantCellOf(view, PARAMECIUM)?.mass)
      .atTick(ONE_TICK)
      .toBeCloseTo(G5_SATED_MASS_AFTER, G5_SATED_DIGITS)
      .runDeterministic();
  });

  for (const [species, bornMass] of [
    [AMOEBA, G5_AMOEBA_BORN_MASS],
    [DIATOM, G5_DIATOM_BORN_MASS],
  ] as const) {
    it(`G5 (${species}): step 4 leaves the algae mote inside it, its mass unchanged`, async () => {
      await giantAtBroth(`G5 ${species}`, species, bornMass)
        .placeMote({ moteKind: FOOD_KIND.algae, at: eastOfBroth(G5_ALGAE_EAST_WU) })
        .advance(ONE_TICK)
        .expect('the mote still there', moteKinds)
        .atTick(ONE_TICK)
        .toEqual([FOOD_KIND.algae])
        .expect('mass unchanged', (view) => giantCellOf(view, species)?.mass)
        .atTick(ONE_TICK)
        .toBe(bornMass)
        .runDeterministic();
    });
  }
});

describe('ecology/acceptance.md §8.2: the grazer grazes ahead first (G6)', () => {
  function grazing(name: string, motes: readonly Vec2[], grownMass = 0) {
    let run = giantAtBroth(name, PARAMECIUM, G5_PARAMECIUM_BORN_MASS, grownMass);
    for (const moteAt of motes) {
      run = run.placeMote({ moteKind: FOOD_KIND.algae, at: moteAt });
    }
    return run.advance(PARAMECIUM_DECISION_TICK);
  }

  it('G6: on tick 25 it targets P, 45° left of ahead, although Q behind it is nearer; neither eaten', async () => {
    await grazing('G6', [G6_P, G6_Q])
      .expect('at rest until its decision: forward is its heading', (view) => {
        const giant = giantCellOf(view, PARAMECIUM);
        return giant === undefined ? undefined : [giant.velocityX, giant.velocityY];
      })
      .atTick(PARAMECIUM_DECISION_TICK - ONE_TICK)
      .toEqual([0, 0])
      .expect("its target = P's centre", giantTarget(PARAMECIUM))
      .atTick(PARAMECIUM_DECISION_TICK)
      .toEqual(G6_P)
      .expect('neither mote eaten', (view) => moteKinds(view).length)
      .atTick(PARAMECIUM_DECISION_TICK)
      .toBe(2)
      .runDeterministic();
  });

  it('G6 (no P): no mote ahead, so the nearest in sight, Q', async () => {
    await grazing('G6 no P', [G6_Q])
      .expect("its target = Q's centre", giantTarget(PARAMECIUM))
      .atTick(PARAMECIUM_DECISION_TICK)
      .toEqual(G6_Q)
      .runDeterministic();
  });

  it('G6 (sated, grownMass 110): the decision skips the graze → a wander target', async () => {
    await grazing('G6 sated', [G6_P, G6_Q], G5_SATED_GROWTH)
      .capture(CENTRE_BEFORE_DECISION, giantCentre(PARAMECIUM))
      .atTick(PARAMECIUM_DECISION_TICK - ONE_TICK)
      .expect('a wander target, neither P nor Q', isWanderTargetOf(PARAMECIUM))
      .atTick(PARAMECIUM_DECISION_TICK)
      .toBe(true)
      .runDeterministic();
  });
});
