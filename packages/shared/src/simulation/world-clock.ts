// The world clock (docs/ECOLOGY.md §3.1): round time turned into the world's average cell, and a
// player's standing against it. Computed on both sides from the snapshot's `tick` and
// `roundStartTick`; nothing about the clock rides on the wire.

import type { BalanceConfig } from '../constants/balance.js';
import { WORLD_STANDING, type CellStage, type WorldStanding } from '../types/game.js';
import { secondsToTicks, ticksToSeconds } from '../time/units.js';
import { cumulativeDnaForLevel, type LevelCostBalance } from './level-costs.js';
import { stageOf, type LadderBalance } from './stage-of.js';

/** The first world level; a fresh round starts here. */
const FIRST_WORLD_LEVEL = 1;

/** What the clock reads: its own domain plus the mass bounds, the level bounds and costs, the ladder and build 0. */
export interface WorldClockBalance {
  worldClock: Pick<
    BalanceConfig['worldClock'],
    'WORLD_LEVEL_SECONDS' | 'WORLD_MASS_GAIN_PER_SECOND' | 'WORLD_STANDING_MASS_TOLERANCE'
  >;
  growth: Pick<BalanceConfig['growth'], 'CELL_STARTING_MASS' | 'CELL_MAX_MASS'>;
  progression: Pick<BalanceConfig['progression'], 'MAX_LEVEL'> & LevelCostBalance;
  ladder: LadderBalance;
  wildCells: Pick<BalanceConfig['wildCells'], 'WILD_CELL_BUILDS'>;
}

/** The world's average cell at one moment of the round. */
export interface WorldReference {
  /** Continuous: 2.5 is halfway from level 2 to 3. */
  worldLevel: number;
  /** The stage of build 0's first `floor(worldLevel) − 1` picks. */
  worldStage: CellStage;
  worldMass: number;
  /** Cumulative DNA of level `floor(worldLevel)`: what a predator's `ENGULF_DNA_SHARE` reads of a wild cell. */
  worldDna: number;
}

/**
 * Round seconds elapsed at the tick being stepped, frozen at the round length through `results`
 * (10 800 / 60 = 180 exactly; never derived from `roundTimeLeftMs`).
 */
export function worldElapsedSeconds(tick: number, roundStartTick: number, roundDurationSeconds: number): number {
  return ticksToSeconds(Math.min(tick - roundStartTick, secondsToTicks(roundDurationSeconds)));
}

export function worldReference(elapsedSeconds: number, balance: WorldClockBalance): WorldReference {
  const { worldClock, growth } = balance;
  const worldLevel = Math.min(
    FIRST_WORLD_LEVEL + elapsedSeconds / worldClock.WORLD_LEVEL_SECONDS,
    balance.progression.MAX_LEVEL,
  );
  const wholeLevel = Math.floor(worldLevel);
  const worldPicks = balance.wildCells.WILD_CELL_BUILDS[0]!.slice(0, wholeLevel - FIRST_WORLD_LEVEL);
  return {
    worldLevel,
    worldStage: stageOf(worldPicks, balance.ladder),
    worldMass: Math.min(
      growth.CELL_STARTING_MASS + worldClock.WORLD_MASS_GAIN_PER_SECOND * elapsedSeconds,
      growth.CELL_MAX_MASS,
    ),
    worldDna: cumulativeDnaForLevel(wholeLevel, balance.progression),
  };
}

/**
 * The level decides first; at the world's level the mass decides, with a band of
 * `WORLD_STANDING_MASS_TOLERANCE × worldMass` either side of `worldMass` that reads as `with`.
 */
export function standingAgainstWorld(
  level: number,
  mass: number,
  reference: WorldReference,
  balance: Pick<WorldClockBalance, 'worldClock'>,
): WorldStanding {
  const worldWholeLevel = Math.floor(reference.worldLevel);
  if (level > worldWholeLevel) return WORLD_STANDING.ahead;
  if (level < worldWholeLevel) return WORLD_STANDING.behind;
  const band = balance.worldClock.WORLD_STANDING_MASS_TOLERANCE * reference.worldMass;
  if (mass > reference.worldMass + band) return WORLD_STANDING.ahead;
  if (mass < reference.worldMass - band) return WORLD_STANDING.behind;
  return WORLD_STANDING.with;
}
