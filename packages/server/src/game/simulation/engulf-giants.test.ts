// docs/ecology/acceptance.md G4, the predicate part (docs/ecology/giants.md §3.5.6), through the engulf step and the
// separation's pair rule rather than the shared predicate alone: the giant amoeba swallows a cell it touches below its
// hunt window, and the giant paramecium and diatom start no engulf on a small cell in contact, so separation pushes the
// pair apart instead of leaving it to an engulf. The giant is a placed cell with its species set: the seats are slice 2.
import { describe, expect, it } from 'vitest';
import { CELL_STATE, GIANT_SPECIES, type GiantSpecies } from '@evolution/shared';
import { createEngulfFixture, stepEngulf, type EngulfFixture } from '../../testing/engulf-builders.js';
import { isEngulfPossible } from './contact.js';

/** G4's pairs: the amoeba born 1000 against A at 240; the grazer and the drifter against wild seat 0 at 200. */
const AMOEBA_MASS = 1000;
const UNDER_THE_WINDOW_MASS = 240;
const GRAZER_MASS = 1100;
const DRIFTER_MASS = 1200;
const SMALL_CELL_MASS = 200;
/** G4's variants run 60 ticks. */
const VARIANT_TICKS = 60;

function giantTouching(species: GiantSpecies, giantMass: number, preyMass: number): EngulfFixture {
  const fixture = createEngulfFixture({ predatorMass: giantMass, preyMass });
  fixture.predator.giantSpecies = species;
  return fixture;
}

describe('the giants and the engulf step (G4, giants.md §3.5.6)', () => {
  it('lets the amoeba swallow a cell under its hunt window that touches it: the engulf starts on tick 1', () => {
    const fixture = giantTouching(GIANT_SPECIES.amoeba, AMOEBA_MASS, UNDER_THE_WINDOW_MASS);
    const { world, predator, prey } = fixture;
    expect(isEngulfPossible({ lower: predator, higher: prey }, world, world.balance)).toBe(true);
    stepEngulf(fixture);
    expect(prey.engulfedByCellId).toBe(predator.id);
    expect(prey.states).toContain(CELL_STATE.beingEngulfed);
  });

  it.each([
    [GIANT_SPECIES.paramecium, GRAZER_MASS],
    [GIANT_SPECIES.diatom, DRIFTER_MASS],
  ])(
    'starts no engulf with the %s (mass %i) as predator in 60 ticks, and leaves the pair to separation',
    (species, mass) => {
      const fixture = giantTouching(species, mass, SMALL_CELL_MASS);
      const { world, predator, prey } = fixture;
      expect(isEngulfPossible({ lower: predator, higher: prey }, world, world.balance)).toBe(false);
      stepEngulf(fixture, VARIANT_TICKS);
      expect(prey.engulfedByCellId).toBeNull();
      expect(predator.engulfingCellId).toBeNull();
    },
  );
});
