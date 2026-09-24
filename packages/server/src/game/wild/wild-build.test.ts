// docs/ecology/wild-cells.md §3.3: a wild cell at level L owns the first L − 1 picks of its seat's build, wrapping as
// tier upgrades; every build is a valid ladder whose stage at every level is the world's.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE, FIRST_LEVEL, stageOf, worldReference } from '@evolution/shared';
import { stageOfOwned } from '../progression/ladder.js';
import { SimulationInvariantError } from '../world/simulation-invariant-error.js';
import { wildOwnedTraits } from './wild-build.js';

const { wildCells, worldClock, progression } = DEFAULT_BALANCE;
const BUILD_LENGTH = wildCells.WILD_CELL_BUILDS[0]!.length;

describe('wildOwnedTraits', () => {
  it('owns nothing at level 1 and the first L − 1 picks of its build at tier I below the wrap', () => {
    expect(wildOwnedTraits(0, FIRST_LEVEL, DEFAULT_BALANCE)).toEqual([]);
    expect(wildOwnedTraits(0, 2, DEFAULT_BALANCE)).toEqual([{ traitId: 'nucleoid', tier: 1 }]);
    expect(wildOwnedTraits(1, 3, DEFAULT_BALANCE)).toEqual([
      { traitId: 'nucleoid', tier: 1 },
      { traitId: 'chloroplast', tier: 1 },
    ]);
    expect(wildOwnedTraits(2, BUILD_LENGTH + 1, DEFAULT_BALANCE).map((owned) => owned.traitId)).toEqual([
      ...wildCells.WILD_CELL_BUILDS[2]!,
    ]);
  });

  it('picks the build by seat mod the build count', () => {
    for (const seat of [0, 1, 2, 3, 4, 5, 23]) {
      const build = wildCells.WILD_CELL_BUILDS[seat % wildCells.WILD_CELL_BUILDS.length]!;
      expect(wildOwnedTraits(seat, 2, DEFAULT_BALANCE)[0]?.traitId).toBe(build[0]);
    }
  });

  it('wraps past the build as tier upgrades: entry 8 is entry 1 at tier II, build order kept', () => {
    const owned = wildOwnedTraits(0, BUILD_LENGTH + 2, DEFAULT_BALANCE);
    expect(owned).toHaveLength(BUILD_LENGTH);
    expect(owned[0]).toEqual({ traitId: 'nucleoid', tier: 2 });
    expect(owned.slice(1).every((trait) => trait.tier === 1)).toBe(true);
    const atMax = wildOwnedTraits(0, progression.MAX_LEVEL, DEFAULT_BALANCE);
    expect(atMax.filter((trait) => trait.tier === 2)).toHaveLength(progression.MAX_LEVEL - 1 - BUILD_LENGTH);
  });

  it('reaches the world stage at every whole level for every build (the ladder holds)', () => {
    for (let level = FIRST_LEVEL; level <= progression.MAX_LEVEL; level += 1) {
      const elapsed = (level - FIRST_LEVEL) * worldClock.WORLD_LEVEL_SECONDS;
      const { worldStage } = worldReference(elapsed, DEFAULT_BALANCE);
      for (const seat of [0, 1, 2]) {
        const owned = wildOwnedTraits(seat, level, DEFAULT_BALANCE);
        expect(stageOfOwned(owned, DEFAULT_BALANCE)).toBe(worldStage);
        expect(
          stageOf(
            owned.map((trait) => trait.traitId),
            DEFAULT_BALANCE.ladder,
          ),
        ).toBe(worldStage);
      }
    }
  });

  it('refuses a wrap past the top tier instead of casting it to a tier the catalog has no row for', () => {
    const nucleoid = wildCells.WILD_CELL_BUILDS[0]![0]!;
    const oneTraitBuild = structuredClone(DEFAULT_BALANCE);
    oneTraitBuild.wildCells.WILD_CELL_BUILDS = [[nucleoid]];
    const topTier = DEFAULT_BALANCE.traits.TRAIT_TIER_COUNT;
    const topTierLevel = FIRST_LEVEL + topTier;
    expect(wildOwnedTraits(0, topTierLevel, oneTraitBuild)).toEqual([{ traitId: nucleoid, tier: topTier }]);
    expect(() => wildOwnedTraits(0, topTierLevel + 1, oneTraitBuild)).toThrow(SimulationInvariantError);
  });
});
