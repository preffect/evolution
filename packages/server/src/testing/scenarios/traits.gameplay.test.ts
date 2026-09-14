// docs/traits/constants-and-acceptance.md §6, the rows that need no engulf (T2, T5, T7, T8, T9), each run twice and
// hash-compared. The traits are fixture-granted at tier I, as the table's convention says; the draft path
// that earns one is progression-trait-effects.gameplay.test.ts. Every expected value is derived from the
// tier tables and the shared constants (#212), and each row first checks that the trait's number differs
// from a traitless cell's by more than the row's tolerance, so the row can only pass on the trait's effect.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BALANCE,
  FOOD_KIND,
  TICK_INTERVAL_S,
  distanceBetween,
  maxSpeedForMass,
  radiusForMass,
  secondsToTicks,
} from '@evolution/shared';
import { PLACED_ROW_SEED, evolutionScenario as scenario } from '../gameplay/evolution-adapter.js';
import { cellOf, foodCount, massOf, speedOf } from '../gameplay/evolution-views.js';
import { ZONE, combineScripts, eastOfCellOf, player, sprint, targetRadiiEast } from '../gameplay/index.js';
import {
  FULL_THROTTLE_RADII,
  MASS_TOLERANCE,
  SPEED_TOLERANCE_WU_PER_SECOND,
  blendedSpeed,
  blendedTravelWu,
  decayed,
  placedSolo,
  tierOneModifier,
} from './shared-setups.js';

const { growth, ecology, controls, absorption } = DEFAULT_BALANCE;
const STARTING_MASS = growth.CELL_STARTING_MASS;
/** T2: "blend converged as in E6", 120 ticks. */
const FULL_THROTTLE_TICKS = 120;
/** T2's travel is the closed-form sum of the blended speeds; the kernel's position update may differ by a fraction of a tick. */
const TRAVEL_TOLERANCE_WU = 2;
/** T5: "± 0.001". */
const PHOTOSYNTHESIS_TOLERANCE = 0.001;
/** T5, T7 and T8 run 60 ticks. */
const IDLE_TICKS = 60;
/** T7: B carries the toxin, C sits 10 wu east of it; both pinned. */
const TOXIC_MASS = 100;
const VICTIM_MASS = 90;
const TOXIC_PAIR_DISTANCE_WU = 10;
/** T8: algae at 2.5 radii (inside the eyespot's reach) and at 4 radii (outside it). */
const NEAR_MOTE_RADII = 2.5;
const FAR_MOTE_RADII = 4;
/** A mote's centre is eaten once it lies within one radius of the cell's centre (docs/ecology/food-and-spawn.md §1). */
const EAT_REACH_RADII = 1;
/** Exact positions in the scenario snapshot: "± 0.01 wu". */
const POSITION_TOLERANCE_WU = 0.01;
/** T9: "sprint at tick 1"; the row's "tick 2 speed cap" is read as the speed two ticks into the sprint. */
const FIRST_SPRINT_TICK = 1;
const SPRINT_SPEED_TICK = 2;

interface MetabolismTerms {
  readonly decayMultiplier?: number;
  readonly toxinDrainFractionPerSecond?: number;
  readonly photosynthesisMassPerSecond?: number;
}

/**
 * docs/traits/model.md §2 applied tick by tick above the starting mass: the surplus decay and the toxin drain
 * both read the mass at the start of the tick, then photosynthesis adds its per-second gain.
 */
function metabolisedMass(mass: number, ticks: number, terms: MetabolismTerms): number {
  const { decayMultiplier = 1, toxinDrainFractionPerSecond = 0, photosynthesisMassPerSecond = 0 } = terms;
  let current = mass;
  for (let tick = 0; tick < ticks; tick += 1) {
    const surplusDecay = (current - STARTING_MASS) * ecology.MASS_DECAY_RATE_PER_SECOND * decayMultiplier;
    const toxinDrain = current * toxinDrainFractionPerSecond;
    current += (photosynthesisMassPerSecond - surplusDecay - toxinDrain) * TICK_INTERVAL_S;
  }
  return current;
}

describe('traits/constants-and-acceptance.md §6: the trait rows without an engulf', () => {
  it('T2: Cilia Fringe I converges on the starting cap × its speedMultiplier and stays inside the vent', async () => {
    const plainCap = maxSpeedForMass(STARTING_MASS, growth);
    const ciliaCap = plainCap * tierOneModifier('cilia', 'speedMultiplier');
    const expectedSpeed = blendedSpeed(ciliaCap, FULL_THROTTLE_TICKS);
    const expectedTravelWu = blendedTravelWu(ciliaCap, FULL_THROTTLE_TICKS);
    expect(expectedSpeed - blendedSpeed(plainCap, FULL_THROTTLE_TICKS)).toBeGreaterThan(SPEED_TOLERANCE_WU_PER_SECOND);
    expect(expectedTravelWu).toBeLessThan(ecology.VENT_RADIUS);
    await placedSolo('T2')
      .placeCell({ playerIndex: 0, mass: STARTING_MASS, traits: ['cilia'], at: ZONE.vent })
      .from(1, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
      .advance(FULL_THROTTLE_TICKS)
      .expect('speed', (view) => speedOf(view, 0))
      .atTick(FULL_THROTTLE_TICKS)
      .toBeCloseTo(expectedSpeed, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('travelled east of the vent centre', (view) => cellOf(view, 0)?.x)
      .atTick(FULL_THROTTLE_TICKS)
      .toBeCloseTo(expectedTravelWu, TRAVEL_TOLERANCE_WU)
      .expect('no decay at the starting mass', (view) => massOf(view, 0))
      .atTick(FULL_THROTTLE_TICKS)
      .toBe(STARTING_MASS)
      .runDeterministic();
  });

  it('T5: Chloroplast I photosynthesises in the shallows and not in the broth', async () => {
    const shallowsMass = metabolisedMass(STARTING_MASS, IDLE_TICKS, {
      decayMultiplier: tierOneModifier('chloroplast', 'decayMultiplier'),
      photosynthesisMassPerSecond: tierOneModifier('chloroplast', 'photosynthesisMassPerSecond'),
    });
    expect(shallowsMass - STARTING_MASS).toBeGreaterThan(PHOTOSYNTHESIS_TOLERANCE);
    await placedSolo('T5 shallows')
      .placeCell({ playerIndex: 0, mass: STARTING_MASS, traits: ['chloroplast'], at: ZONE.shallows })
      .advance(IDLE_TICKS)
      .expect('mass', (view) => massOf(view, 0))
      .atTick(IDLE_TICKS)
      .toBeCloseTo(shallowsMass, PHOTOSYNTHESIS_TOLERANCE)
      .runDeterministic();
    await placedSolo('T5 broth')
      .placeCell({ playerIndex: 0, mass: STARTING_MASS, traits: ['chloroplast'], at: ZONE.broth })
      .advance(IDLE_TICKS)
      .expect('mass', (view) => massOf(view, 0))
      .atTick(IDLE_TICKS)
      .toBe(STARTING_MASS)
      .runDeterministic();
  });

  it('T7: Toxin Vacuole I drains the overlapping cell it cannot engulf; the toxic cell only decays', async () => {
    const victimMass = metabolisedMass(VICTIM_MASS, IDLE_TICKS, {
      toxinDrainFractionPerSecond: tierOneModifier('toxin_vacuole', 'toxinDrainFractionPerSecond'),
    });
    expect(TOXIC_MASS).toBeLessThan(VICTIM_MASS * absorption.ENGULF_MASS_RATIO);
    expect(TOXIC_PAIR_DISTANCE_WU).toBeLessThan(radiusForMass(VICTIM_MASS, growth));
    expect(decayed(VICTIM_MASS, IDLE_TICKS) - victimMass).toBeGreaterThan(MASS_TOLERANCE);
    await scenario('T7')
      .seed(PLACED_ROW_SEED)
      .players(2)
      .placeCell({ playerIndex: 0, mass: TOXIC_MASS, traits: ['toxin_vacuole'], isPinned: true })
      .placeCell({ playerIndex: 1, mass: VICTIM_MASS, isPinned: true, eastOfFirstCellWu: TOXIC_PAIR_DISTANCE_WU })
      .advance(IDLE_TICKS)
      .expect('C mass', (view) => massOf(view, 1))
      .atTick(IDLE_TICKS)
      .toBeCloseTo(victimMass, MASS_TOLERANCE)
      .expect('B mass', (view) => massOf(view, 0))
      .atTick(IDLE_TICKS)
      .toBeCloseTo(decayed(TOXIC_MASS, IDLE_TICKS), MASS_TOLERANCE)
      .expect('C never engulfed', (view) => cellOf(view, 1)?.engulfedByCellId)
      .atTick(IDLE_TICKS)
      .toBeNull()
      .runDeterministic();
  });

  it('T8: Euglena Eyespot I draws in the mote inside its reach and leaves the one outside it', async () => {
    const radius = radiusForMass(STARTING_MASS, growth);
    const attractRangeInRadii = tierOneModifier('euglena_eyespot', 'attractRangeInRadii');
    const driftPerTickWu = tierOneModifier('euglena_eyespot', 'attractSpeed') * TICK_INTERVAL_S;
    expect(NEAR_MOTE_RADII).toBeLessThanOrEqual(attractRangeInRadii);
    expect(FAR_MOTE_RADII).toBeGreaterThan(attractRangeInRadii);
    // Eating (step 4) reads the position the drift (step 8) left on the ticks before.
    const eatenTick = 1 + Math.ceil(((NEAR_MOTE_RADII - EAT_REACH_RADII) * radius) / driftPerTickWu);
    await placedSolo('T8')
      .placeCell({ playerIndex: 0, mass: STARTING_MASS, traits: ['euglena_eyespot'], isPinned: true })
      .placeMote({ moteKind: FOOD_KIND.algae, at: eastOfCellOf(0, NEAR_MOTE_RADII * radius) })
      .placeMote({ moteKind: FOOD_KIND.algae, at: eastOfCellOf(0, FAR_MOTE_RADII * radius) })
      .advance(IDLE_TICKS)
      .expect('both motes still in the dish', foodCount)
      .atTick(eatenTick - 1)
      .toBe(2)
      .expect('the near mote eaten', foodCount)
      .atTick(eatenTick)
      .toBe(1)
      .expect('mass after the algae and one tick of decay', (view) => massOf(view, 0))
      .atTick(eatenTick)
      .toBeCloseTo(decayed(STARTING_MASS + ecology.ALGAE_MASS, 1), MASS_TOLERANCE)
      .expect('the far mote has not moved', (view) => distanceBetween(view.snapshot.food.spawned[0]!, cellOf(view, 0)!))
      .atTick(IDLE_TICKS)
      .toBeCloseTo(FAR_MOTE_RADII * radius, POSITION_TOLERANCE_WU)
      .runDeterministic();
  });

  it('T9: Simple Flagellum I sprints at its bonus multiplier and sprints again after its shortened cooldown', async () => {
    const sprintCap =
      maxSpeedForMass(STARTING_MASS, growth) *
      tierOneModifier('simple_flagellum', 'speedMultiplier') *
      (controls.SPRINT_SPEED_MULTIPLIER + tierOneModifier('simple_flagellum', 'sprintSpeedMultiplierBonus'));
    const cooldownTicks = secondsToTicks(
      controls.SPRINT_COOLDOWN_SECONDS + tierOneModifier('simple_flagellum', 'sprintCooldownSecondsDelta'),
    );
    const secondSprintTick = FIRST_SPRINT_TICK + cooldownTicks;
    const plainSprintCap = maxSpeedForMass(STARTING_MASS, growth) * controls.SPRINT_SPEED_MULTIPLIER;
    expect(blendedSpeed(sprintCap - plainSprintCap, SPRINT_SPEED_TICK)).toBeGreaterThan(SPEED_TOLERANCE_WU_PER_SECOND);
    expect(cooldownTicks).toBeLessThan(secondsToTicks(controls.SPRINT_COOLDOWN_SECONDS));
    const sprintTicks = secondsToTicks(controls.SPRINT_DURATION_SECONDS);
    const sprintEast = combineScripts([sprint(), targetRadiiEast(FULL_THROTTLE_RADII)]);
    await placedSolo('T9')
      .placeCell({ playerIndex: 0, mass: STARTING_MASS, traits: ['simple_flagellum'] })
      .from(FIRST_SPRINT_TICK, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
      .atTick(FIRST_SPRINT_TICK, player(0).does(sprintEast))
      .atTick(secondSprintTick, player(0).does(sprintEast))
      .advance(secondSprintTick + 1)
      .expect('speed toward the sprinting cap', (view) => speedOf(view, 0))
      .atTick(SPRINT_SPEED_TICK)
      .toBeCloseTo(blendedSpeed(sprintCap, SPRINT_SPEED_TICK), SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('speed at the end of the sprint', (view) => speedOf(view, 0))
      .atTick(sprintTicks)
      .toBeCloseTo(blendedSpeed(sprintCap, sprintTicks), SPEED_TOLERANCE_WU_PER_SECOND)
      .expect(
        'the cooldown runs to the tick before the second press',
        (view) => cellOf(view, 0)?.sprintCooldownRemainingTicks,
      )
      .atTick(secondSprintTick - 2)
      .toBeGreaterThan(0)
      .expect('the cooldown is over', (view) => cellOf(view, 0)?.sprintCooldownRemainingTicks)
      .atTick(secondSprintTick - 1)
      .toBe(0)
      .expect('second sprint accepted', (view) => cellOf(view, 0)?.sprintRemainingTicks)
      .atTick(secondSprintTick)
      .toBeGreaterThan(0)
      .runDeterministic();
  });
});
