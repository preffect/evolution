// The dose a held prey costs its predator (docs/ecology/mass-and-movement.md §4.1 `swallowedDose`,
// docs/ecology/absorption.md §6.1, #154): read against the prey's start-of-step mass, spikes from the first
// progress on, toxin × ENGULF_SWALLOWED_TOXIN_MULTIPLIER past cover, and the metabolism step counting a
// swallowed prey's toxin as the dose alone, never by contact as well.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, TICK_INTERVAL_S, type EntityId } from '@evolution/shared';
import { createEngulfFixture, type EngulfFixture } from '../../testing/engulf-builders.js';
import { refreshCellDerivedState } from '../progression/modifiers.js';
import { requirePlayer } from '../world/lookups.js';
import { engulfDrainOf } from './engulf-drain.js';
import { beginEngulf } from './engulf-state.js';
import { metabolise } from './metabolism.js';

const { absorption } = DEFAULT_BALANCE;
const TOXIN_TRAIT = 'toxin_vacuole';
const SPINE_TRAIT = 'diatom_shell';
const toxinFraction = DEFAULT_BALANCE.traits.TRAIT_TIERS[TOXIN_TRAIT][0]!.toxinDrainFractionPerSecond!;
const spikeFraction = DEFAULT_BALANCE.traits.TRAIT_TIERS[SPINE_TRAIT][0]!.spikeDrainFractionPerSecond!;
/** Inside the cover band, and inside the wrap band. */
const COVER_PROGRESS = absorption.ENGULF_WRAP_START_PROGRESS / 2;
const WRAP_PROGRESS = (absorption.ENGULF_WRAP_START_PROGRESS + absorption.ENGULF_SEAL_PROGRESS) / 2;
/** A prey heavier than the builder's 20, so a dose read off the predator's 100 or the wrong cell shows. */
const PREY_MASS = 60;

/** The E9 pair with a 60-mass prey holding `traitIds` at tier I and, when `progress` is given, held at it. */
function heldPrey(traitIds: readonly string[], progress?: number): EngulfFixture {
  const fixture = createEngulfFixture({ preyMass: PREY_MASS });
  const { world, prey } = fixture;
  const preyPlayer = requirePlayer(world, prey.playerId!);
  for (const traitId of traitIds) preyPlayer.ownedTraits.push({ traitId: traitId as typeof TOXIN_TRAIT, tier: 1 });
  refreshCellDerivedState(prey, preyPlayer, world.balance);
  if (progress !== undefined) {
    beginEngulf({ predator: fixture.predator, prey });
    prey.engulfProgress = progress;
  }
  return fixture;
}

const startMasses = ({ predator, prey }: EngulfFixture): ReadonlyMap<EntityId, number> =>
  new Map([
    [predator.id, predator.mass],
    [prey.id, prey.mass],
  ]);

describe('engulfDrainOf', () => {
  it('costs a predator holding nothing nothing', () => {
    const fixture = heldPrey([TOXIN_TRAIT, SPINE_TRAIT]);
    expect(engulfDrainOf(fixture.predator, fixture.world, startMasses(fixture), fixture.world.balance)).toEqual({
      swallowedCellId: null,
      doseMassPerSecond: 0,
    });
  });

  it('costs nothing on the start tick, before any progress (the spikes bite from the tick after)', () => {
    const fixture = heldPrey([SPINE_TRAIT], 0);
    const drain = engulfDrainOf(fixture.predator, fixture.world, startMasses(fixture), fixture.world.balance);
    expect(drain.doseMassPerSecond).toBe(0);
  });

  it("charges the spikes on the prey's mass in cover, and the toxin not yet swallowed", () => {
    const fixture = heldPrey([TOXIN_TRAIT, SPINE_TRAIT], COVER_PROGRESS);
    expect(engulfDrainOf(fixture.predator, fixture.world, startMasses(fixture), fixture.world.balance)).toEqual({
      swallowedCellId: null,
      doseMassPerSecond: PREY_MASS * spikeFraction,
    });
  });

  it("charges spikes plus toxin × ENGULF_SWALLOWED_TOXIN_MULTIPLIER on the prey's mass past cover", () => {
    const fixture = heldPrey([TOXIN_TRAIT, SPINE_TRAIT], WRAP_PROGRESS);
    const drain = engulfDrainOf(fixture.predator, fixture.world, startMasses(fixture), fixture.world.balance);
    expect(drain.swallowedCellId).toBe(fixture.prey.id);
    expect(drain.doseMassPerSecond).toBeCloseTo(
      PREY_MASS * (spikeFraction + toxinFraction * absorption.ENGULF_SWALLOWED_TOXIN_MULTIPLIER),
      12,
    );
  });

  it("reads the prey's start-of-step mass, not one the loop has already decayed", () => {
    const fixture = heldPrey([TOXIN_TRAIT], WRAP_PROGRESS);
    const masses = startMasses(fixture);
    fixture.prey.mass = PREY_MASS / 2;
    const drain = engulfDrainOf(fixture.predator, fixture.world, masses, fixture.world.balance);
    expect(drain.doseMassPerSecond).toBeCloseTo(
      PREY_MASS * toxinFraction * absorption.ENGULF_SWALLOWED_TOXIN_MULTIPLIER,
      12,
    );
  });
});

/** The predator's mass loss beyond base decay over one metabolism step. */
function lossBeyondDecay(fixture: EngulfFixture): number {
  const massBefore = fixture.predator.mass;
  const decayOnly = heldPrey([]);
  metabolise(decayOnly.world, decayOnly.context);
  metabolise(fixture.world, fixture.context);
  return massBefore - fixture.predator.mass - (massBefore - decayOnly.predator.mass);
}

describe('metabolise with a held prey', () => {
  it('drains the predator by the swallowed dose alone, not the contact drain on top', () => {
    const fixture = heldPrey([TOXIN_TRAIT], WRAP_PROGRESS);
    const dose = PREY_MASS * toxinFraction * absorption.ENGULF_SWALLOWED_TOXIN_MULTIPLIER;
    expect(lossBeyondDecay(fixture)).toBeCloseTo(dose * TICK_INTERVAL_S, 9);
  });

  it('drains a predator still in cover by the contact toxin, a share of its own mass, once', () => {
    const fixture = heldPrey([TOXIN_TRAIT], COVER_PROGRESS);
    const massBefore = fixture.predator.mass;
    expect(lossBeyondDecay(fixture)).toBeCloseTo(massBefore * toxinFraction * TICK_INTERVAL_S, 9);
  });
});
