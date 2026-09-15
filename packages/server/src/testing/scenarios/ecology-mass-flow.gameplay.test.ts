// docs/ecology/acceptance.md §8, E17 (#383, docs/ui/hud.md §3.1.5): the mass flow the snapshot reports explains
// every tick's mass change of the own cell, at the floor, at the cap and through an engulf. Each tick is checked
// against the mass captured the tick before, at full precision:
//
//   Δmass = Σ ratesPerSecond × TICK_INTERVAL_S + Σ own eat massGained + predatorMassGained − sprintSpent
//
// Every row runs twice and is hash-compared, so the flow is shown not to move the state hash either. Masses and
// distances come from the balance (#212).

import { describe, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  EFFECT_KIND,
  FOOD_KIND,
  TICK_INTERVAL_S,
  TRAIT_TIERS,
  radiusForMass,
} from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { cellOf, effectsOfKind, massFlowOf, massOf, type EvolutionView } from '../gameplay/evolution-views.js';
import { ZONE, insideCellOf, player, sprint } from '../gameplay/index.js';
import { placedSolo } from './shared-setups.js';

const { growth, absorption } = DEFAULT_BALANCE;
/** The causes must explain the change to float precision, far inside the tables' ± 0.01. */
const CONSERVATION_TOLERANCE = 1e-6;
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
const TOP_TIER = 3;
/** T21 (#154): a 500 predator completes a meal of a 100 Toxin Vacuole III prey on tick 36. */
const T21 = { predatorMass: 500, preyMass: 100, payoutTick: 36, pastCoverTick: 12, ticks: 40 };

type RowBuilder = ReturnType<typeof placedSolo>;

const massLabel = (tick: number, playerIndex: number) => `player ${playerIndex} mass after tick ${tick}`;
const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Δmass minus everything the snapshot says moved it; `undefined` before a mass was captured or without a cell. */
function unexplainedMass(view: EvolutionView, playerIndex: number): number | undefined {
  const cell = cellOf(view, playerIndex);
  const massBefore = view.captured(massLabel(view.tick - 1, playerIndex));
  if (cell === undefined || typeof massBefore !== 'number') {
    return undefined;
  }
  const flow = massFlowOf(view, playerIndex);
  const applied = sum(Object.values(flow?.ratesPerSecond ?? {})) * TICK_INTERVAL_S;
  const eaten = sum(
    effectsOfKind(view, EFFECT_KIND.eat)
      .filter((effect) => effect.cellId === cell.id)
      .map((effect) => effect.massGained),
  );
  const engulfed = sum(
    effectsOfKind(view, EFFECT_KIND.cellAbsorbed)
      .filter((effect) => effect.predatorCellId === cell.id)
      .map((effect) => effect.predatorMassGained),
  );
  return cell.mass - massBefore - (applied + eaten + engulfed - (flow?.sprintSpent ?? 0));
}

/** Runs `ticks` and checks every one of them against the mass captured the tick before. */
function conservedEveryTick(builder: RowBuilder, ticks: number, playerIndex = 0): RowBuilder {
  let row = builder.advance(ticks);
  for (let tick = 1; tick <= ticks; tick += 1) {
    row = row
      .capture(massLabel(tick - 1, playerIndex), (view) => massOf(view, playerIndex))
      .atTick(tick - 1)
      .expect(`Δmass on tick ${tick} is the reported flow`, (view) => unexplainedMass(view, playerIndex))
      .atTick(tick)
      .toBeCloseTo(0, CONSERVATION_TOLERANCE);
  }
  return row;
}

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
    const auraRadius = TRAIT_TIERS.stentor_trumpet[TOP_TIER - 1]!.toxinAuraRangeInRadii! * toxicRadius;
    const betweenRimAndAura = (toxicRadius + victimRadius + auraRadius) / 2;
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
});
