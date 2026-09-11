// docs/ECOLOGY.md §8, the placed rows on eating, decay, size and speed (E4–E8, E12, E15), each
// run twice and hash-compared. The seeded spawn rows are ecology-spawn.gameplay.test.ts; the
// engulf rows (E9–E11, E13, E16) wait for the engulf slice of #98.

import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, DEFAULT_BALANCE, FOOD_KIND, ZONE_ID, distanceBetween } from '@evolution/shared';
import { cellOf, foodCount, massOf, progressOf, speedOf } from '../gameplay/evolution-views.js';
import { ZONE, eastOfCellOf, gelPatchCentre, insideCellOf, player, targetRadiiEast } from '../gameplay/index.js';
import {
  FULL_THROTTLE_RADII,
  MASS_TOLERANCE,
  SPEED_TOLERANCE_WU_PER_SECOND,
  decayed,
  placedSolo,
} from './shared-setups.js';

const { ecology, growth, world: dish } = DEFAULT_BALANCE;

describe('ECOLOGY §8: eating, decay, size and speed on placed cells', () => {
  it.each([
    [FOOD_KIND.algae, undefined, { mass: growth.CELL_STARTING_MASS + ecology.ALGAE_MASS, dna: 0, tag: 'photic' }],
    [
      FOOD_KIND.bacterium,
      BACTERIUM_VARIANT.plain,
      { mass: growth.CELL_STARTING_MASS + ecology.BACTERIUM_MASS, dna: 1, tag: 'motile' },
    ],
    [
      FOOD_KIND.bacterium,
      BACTERIUM_VARIANT.aerobic,
      { mass: growth.CELL_STARTING_MASS + ecology.BACTERIUM_MASS, dna: 1, tag: 'metabolic' },
    ],
  ] as const)('E4: a %s (%s) 10 wu east of the seeded cell is eaten on tick 1', (moteKind, variant, expected) => {
    placedSolo(`E4 ${moteKind} ${variant ?? ''}`)
      .placeMote({ moteKind, variant, at: eastOfCellOf(0, 10) })
      .advance(1)
      .expect('mass', (view) => massOf(view, 0))
      .atTick(1)
      .toBeCloseTo(expected.mass, MASS_TOLERANCE)
      .expect('mote gone', foodCount)
      .atTick(1)
      .toBe(0)
      .expect('dna', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(1)
      .toBe(expected.dna)
      .expect('one tag point', (view) => progressOf(view, 0)?.dnaTagPoints[expected.tag])
      .atTick(1)
      .toBe(1)
      .expect('aerobic counter', (view) => progressOf(view, 0)?.bacteriaEatenByVariant.aerobic)
      .atTick(1)
      .toBe(variant === BACTERIUM_VARIANT.aerobic ? 1 : 0)
      .runDeterministic();
  });

  it('E5: a 1020-mass cell decays in the broth and 1.5× as fast in the vent', () => {
    placedSolo('E5 broth')
      .placeCell({ playerIndex: 0, mass: 1020 })
      .advance(60)
      .expect('mass', (view) => massOf(view, 0))
      .atTick(60)
      .toBeCloseTo(decayed(1020, 60), MASS_TOLERANCE)
      .runDeterministic();
    placedSolo('E5 vent')
      .placeCell({ playerIndex: 0, mass: 1020, at: ZONE.vent })
      .advance(60)
      .expect('mass', (view) => massOf(view, 0))
      .atTick(60)
      .toBeCloseTo(decayed(1020, 60, ecology.VENT_DECAY_MULTIPLIER), MASS_TOLERANCE)
      .runDeterministic();
  });

  it.each([
    [320, 110.1],
    [5000, 55.4],
  ])('E6: a %d-mass cell at full throttle converges on %f wu/s', (mass, speed) => {
    placedSolo(`E6 ${mass}`)
      .placeCell({ playerIndex: 0, mass })
      .from(1, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
      .advance(120)
      .expect('speed', (view) => speedOf(view, 0))
      .atTick(120)
      .toBeCloseTo(speed, SPEED_TOLERANCE_WU_PER_SECOND)
      .runDeterministic();
  });

  it('E7: radius follows the square root of the decayed mass', () => {
    placedSolo('E7')
      .placeCell({ playerIndex: 0, mass: 80 })
      .advance(1)
      .expect('radius', (view) => cellOf(view, 0)?.radius)
      .atTick(1)
      .toBeCloseTo(35.78, MASS_TOLERANCE)
      .runDeterministic();
  });

  it('E8: the gel cuts a 500-mass cell to 49.4 wu/s and it stays inside the patch', () => {
    const gelTravelWu = 87;
    const travelToleranceWu = 2;
    placedSolo('E8')
      .placeCell({ playerIndex: 0, mass: 500, at: gelPatchCentre(0) })
      .from(1, player(0).does(targetRadiiEast(FULL_THROTTLE_RADII)))
      .advance(120)
      .capture('start', (view) => cellOf(view, 0))
      .atTick(0)
      .expect('speed', (view) => speedOf(view, 0))
      .atTick(120)
      .toBeCloseTo(49.4, SPEED_TOLERANCE_WU_PER_SECOND)
      .expect('travelled', (view) =>
        distanceBetween(view.captured('start') as { x: number; y: number }, cellOf(view, 0)!),
      )
      .atTick(120)
      .toBeCloseTo(gelTravelWu, travelToleranceWu)
      .expect('still inside the patch', (view) => distanceBetween(view.snapshot.gelPatches[0]!, cellOf(view, 0)!))
      .atTick(120)
      .toBeLessThan(ecology.GEL_PATCH_RADIUS)
      .runDeterministic();
  });

  it('E12: eating at the cap converts the overflow to DNA before decay', () => {
    placedSolo('E12')
      .placeCell({ playerIndex: 0, mass: growth.CELL_MAX_MASS })
      .placeMote({ moteKind: FOOD_KIND.algae, at: insideCellOf(0) })
      .advance(1)
      .expect('dna', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(1)
      .toBeCloseTo(ecology.ALGAE_MASS * growth.MASS_OVERFLOW_DNA_PER_MASS, MASS_TOLERANCE)
      .expect('mass', (view) => massOf(view, 0))
      .atTick(1)
      .toBeCloseTo(decayed(growth.CELL_MAX_MASS, 1), MASS_TOLERANCE)
      .runDeterministic();
  });

  it('E15: ten photosynthetic bacteria fill the chloroplast counter, each DNA gain × the nucleoid', () => {
    const bacteria = 10;
    const nucleoidTierOneDnaGain = 1.05;
    const run = placedSolo('E15')
      .placeCell({ playerIndex: 0, mass: growth.CELL_STARTING_MASS, traits: ['nucleoid'] })
      .advance(bacteria);
    for (let tick = 1; tick <= bacteria; tick += 1) {
      run
        .atTick(tick)
        .placeMote({ moteKind: FOOD_KIND.bacterium, variant: BACTERIUM_VARIANT.photosynthetic, at: insideCellOf(0) });
    }
    run
      .expect('photosynthetic after tick 9', (view) => progressOf(view, 0)?.bacteriaEatenByVariant.photosynthetic)
      .atTick(bacteria - 1)
      .toBe(bacteria - 1)
      .expect('photosynthetic', (view) => progressOf(view, 0)?.bacteriaEatenByVariant.photosynthetic)
      .atTick(bacteria)
      .toBe(bacteria)
      .expect('aerobic', (view) => progressOf(view, 0)?.bacteriaEatenByVariant.aerobic)
      .atTick(bacteria)
      .toBe(0)
      .expect('photic tag points', (view) => progressOf(view, 0)?.dnaTagPoints.photic)
      .atTick(bacteria)
      .toBe(bacteria)
      .expect('dna', (view) => progressOf(view, 0)?.dnaCumulative)
      .atTick(bacteria)
      .toBeCloseTo(bacteria * ecology.BACTERIUM_DNA * nucleoidTierOneDnaGain, MASS_TOLERANCE)
      .runDeterministic();
  });

  it('the placed-row convention: the broth point is in the open broth, 1000 wu from the vent and the shallows', () => {
    expect(ZONE_ID.openBroth).toBe('open_broth');
    expect(dish.DISH_RADIUS - ecology.SHALLOWS_WIDTH - 1500).toBe(1000);
    expect(1500 - ecology.VENT_RADIUS).toBe(1000);
  });
});
