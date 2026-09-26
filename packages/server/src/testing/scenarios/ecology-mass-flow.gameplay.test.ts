// docs/ecology/acceptance.md §8, E17 (#383, docs/ui/hud.md §3.1.5): the mass flow the snapshot reports explains
// every tick's mass change of the own cell, at the floor, at the cap, through an engulf and through a level-up with no
// cards left (#416). Each tick is checked against the mass captured the tick before (`mass-flow-setups.ts`).
//
// Every row runs twice and is hash-compared, so the flow is shown not to move the state hash either. Masses and
// distances come from the balance (#212).

import { describe, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  DNA_TAG,
  EFFECT_KIND,
  ENGULF_WRAP_START_PROGRESS,
  FOOD_KIND,
  TICK_INTERVAL_S,
  TRAIT_TIERS,
  cumulativeDnaForLevel,
  radiusForMass,
  type TraitTier,
} from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import {
  cellOf,
  effectsOfKind,
  massFlowOf,
  massOf,
  progressOf,
  type EvolutionView,
} from '../gameplay/evolution-views.js';
import { ZONE, insideCellOf, player, sprint } from '../gameplay/index.js';
import { CONSERVATION_TOLERANCE, conservedEveryTick } from './mass-flow-setups.js';
import { placedSolo } from './shared-setups.js';

const { growth, absorption, progression, traits } = DEFAULT_BALANCE;
const ROW_TICKS = 60;
const WORKED_MASS = 312;
const SPRINT_TICK = 20;
const CONTACT_DISTANCE_WU = 10;
/** E17's floor row: 0.01 over the floor, touched by a toxic cell too light to engulf it. */
const FLOOR_SURPLUS = 0.01;
const FLOOR_TOXIC_MASS = 24;
/** E17's aura row: a heavy toxic cell whose top-tier aura reaches a light one it does not touch. */
const AURA_TOXIC_MASS = 1000;
const AURA_VICTIM_MASS = 40;
const TOP_TIER: TraitTier = 3;
/** T21 (#154): a 500 predator completes a meal of a 100 Toxin Vacuole III prey on tick 36. */
const T21 = { predatorMass: 500, preyMass: 100, payoutTick: 36, pastCoverTick: 12, ticks: 40 };
/** F1 on #420: the T21 masses with a Diatom Shell I prey, whose spikes cost the predator from the first progress. */
const SPINY = { ticks: 40, inCoverTick: 3 };

/**
 * E17's no-draft row (#416): every trait at its top tier, so a level-up has no cards and its offer is dropped for
 * `LEVEL_UP_NO_DRAFT_MASS_BONUS`; one DNA short of level 2, so the fragment eaten on tick 1 levels the cell up.
 */
const NO_DRAFT = { ticks: 10, levelUpTick: 1, dnaShort: 1 };
const EVERY_TRAIT_AT_TOP = traits.TRAIT_CATALOG.map((trait) => ({ traitId: trait.id, tier: TOP_TIER }));

const rateOf =
  (playerIndex: number, cause: 'toxin' | 'swallowed' | 'decay' | 'vent' | 'light') => (view: EvolutionView) =>
    massFlowOf(view, playerIndex)?.ratesPerSecond[cause];

const placedPair = (name: string) => scenario(name).seed(PLACED_ROW_SEED).players(2);

describe('docs/ecology/acceptance.md §8 E17: the mass flow explains every tick (#383)', () => {
  it('in the vent with Mitochondrion I, through a sprint start', async () => {
    await conservedEveryTick(
      placedSolo('E17 vent').placeCell({ playerIndex: 0, mass: WORKED_MASS, at: ZONE.vent, traits: ['mitochondrion'] }),
      ROW_TICKS,
    )
      .atTick(SPRINT_TICK, player(0).does(sprint()))
      .expect('a decay rate', rateOf(0, 'decay'))
      .atTick(1)
      .toBeLessThan(0)
      .expect('a vent rate', rateOf(0, 'vent'))
      .atTick(1)
      .toBeLessThan(0)
      .expect('the sprint start is reported', (view) => massFlowOf(view, 0)?.sprintSpent)
      .atTick(SPRINT_TICK)
      .toBeGreaterThan(0)
      .runDeterministic();
  });

  it('touching Toxin Vacuole I', async () => {
    await conservedEveryTick(
      placedPair('E17 contact')
        .placeCell({ playerIndex: 0, mass: WORKED_MASS })
        .placeCell({
          playerIndex: 1,
          mass: WORKED_MASS,
          eastOfFirstCellWu: CONTACT_DISTANCE_WU,
          traits: ['toxin_vacuole'],
        }),
      ROW_TICKS,
    )
      .expect('a toxin rate', rateOf(0, 'toxin'))
      .atTick(1)
      .toBeLessThan(0)
      .runDeterministic();
  });

  it('inside a toxin aura, not touching', async () => {
    const toxicRadius = radiusForMass(AURA_TOXIC_MASS, growth);
    const victimRadius = radiusForMass(AURA_VICTIM_MASS, growth);
    // The aura is measured from the rim (#424): halfway between touching and its reach.
    const auraGap = TRAIT_TIERS.stentor_trumpet[TOP_TIER - 1]!.toxinAuraRangeInRadii! * toxicRadius;
    const betweenRimAndAura = toxicRadius + victimRadius + auraGap / 2;
    await conservedEveryTick(
      placedPair('E17 aura')
        .placeCell({
          playerIndex: 0,
          mass: AURA_TOXIC_MASS,
          traits: ['toxin_vacuole', { traitId: 'stentor_trumpet', tier: TOP_TIER }],
        })
        .placeCell({ playerIndex: 1, mass: AURA_VICTIM_MASS, eastOfFirstCellWu: betweenRimAndAura }),
      ROW_TICKS,
      1,
    )
      .expect('a toxin rate with no contact', rateOf(1, 'toxin'))
      .atTick(1)
      .toBeLessThan(0)
      .runDeterministic();
  });

  it('with Chloroplast I in the shallows', async () => {
    await conservedEveryTick(
      placedSolo('E17 shallows').placeCell({
        playerIndex: 0,
        mass: growth.CELL_STARTING_MASS,
        at: ZONE.shallows,
        traits: ['chloroplast'],
      }),
      ROW_TICKS,
    )
      .expect('a light rate', rateOf(0, 'light'))
      .atTick(1)
      .toBeGreaterThan(0)
      .runDeterministic();
  });

  it('at the floor: 0.01 over it, touching a toxic cell too light to engulf it', async () => {
    const floorMass = growth.CELL_STARTING_MASS + FLOOR_SURPLUS;
    await conservedEveryTick(
      placedPair('E17 floor')
        .placeCell({ playerIndex: 0, mass: floorMass })
        .placeCell({
          playerIndex: 1,
          mass: FLOOR_TOXIC_MASS,
          eastOfFirstCellWu: CONTACT_DISTANCE_WU,
          traits: ['toxin_vacuole'],
        }),
      ROW_TICKS,
    )
      .expect('B cannot engulf A', () => FLOOR_TOXIC_MASS < floorMass * absorption.ENGULF_MASS_RATIO)
      .atTick(0)
      .toBe(true)
      .expect('A is on the floor after tick 1', (view) => massOf(view, 0))
      .atTick(1)
      .toBe(growth.CELL_STARTING_MASS)
      .expect('the toxin and decay rates add up to the 0.01 taken', (view) => {
        const rates = massFlowOf(view, 0)?.ratesPerSecond;
        return rates === undefined ? undefined : ((rates.toxin ?? 0) + (rates.decay ?? 0)) * TICK_INTERVAL_S;
      })
      .atTick(1)
      .toBeCloseTo(-FLOOR_SURPLUS, CONSERVATION_TOLERANCE)
      .runDeterministic();
  });

  it('at the cap: a meal adds no mass and banks DNA', async () => {
    const capMeal = (view: EvolutionView) => effectsOfKind(view, EFFECT_KIND.eat)[0];
    await conservedEveryTick(
      placedSolo('E17 cap')
        .placeCell({ playerIndex: 0, mass: growth.CELL_MAX_MASS })
        .placeMote({ moteKind: FOOD_KIND.algae, at: insideCellOf(0) }),
      ROW_TICKS,
    )
      .expect('the meal adds no mass', (view) => capMeal(view)?.massGained)
      .atTick(1)
      .toBe(0)
      .expect('the meal banks DNA', (view) => capMeal(view)?.dnaGained)
      .atTick(1)
      .toBeGreaterThan(0)
      .runDeterministic();
  });

  it('engulfing a Toxin Vacuole III prey (T21): the swallowed dose, then the payout', async () => {
    await conservedEveryTick(
      placedPair('E17 swallowed')
        .placeCell({ playerIndex: 0, mass: T21.predatorMass })
        .placeCell({
          playerIndex: 1,
          mass: T21.preyMass,
          eastOfFirstCellWu: CONTACT_DISTANCE_WU,
          traits: [{ traitId: 'toxin_vacuole', tier: TOP_TIER }],
        }),
      T21.ticks,
    )
      .expect('a swallowed rate past cover, never counted as toxin', (view) => {
        const rates = massFlowOf(view, 0)?.ratesPerSecond;
        return rates !== undefined && (rates.swallowed ?? 0) < 0 && rates.toxin === undefined;
      })
      .atTick(T21.pastCoverTick)
      .toBe(true)
      .expect(
        'the payout reports the mass it added',
        (view) => effectsOfKind(view, EFFECT_KIND.cellAbsorbed)[0]?.predatorMassGained,
      )
      .atTick(T21.payoutTick)
      .toBeGreaterThan(0)
      .runDeterministic();
  });

  it('engulfing a Diatom Shell I prey: its spikes are swallowed from the first progress, in cover', async () => {
    await conservedEveryTick(
      placedPair('E17 spiny')
        .placeCell({ playerIndex: 0, mass: T21.predatorMass })
        .placeCell({
          playerIndex: 1,
          mass: T21.preyMass,
          eastOfFirstCellWu: CONTACT_DISTANCE_WU,
          traits: ['diatom_shell'],
        }),
      SPINY.ticks,
    )
      .expect('the engulf is still in cover', (view) => cellOf(view, 1)?.engulfProgress)
      .atTick(SPINY.inCoverTick)
      .toBeLessThan(ENGULF_WRAP_START_PROGRESS)
      .expect('a swallowed rate in cover, never counted as toxin', (view) => {
        const rates = massFlowOf(view, 0)?.ratesPerSecond;
        return rates !== undefined && (rates.swallowed ?? 0) < 0 && rates.toxin === undefined;
      })
      .atTick(SPINY.inCoverTick)
      .toBe(true)
      .runDeterministic();
  });

  it('a level-up with no cards left: the dropped offer’s mass bonus (#416)', async () => {
    await conservedEveryTick(
      placedSolo('E17 no draft')
        .placeCell({
          playerIndex: 0,
          mass: WORKED_MASS,
          traits: EVERY_TRAIT_AT_TOP,
          dnaCumulative: cumulativeDnaForLevel(2, progression) - NO_DRAFT.dnaShort,
        })
        .placeFragment({ tag: DNA_TAG.sensory, at: insideCellOf(0) }),
      NO_DRAFT.ticks,
    )
      .expect('the fragment levels the cell up', (view) => progressOf(view, 0)?.level)
      .atTick(NO_DRAFT.levelUpTick)
      .toBe(2)
      .expect('no offer is shown', (view) => progressOf(view, 0)?.offer)
      .atTick(NO_DRAFT.levelUpTick)
      .toBeNull()
      .expect('the bonus is reported as applied', (view) => massFlowOf(view, 0)?.noDraftBonusGained)
      .atTick(NO_DRAFT.levelUpTick)
      .toBe(progression.LEVEL_UP_NO_DRAFT_MASS_BONUS)
      .runDeterministic();
  });
});
