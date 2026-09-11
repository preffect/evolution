// The one world a room owns (docs/ARCHITECTURE.md §2) and the context every system receives
// (§3). Plain data throughout (docs/DETERMINISM.md §1): arrays in insertion order, the random
// streams as serialisable state, no class instances.

import type {
  BalanceConfig,
  GameEffect,
  GameSessionConfig,
  GelPatchView,
  LeaderboardRow,
  RandomSource,
  RandomState,
  RoundPhase,
  ServerRandomStreamLabel,
} from '@evolution/shared';
import type {
  CellRecord,
  DnaFragmentRecord,
  FoodMoteRecord,
  PlayerRecord,
  SpawnerState,
  WildSeatRecord,
} from './entities.js';

export interface WorldState {
  tick: number;
  /** The current round's seed; a rematch increments it. */
  seed: number;
  /**
   * 0 at creation, the current tick at a rematch (docs/ECOLOGY.md §3.1): `tick − roundStartTick`
   * is the integer the timer boundaries and the world clock read; carried on the snapshot.
   */
  roundStartTick: number;
  roundPhase: RoundPhase;
  /** Derived from the tick counter every tick and carried for the snapshot. */
  roundTimeLeftMs: number;
  config: GameSessionConfig;
  /** Defaults from the shared constants; patched only by `debug_set_balance`. */
  balance: BalanceConfig;
  gelPatches: GelPatchView[];
  /** Insertion order. */
  cells: CellRecord[];
  food: FoodMoteRecord[];
  dnaFragments: DnaFragmentRecord[];
  /** Join order. */
  players: PlayerRecord[];
  /** Seat order (docs/ECOLOGY.md §3.3); empty until the wild-cell slice. */
  wildSeats: WildSeatRecord[];
  leaderboard: LeaderboardRow[];
  spawners: { food: SpawnerState; dnaFragments: SpawnerState };
  /** The server streams' state, walked in `SERVER_RANDOM_STREAM_LABELS` order (docs/DETERMINISM.md §3, §5). */
  random: Record<ServerRandomStreamLabel, RandomState>;
  nextEntityNumber: number;
  /** The counter this round's world was built from (a rematch continues it): what a replay rebuilds with (docs/DETERMINISM.md §6). */
  roundFirstEntityNumber: number;
  /** This tick's effects, drained by the module after the step. */
  effects: GameEffect[];
}

/** Player inputs the simulation ignored, by reason (docs/ARCHITECTURE.md §3.2); reported by the debug handle. */
export interface InputRejectionCounters {
  staleSequence: number;
  sprintOnCooldown: number;
  staleTraitChoice: number;
}

export interface StepContext {
  readonly balance: BalanceConfig;
  /** Live sources resumed from `world.random` for this step and written back after it (step.ts). */
  readonly streams: Record<ServerRandomStreamLabel, RandomSource>;
  readonly effects: GameEffect[];
  readonly rejections: InputRejectionCounters;
}

export function createInputRejectionCounters(): InputRejectionCounters {
  return { staleSequence: 0, sprintOnCooldown: 0, staleTraitChoice: 0 };
}
