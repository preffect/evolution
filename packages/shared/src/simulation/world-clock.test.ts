// docs/ecology/food-and-spawn.md §3.1 (the reference table, W1), the tick arithmetic of the level-up ticks (G11)
// and the standing rows of GAME-DESIGN G12.

import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '../constants/balance.js';
import { TICK_HZ } from '../constants/network.js';
import { ROUND_DURATION_SECONDS } from '../constants/session.js';
import { withErasInPlay } from '../testing/era-balance.js';
import { CELL_STAGE, GAME_ERA, GAME_ERA_ORDER, WORLD_STANDING, type CellStage } from '../types/game.js';
import {
  standingAgainstWorld,
  worldElapsedSeconds,
  worldReference,
  worldReferenceInEra,
  worldWholeLevel,
} from './world-clock.js';

const balance = DEFAULT_BALANCE;

interface ReferenceRow {
  seconds: number;
  level: number;
  stage: CellStage;
  mass: number;
  dna: number;
}
/** The §3.1 table, row by row. */
const REFERENCE_TABLE: readonly ReferenceRow[] = [
  { seconds: 0, level: 1, stage: CELL_STAGE.protocell, mass: 20, dna: 0 },
  { seconds: 180, level: 2, stage: CELL_STAGE.prokaryote, mass: 200, dna: 60 },
  { seconds: 360, level: 3, stage: CELL_STAGE.endosymbiosis, mass: 380, dna: 140 },
  { seconds: 540, level: 4, stage: CELL_STAGE.eukaryote, mass: 560, dna: 240 },
  { seconds: 720, level: 5, stage: CELL_STAGE.eukaryote, mass: 740, dna: 360 },
  { seconds: 900, level: 6, stage: CELL_STAGE.specialised, mass: 920, dna: 500 },
  { seconds: 1980, level: 12, stage: CELL_STAGE.specialised, mass: 2000, dna: 1760 },
];
const TEN_MINUTES = 600;
const LEVEL_AT_TEN_MINUTES = 4.33;
const MASS_AT_TEN_MINUTES = 620;
const JUST_UNDER_FIRST_LEVEL_UP = 179.99;
const FIRST_LEVEL_UP_TICK = 10_800;
const RESULTS_END_TICK = 37_200;
const LEVEL_DIGITS = 2;
/** The game's length with every era on (phases.md §14.2.3). */
const COLONIES_ON_ROUND_SECONDS = 1500;
/** §14.2.2's pool masses: 60 at 10:00, 270 at 17:00, 510 at 25:00. */
const POOL_MASS_BY_SECONDS: readonly [number, number][] = [
  [600, 60],
  [1020, 270],
  [1500, 510],
];

describe('worldReference', () => {
  it.each(REFERENCE_TABLE)('at $seconds s: level $level, $stage, mass $mass, dna $dna (W1)', (row) => {
    const { seconds, level, stage, mass, dna } = row;
    const reference = worldReference(seconds, balance);
    expect(reference.worldLevel).toBeCloseTo(level, LEVEL_DIGITS);
    expect(reference.worldStage).toBe(stage);
    expect(reference.worldMass).toBe(mass);
    expect(reference.worldDna).toBe(dna);
  });

  it('is continuous in level and mass: 4.33 and 620 at 10:00', () => {
    const reference = worldReference(TEN_MINUTES, balance);
    expect(reference.worldLevel).toBeCloseTo(LEVEL_AT_TEN_MINUTES, LEVEL_DIGITS);
    expect(reference.worldMass).toBe(MASS_AT_TEN_MINUTES);
    expect(reference.worldStage).toBe(CELL_STAGE.eukaryote);
  });

  it('stays a level-1 protocell just under the first level-up and flips exactly on it', () => {
    expect(worldReference(JUST_UNDER_FIRST_LEVEL_UP, balance).worldStage).toBe(CELL_STAGE.protocell);
    expect(worldReference(JUST_UNDER_FIRST_LEVEL_UP, balance).worldDna).toBe(0);
    const onTheTick = worldReference(worldElapsedSeconds(FIRST_LEVEL_UP_TICK, 0, ROUND_DURATION_SECONDS), balance);
    expect(onTheTick.worldLevel).toBe(2);
    expect(onTheTick.worldStage).toBe(CELL_STAGE.prokaryote);
  });

  it('caps the level at MAX_LEVEL and the mass at CELL_MAX_MASS', () => {
    const farFuture = worldReference(balance.growth.CELL_MAX_MASS * TICK_HZ, balance);
    expect(farFuture.worldLevel).toBe(balance.progression.MAX_LEVEL);
    expect(farFuture.worldMass).toBe(balance.growth.CELL_MAX_MASS);
  });

  it('reads its pace from the balance it is given', () => {
    const custom = structuredClone(balance);
    custom.worldClock.WORLD_LEVEL_SECONDS = 60;
    custom.worldClock.WORLD_MASS_GAIN_PER_SECOND = 2;
    expect(worldReference(60, custom).worldLevel).toBe(2);
    expect(worldReference(60, custom).worldMass).toBe(140);
  });
});

describe('worldWholeLevel', () => {
  it('floors the continuous level, so a world halfway to the next level is still at the last one', () => {
    expect(worldWholeLevel({ worldLevel: 3.5 })).toBe(3);
    expect(worldWholeLevel({ worldLevel: 3.99 })).toBe(3);
    expect(worldWholeLevel({ worldLevel: 4 })).toBe(4);
  });
});

describe('worldElapsedSeconds', () => {
  it('reads the tick in progress: tick 10 800 is 180 s exactly (G11)', () => {
    expect(worldElapsedSeconds(FIRST_LEVEL_UP_TICK, 0, ROUND_DURATION_SECONDS)).toBe(180);
  });

  it('counts from the round start, so a rematch restarts the clock', () => {
    expect(worldElapsedSeconds(RESULTS_END_TICK, RESULTS_END_TICK, ROUND_DURATION_SECONDS)).toBe(0);
    expect(worldElapsedSeconds(RESULTS_END_TICK + FIRST_LEVEL_UP_TICK, RESULTS_END_TICK, ROUND_DURATION_SECONDS)).toBe(
      180,
    );
  });

  it('freezes at the round length through the results screen', () => {
    expect(worldElapsedSeconds(RESULTS_END_TICK, 0, ROUND_DURATION_SECONDS)).toBe(ROUND_DURATION_SECONDS);
  });

  it('reads a tick before the round start as the start, so the world is never below level 1 (#173)', () => {
    expect(worldElapsedSeconds(0, RESULTS_END_TICK, ROUND_DURATION_SECONDS)).toBe(0);
    const beforeStart = worldReference(worldElapsedSeconds(0, RESULTS_END_TICK, ROUND_DURATION_SECONDS), balance);
    expect(beforeStart).toEqual(worldReference(0, balance));
  });
});

describe('worldReferenceInEra (docs/game-design/phases.md §14.2.2)', () => {
  const colonies = withErasInPlay(GAME_ERA_ORDER);

  it.each(POOL_MASS_BY_SECONDS)('restarts the world mass at the move: %s s reads %s', (seconds, mass) => {
    expect(worldReferenceInEra(seconds, COLONIES_ON_ROUND_SECONDS, colonies).worldMass).toBe(mass);
  });

  it('keeps the level and the DNA on their absolute curves past the move', () => {
    const dish = worldReference(TEN_MINUTES, balance);
    const inPool = worldReferenceInEra(TEN_MINUTES, COLONIES_ON_ROUND_SECONDS, colonies);
    expect(inPool).toEqual({ ...dish, worldMass: inPool.worldMass });
    expect(inPool.worldMass).not.toBe(dish.worldMass);
  });

  it('is worldReference in the dish, and throughout a round the eras are off in or too short for', () => {
    const justBeforeTheMove = TEN_MINUTES - 1 / TICK_HZ;
    expect(worldReferenceInEra(justBeforeTheMove, COLONIES_ON_ROUND_SECONDS, colonies)).toEqual(
      worldReference(justBeforeTheMove, colonies),
    );
    expect(worldReferenceInEra(TEN_MINUTES, COLONIES_ON_ROUND_SECONDS, balance)).toEqual(
      worldReference(TEN_MINUTES, balance),
    );
    expect(worldReferenceInEra(TEN_MINUTES, TEN_MINUTES, colonies)).toEqual(worldReference(TEN_MINUTES, colonies));
  });

  it('reads the move from the pool’s start, so a patched start moves the restart', () => {
    const early = structuredClone(colonies);
    early.eras.ERA_START_SECONDS = { ...early.eras.ERA_START_SECONDS, [GAME_ERA.pool]: 60 };
    expect(worldReferenceInEra(60, COLONIES_ON_ROUND_SECONDS, early).worldMass).toBe(
      balance.pool.POOL_WORLD_MASS_START,
    );
  });
});

describe('standingAgainstWorld (G12)', () => {
  const atThreeMinutes = worldReference(180, balance);

  it('lets the level decide first', () => {
    expect(standingAgainstWorld(3, 50, atThreeMinutes, balance)).toBe(WORLD_STANDING.ahead);
    expect(standingAgainstWorld(1, 900, atThreeMinutes, balance)).toBe(WORLD_STANDING.behind);
  });

  it('at the world level reads the mass within a band of the tolerance either side', () => {
    expect(standingAgainstWorld(2, 221, atThreeMinutes, balance)).toBe(WORLD_STANDING.ahead);
    expect(standingAgainstWorld(2, 220, atThreeMinutes, balance)).toBe(WORLD_STANDING.with);
    expect(standingAgainstWorld(2, 200, atThreeMinutes, balance)).toBe(WORLD_STANDING.with);
    expect(standingAgainstWorld(2, 180, atThreeMinutes, balance)).toBe(WORLD_STANDING.with);
    expect(standingAgainstWorld(2, 179, atThreeMinutes, balance)).toBe(WORLD_STANDING.behind);
  });

  it('reads a fresh protocell as with a fresh world', () => {
    expect(standingAgainstWorld(1, balance.growth.CELL_STARTING_MASS, worldReference(0, balance), balance)).toBe(
      WORLD_STANDING.with,
    );
  });
});
