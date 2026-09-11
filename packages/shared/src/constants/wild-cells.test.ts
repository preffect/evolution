// docs/ECOLOGY.md §3.3: every wild build is a valid ladder (the T10 pattern: each entry's stage
// and `requires` are met by the entries before it), all three climb the stages in step with
// build 0 (which defines `worldStage`), and the seat and behaviour knobs hold their bounds.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE, type CellStage, type TraitId } from '../types/game.js';
import type { TraitDefinition } from '../types/traits.js';
import { ENGULF_MASS_RATIO } from './absorption.js';
import { DEFAULT_BALANCE } from './balance.js';
import { STAGE_ORDER } from './ladder.js';
import { TRAIT_CATALOG } from './traits.js';
import { stageOf } from '../simulation/stage-of.js';
import {
  WILD_CELL_BUILDS,
  WILD_CELL_COUNT,
  WILD_CELL_HUNTS_FROM_STAGE,
  WILD_CELL_MASS_SPREAD,
  WILD_CELL_TURN_CHANCE,
  WORLD_ORGANISM_ID,
} from './wild-cells.js';

const BUILD_COUNT = 3;
/** docs/ECOLOGY.md §3.3: the stage the world reaches after each pick, the same for every build. */
const STAGE_AFTER_PICKS: readonly CellStage[] = [
  CELL_STAGE.protocell,
  CELL_STAGE.prokaryote,
  CELL_STAGE.endosymbiosis,
  CELL_STAGE.eukaryote,
  CELL_STAGE.eukaryote,
  CELL_STAGE.specialised,
];

const catalog: readonly TraitDefinition[] = TRAIT_CATALOG;
const traitById = (id: TraitId): TraitDefinition => catalog.find((trait) => trait.id === id)!;
const stageIndex = (stage: CellStage): number => STAGE_ORDER.indexOf(stage);

describe('WILD_CELL_BUILDS', () => {
  it('holds three builds of the same length', () => {
    expect(WILD_CELL_BUILDS).toHaveLength(BUILD_COUNT);
    for (const build of WILD_CELL_BUILDS) expect(build).toHaveLength(WILD_CELL_BUILDS[0]!.length);
  });

  it.each(WILD_CELL_BUILDS.map((build, seat) => [seat, build] as const))(
    'build %i is a valid ladder: every pick is reachable from the picks before it',
    (_seat, build) => {
      expect(new Set(build).size).toBe(build.length);
      build.forEach((traitId, index) => {
        const owned = build.slice(0, index);
        const trait = traitById(traitId);
        expect(stageIndex(trait.stage)).toBeLessThanOrEqual(stageIndex(stageOf(owned, DEFAULT_BALANCE.ladder)));
        for (const requiredId of trait.requires) expect(owned).toContain(requiredId);
      });
    },
  );

  it.each(WILD_CELL_BUILDS.map((build, seat) => [seat, build] as const))(
    'build %i climbs the stages in step with build 0, so worldStage holds for every seat',
    (_seat, build) => {
      STAGE_AFTER_PICKS.forEach((stage, picks) => {
        expect(stageOf(build.slice(0, picks), DEFAULT_BALANCE.ladder)).toBe(stage);
      });
    },
  );
});

describe('wild cell knobs', () => {
  it('spreads the seats so a player at exactly the world mass has both lunch and threats among them (§3.3)', () => {
    expect(WILD_CELL_COUNT).toBeGreaterThan(0);
    expect(1 - WILD_CELL_MASS_SPREAD).toBeLessThanOrEqual(1 / ENGULF_MASS_RATIO);
    expect(1 + WILD_CELL_MASS_SPREAD).toBeGreaterThanOrEqual(ENGULF_MASS_RATIO);
  });

  it('starts hunting at a stage of the ladder and turns with a proper probability', () => {
    expect(STAGE_ORDER).toContain(WILD_CELL_HUNTS_FROM_STAGE);
    expect(WILD_CELL_TURN_CHANCE).toBeGreaterThan(0);
    expect(WILD_CELL_TURN_CHANCE).toBeLessThan(1);
  });

  it('names one organism for every wild cell', () => {
    expect(WORLD_ORGANISM_ID.length).toBeGreaterThan(0);
  });
});
