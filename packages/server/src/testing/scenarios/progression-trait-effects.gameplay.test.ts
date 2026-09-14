// docs/PROGRESSION.md §2–§4 end to end (#198): DNA eaten in the dish levels the cell up, the draft it
// opens is picked through the input like a player would, and the picked trait's tier I numbers
// (docs/traits/model.md §2, `TRAIT_TIERS`) change what the simulation does on the pick tick: DNA gain,
// the speed cap, the mass decay. Every expected value is derived from the shared constants (#212).

import { describe, expect, it } from 'vitest';
import {
  BACTERIUM_VARIANT,
  DEFAULT_BALANCE,
  DEFAULT_CELL_MODIFIERS,
  DNA_TAG,
  ENDOSYMBIOSIS_BACTERIA_REQUIRED,
  FOOD_KIND,
  cumulativeDnaForLevel,
  maxSpeedForMass,
  type CellModifiers,
  type TraitId,
} from '@evolution/shared';
import { type EvolutionScenarioSnapshot } from '../gameplay/evolution-adapter.js';
import { cellOf, massOf, progressOf, speedOf } from '../gameplay/evolution-views.js';
import { insideCellOf, player, targetRadiiEast, type PlayerScript } from '../gameplay/index.js';
import {
  FULL_THROTTLE_RADII,
  MASS_TOLERANCE,
  SPEED_TOLERANCE_WU_PER_SECOND,
  blendedSpeed,
  decayed,
  placedSolo,
} from './shared-setups.js';

const { growth, ecology, progression, traits } = DEFAULT_BALANCE;
const LEVEL_2_DNA = cumulativeDnaForLevel(2, progression);
const LEVEL_3_DNA = cumulativeDnaForLevel(3, progression);
/** The draft opens at step 7 of tick 1; the pick is submitted for tick 2, whose step 1 applies it. */
const DRAFT_TICK = 1;
const PICK_TICK = DRAFT_TICK + 1;
/** As E6: 120 ticks of full throttle close 99.97 % of the steer blend's gap. */
const FULL_THROTTLE_TICKS = 120;
/** A mass well above the start, so the surplus decay is measurable over a second (E5's mass). */
const DECAYING_MASS = 1020;
const DECAY_TICKS = 60;

/** A tier I modifier of `traitId`, or the identity when the trait does not set it. */
function tierOneModifier(traitId: TraitId, field: keyof CellModifiers): number {
  const value = traits.TRAIT_TIERS[traitId][0][field] ?? DEFAULT_CELL_MODIFIERS[field];
  return value as number;
}

/** Picks the shown offer's card for `traitId` by its index, as the client would; sends nothing when it is not offered. */
function pickOfferedTrait(traitId: TraitId): PlayerScript<EvolutionScenarioSnapshot> {
  return (context) => {
    const offer = context.snapshot.progressByPlayer[context.playerId]?.offer;
    const cardIndex = offer?.cards.findIndex((card) => card.traitId === traitId) ?? -1;
    return offer == null || cardIndex < 0 ? null : { traitChoice: { offerId: offer.offerId, cardIndex } };
  };
}

/** A starting-mass protocell fed exactly level 2's DNA in fragments on tick 1: the protocell draft opens that tick. */
function protocellDraft(name: string) {
  const run = placedSolo(name);
  for (let fragment = 0; fragment < LEVEL_2_DNA / ecology.DNA_FRAGMENT_DNA; fragment += 1) {
    run.atTick(DRAFT_TICK).placeFragment({ tag: DNA_TAG.sensory, at: insideCellOf(0) });
  }
  return run;
}

describe('PROGRESSION §2–§4: a picked trait changes the simulation', () => {
  it.each(['nucleoid', 'simple_flagellum'] as const)(
    'DNA → level 2 → %s: a fragment eaten on the pick tick gains DNA × its dnaGainMultiplier',
    async (traitId) => {
      const gain = ecology.DNA_FRAGMENT_DNA * tierOneModifier(traitId, 'dnaGainMultiplier');
      await protocellDraft(`trait gain ${traitId}`)
        .atTick(PICK_TICK)
        .placeFragment({ tag: DNA_TAG.sensory, at: insideCellOf(0) })
        .atTick(PICK_TICK, player(0).does(pickOfferedTrait(traitId)))
        .advance(PICK_TICK)
        .expect('level 2 with the draft open', (view) => progressOf(view, 0)?.offer?.offerId)
        .atTick(DRAFT_TICK)
        .toBe(1)
        .expect('the trait owned at tier I', (view) => cellOf(view, 0)?.traits)
        .atTick(PICK_TICK)
        .toEqual([{ traitId, tier: 1 }])
        .expect('dna', (view) => progressOf(view, 0)?.dnaCumulative)
        .atTick(PICK_TICK)
        .toBeCloseTo(LEVEL_2_DNA + gain, MASS_TOLERANCE)
        .runDeterministic();
    },
  );

  it.each(['nucleoid', 'simple_flagellum', 'cell_wall'] as const)(
    'DNA → level 2 → %s: full throttle from the pick converges on the cap × its speedMultiplier',
    async (traitId) => {
      const speedCapWuPerSecond =
        maxSpeedForMass(growth.CELL_STARTING_MASS, growth) * tierOneModifier(traitId, 'speedMultiplier');
      const measureTick = DRAFT_TICK + FULL_THROTTLE_TICKS;
      await protocellDraft(`trait speed ${traitId}`)
        .atTick(PICK_TICK, player(0).does(pickOfferedTrait(traitId)))
        .from(PICK_TICK, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
        .advance(measureTick)
        .expect('at rest while the draft is open', (view) => speedOf(view, 0))
        .atTick(DRAFT_TICK)
        .toBe(0)
        .expect('the trait owned at tier I', (view) => cellOf(view, 0)?.traits)
        .atTick(PICK_TICK)
        .toEqual([{ traitId, tier: 1 }])
        .expect('speed', (view) => speedOf(view, 0))
        .atTick(measureTick)
        .toBeCloseTo(blendedSpeed(speedCapWuPerSecond, FULL_THROTTLE_TICKS), SPEED_TOLERANCE_WU_PER_SECOND)
        .runDeterministic();
    },
  );

  it('bacteria → level 3 → mitochondrion: the cell decays at its decayMultiplier from the pick tick', async () => {
    const decayMultiplier = tierOneModifier('mitochondrion', 'decayMultiplier');
    // Tick 1 eats the bacteria (step 4) before it decays at the base rate (step 5).
    const massAfterDraftTick = decayed(DECAYING_MASS + ENDOSYMBIOSIS_BACTERIA_REQUIRED * ecology.BACTERIUM_MASS, 1);
    const measureTick = DRAFT_TICK + DECAY_TICKS;
    const expectedMass = decayed(massAfterDraftTick, DECAY_TICKS, decayMultiplier);
    expect(Math.abs(expectedMass - decayed(massAfterDraftTick, DECAY_TICKS))).toBeGreaterThan(MASS_TOLERANCE);
    // A prokaryote one DNA short of level 3: the bacteria's DNA levels it up and fills the aerobic
    // counter on the same tick, so the level-3 draft's rung card is the mitochondrion (PROGRESSION §3).
    const run = placedSolo('trait decay mitochondrion').placeCell({
      playerIndex: 0,
      mass: DECAYING_MASS,
      traits: ['nucleoid'],
      dnaCumulative: LEVEL_3_DNA - 1,
    });
    for (let bacterium = 0; bacterium < ENDOSYMBIOSIS_BACTERIA_REQUIRED; bacterium += 1) {
      run
        .atTick(DRAFT_TICK)
        .placeMote({ moteKind: FOOD_KIND.bacterium, variant: BACTERIUM_VARIANT.aerobic, at: insideCellOf(0) });
    }
    await run
      .atTick(PICK_TICK, player(0).does(pickOfferedTrait('mitochondrion')))
      .advance(measureTick)
      .expect('level 3', (view) => progressOf(view, 0)?.level)
      .atTick(DRAFT_TICK)
      .toBe(3)
      .expect('mass before the pick', (view) => massOf(view, 0))
      .atTick(DRAFT_TICK)
      .toBeCloseTo(massAfterDraftTick, MASS_TOLERANCE)
      .expect('mitochondrion owned at tier I', (view) => cellOf(view, 0)?.traits)
      .atTick(PICK_TICK)
      .toEqual([
        { traitId: 'nucleoid', tier: 1 },
        { traitId: 'mitochondrion', tier: 1 },
      ])
      .expect('mass', (view) => massOf(view, 0))
      .atTick(measureTick)
      .toBeCloseTo(expectedMass, MASS_TOLERANCE)
      .runDeterministic();
  });
});
