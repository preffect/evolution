// docs/ecology/wild-cells.md §3.3: every wild build is a valid ladder (`ladderProblem`, the giants' rule too: each
// entry's stage, `requires` and exclusion group are met by the entries before it), all three climb the stages in step
// with build 0 (which defines `worldStage`), and the seat and behaviour knobs hold their bounds.

import { describe, expect, it } from 'vitest';
import { CELL_STAGE, type CellStage } from '../types/game.js';
import { ENGULF_MASS_RATIO } from './absorption.js';
import { DEFAULT_BALANCE } from './balance.js';
import { STAGE_ORDER } from './ladder.js';
import { ladderProblem } from '../simulation/ladder-check.js';
import { stageOf } from '../simulation/stage-of.js';
import {
  WILD_CELL_BUILDS,
  WILD_CELL_COUNT,
  WILD_CELL_HUNTS_PLAYERS_FROM_STAGE,
  WILD_CELL_MAX_WORLD_MASS_MULTIPLE,
  WILD_CELL_RECOVERY_SECONDS,
  WILD_CELL_SIZE_FACTOR_MAX,
  WILD_CELL_SIZE_FACTOR_MIN,
  WILD_CELL_TURN_CHANCE,
} from './wild-cells.js';

const BUILD_COUNT = 3;
/** docs/ecology/wild-cells.md §3.3: the stage the world reaches after each pick, the same for every build. */
const STAGE_AFTER_PICKS: readonly CellStage[] = [
  CELL_STAGE.protocell,
  CELL_STAGE.prokaryote,
  CELL_STAGE.endosymbiosis,
  CELL_STAGE.eukaryote,
  CELL_STAGE.eukaryote,
  CELL_STAGE.specialised,
];

describe('WILD_CELL_BUILDS', () => {
  it('holds three builds of the same length', () => {
    expect(WILD_CELL_BUILDS).toHaveLength(BUILD_COUNT);
    for (const build of WILD_CELL_BUILDS) expect(build).toHaveLength(WILD_CELL_BUILDS[0]!.length);
  });

  it.each(WILD_CELL_BUILDS.map((build, seat) => [seat, build] as const))(
    'build %i is a valid ladder: every pick is reachable from the picks before it',
    (_seat, build) => {
      expect(ladderProblem(build, DEFAULT_BALANCE)).toBeNull();
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
  it('sizes the seats so a player at exactly the world mass has both lunch and threats among them (§3.3.5)', () => {
    expect(WILD_CELL_COUNT).toBeGreaterThan(0);
    expect(WILD_CELL_SIZE_FACTOR_MIN).toBeLessThanOrEqual(1 / ENGULF_MASS_RATIO);
    expect(WILD_CELL_SIZE_FACTOR_MAX).toBeGreaterThanOrEqual(ENGULF_MASS_RATIO);
  });

  it('caps growth above the biggest newborn and recovers a wound with a positive time constant (§3.3.1)', () => {
    expect(WILD_CELL_MAX_WORLD_MASS_MULTIPLE).toBeGreaterThan(WILD_CELL_SIZE_FACTOR_MAX);
    expect(WILD_CELL_RECOVERY_SECONDS).toBeGreaterThan(0);
  });

  it('starts hunting at a stage of the ladder and turns with a proper probability', () => {
    expect(STAGE_ORDER).toContain(WILD_CELL_HUNTS_PLAYERS_FROM_STAGE);
    expect(WILD_CELL_TURN_CHANCE).toBeGreaterThan(0);
    expect(WILD_CELL_TURN_CHANCE).toBeLessThan(1);
  });
});
