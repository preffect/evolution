// docs/ecology/giants.md §3.5.7 and docs/ecology/wild-cells.md §3.3.3: what a non-player cell eats. A wild cell algae
// and detritus, always; the grazing giant bacteria too, ahead of it first, only under its appetite; the hunting and
// drifting giants nothing. Step 4's per-cell test reads the giant's seat growth.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, FOOD_KIND, GIANT_SPECIES } from '@evolution/shared';
import { seatTestGiantCell, seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { WILD_CELL_DIET, giantDiet, isHungry, mealKindsAt, mealKindsOf } from './cell-diet.js';

const { giants } = DEFAULT_BALANCE;
const APPETITE = giants.GIANT_GRAZER_APPETITE_MASS;
const BORN_MASS = 1100;
const AWAY = { x: -1000, y: 0 };

describe('giantDiet', () => {
  it('feeds the grazer algae, detritus and bacteria within its cone and appetite', () => {
    expect(giantDiet(GIANT_SPECIES.paramecium, DEFAULT_BALANCE)).toEqual({
      foodKinds: [FOOD_KIND.algae, FOOD_KIND.detritus, FOOD_KIND.bacterium],
      forwardHalfAngleDegrees: giants.GIANT_GRAZER_FORWARD_HALF_ANGLE_DEGREES,
      appetiteMass: APPETITE,
    });
  });

  it('feeds the hunter and the drifter nothing, at any growth', () => {
    for (const species of [GIANT_SPECIES.amoeba, GIANT_SPECIES.diatom]) {
      expect(mealKindsAt(giantDiet(species, DEFAULT_BALANCE), 0)).toEqual([]);
    }
  });

  it('reads the live balance', () => {
    const patched = structuredClone(DEFAULT_BALANCE);
    patched.giants.GIANT_GRAZER_APPETITE_MASS = APPETITE * 2;
    expect(giantDiet(GIANT_SPECIES.paramecium, patched).appetiteMass).toBe(APPETITE * 2);
  });
});

describe('isHungry and mealKindsAt', () => {
  it('eats strictly under the appetite, and nothing at or over it', () => {
    const grazer = giantDiet(GIANT_SPECIES.paramecium, DEFAULT_BALANCE);
    expect(isHungry(grazer, APPETITE - 0.001)).toBe(true);
    expect(isHungry(grazer, APPETITE)).toBe(false);
    expect(mealKindsAt(grazer, APPETITE)).toEqual([]);
    expect(mealKindsAt(grazer, 0)).toEqual(grazer.foodKinds);
  });

  it('a wild cell is never sated, and never eats a bacterium', () => {
    expect(mealKindsAt(WILD_CELL_DIET, Number.MAX_SAFE_INTEGER)).toEqual([FOOD_KIND.algae, FOOD_KIND.detritus]);
  });
});

describe('mealKindsOf (step 4)', () => {
  it("reads a giant's growth from its seat", () => {
    const world = createTestWorld();
    const hungry = seatTestGiantCell(world, { species: GIANT_SPECIES.paramecium, at: AWAY, bornMass: BORN_MASS });
    expect(mealKindsOf(world, hungry.cell, DEFAULT_BALANCE)).toContain(FOOD_KIND.bacterium);
    hungry.seat.grownMass = APPETITE;
    expect(mealKindsOf(world, hungry.cell, DEFAULT_BALANCE)).toEqual([]);
  });

  it('a wild cell eats algae and detritus; the amoeba nothing', () => {
    const world = createTestWorld();
    const wild = seatTestWildCell(world, { seatNumber: 0, at: AWAY, mass: BORN_MASS }).cell;
    expect(mealKindsOf(world, wild, DEFAULT_BALANCE)).toEqual(WILD_CELL_DIET.foodKinds);
    const amoeba = seatTestGiantCell(world, { species: GIANT_SPECIES.amoeba, at: AWAY, bornMass: BORN_MASS }).cell;
    expect(mealKindsOf(world, amoeba, DEFAULT_BALANCE)).toEqual([]);
  });
});
