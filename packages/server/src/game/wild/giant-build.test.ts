// docs/ecology/giants.md §3.5.4, §3.5.5 and docs/ecology/acceptance.md §8.2 G8: a giant owns its species' fixed build
// at its tiers, its level is picks + 1 (amoeba 7, the others 6), its stage `specialised`, and its speed cap is its
// traits' × the species multiplier, kept through any number of refreshes (the multiplier's one home).
import { describe, expect, it } from 'vitest';
import {
  CELL_STAGE,
  DEFAULT_BALANCE,
  GIANT_SPECIES,
  GIANT_SPECIES_ORDER,
  speedCapFor,
  type GiantSpecies,
} from '@evolution/shared';
import { seatTestGiantCell, seatTestWildCell } from '../../testing/wild-builders.js';
import { createTestWorld } from '../../testing/world-builders.js';
import { refreshCellDerivedStateFromTraits } from '../progression/modifiers.js';
import type { CellRecord } from '../world/entities.js';
import { applyGiantBuild, giantBuildOf, giantLevelOf, refreshAnyCellFromItsTraits } from './giant-build.js';

const { giants } = DEFAULT_BALANCE;
const SPEED_DIGITS = 3;
const BORN_MASS = 1000;
const SOMEWHERE = { x: 0, y: 0 };
/** G8's speeds (wu/s): out of gel, `engulfFactor` 1. */
const CRUISE: Record<GiantSpecies, number> = {
  [GIANT_SPECIES.amoeba]: 154.0,
  [GIANT_SPECIES.paramecium]: 226.27,
  [GIANT_SPECIES.diatom]: 121.638,
};
const SPRINT: Record<GiantSpecies, number> = {
  [GIANT_SPECIES.amoeba]: 292.6,
  [GIANT_SPECIES.paramecium]: 429.913,
  [GIANT_SPECIES.diatom]: 218.948,
};
const LEVEL: Record<GiantSpecies, number> = {
  [GIANT_SPECIES.amoeba]: 7,
  [GIANT_SPECIES.paramecium]: 6,
  [GIANT_SPECIES.diatom]: 6,
};

/** `speedCapFor` over the cell's folded modifiers, out of gel and engulfing nothing. */
function speedCapOfGiant(cell: CellRecord, isSprinting: boolean): number {
  return speedCapFor(
    {
      mass: cell.mass,
      radiusWu: cell.radius,
      sprintRemainingTicks: isSprinting ? 1 : 0,
      modifiers: cell.modifiers,
      isInGel: false,
      engulfFactor: 1,
    },
    DEFAULT_BALANCE,
  );
}

function giantOf(species: GiantSpecies): CellRecord {
  return seatTestGiantCell(createTestWorld(), { species, at: SOMEWHERE, bornMass: BORN_MASS }).cell;
}

describe('giantLevelOf', () => {
  it('counts every tier as a pick: amoeba 7 (Pseudopods II is two picks), paramecium and diatom 6', () => {
    for (const species of GIANT_SPECIES_ORDER) {
      expect(giantLevelOf(giantBuildOf(species, DEFAULT_BALANCE)), species).toBe(LEVEL[species]);
    }
  });
});

describe('applyGiantBuild', () => {
  it.each(GIANT_SPECIES_ORDER)('lays the %s build on the cell: traits, level and stage', (species) => {
    const cell = giantOf(species);
    expect(cell.traits).toEqual(giants.GIANT_BUILDS_BY_SPECIES[species]);
    expect(cell.level).toBe(LEVEL[species]);
    expect(cell.stage).toBe(CELL_STAGE.specialised);
  });

  it.each(GIANT_SPECIES_ORDER)('G8: the %s cruises and sprints at its species speed', (species) => {
    const cell = giantOf(species);
    expect(speedCapOfGiant(cell, false)).toBeCloseTo(CRUISE[species], SPEED_DIGITS);
    expect(speedCapOfGiant(cell, true)).toBeCloseTo(SPRINT[species], SPEED_DIGITS);
  });

  it.each(GIANT_SPECIES_ORDER)('G8: keeps the %s speeds after a second and a third refresh', (species) => {
    const cell = giantOf(species);
    applyGiantBuild(cell, species, DEFAULT_BALANCE);
    applyGiantBuild(cell, species, DEFAULT_BALANCE);
    expect(speedCapOfGiant(cell, false)).toBeCloseTo(CRUISE[species], SPEED_DIGITS);
    expect(speedCapOfGiant(cell, true)).toBeCloseTo(SPRINT[species], SPEED_DIGITS);
  });

  it('is what a refresh straight from the traits misses: the traits alone run the amoeba at 220', () => {
    const cell = giantOf(GIANT_SPECIES.amoeba);
    refreshCellDerivedStateFromTraits(cell, cell.traits, DEFAULT_BALANCE);
    expect(speedCapOfGiant(cell, false)).toBeCloseTo(DEFAULT_BALANCE.growth.CELL_BASE_SPEED, SPEED_DIGITS);
  });
});

describe('refreshAnyCellFromItsTraits', () => {
  it('refreshes a giant through its build, so the species multiplier stays', () => {
    const cell = giantOf(GIANT_SPECIES.diatom);
    refreshAnyCellFromItsTraits(cell, DEFAULT_BALANCE);
    expect(speedCapOfGiant(cell, false)).toBeCloseTo(CRUISE[GIANT_SPECIES.diatom], SPEED_DIGITS);
  });

  it('refreshes any other cell straight from the traits it holds', () => {
    const world = createTestWorld();
    const { cell } = seatTestWildCell(world, { at: SOMEWHERE });
    cell.traits = [{ traitId: 'cilia', tier: 1 }];
    refreshAnyCellFromItsTraits(cell, DEFAULT_BALANCE);
    const cilia = DEFAULT_BALANCE.traits.TRAIT_TIERS.cilia[0]!.speedMultiplier!;
    expect(cell.modifiers.speedMultiplier).toBe(cilia);
    const player = world.cells[0]!;
    refreshAnyCellFromItsTraits(player, DEFAULT_BALANCE);
    expect(player.modifiers.speedMultiplier).toBe(1);
  });
});
