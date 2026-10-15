// The one world a room owns (docs/architecture/entity-model.md §2) and the context every system receives
// (§3). Plain data throughout (docs/determinism/contract-and-clock.md §1): arrays in insertion order, the random
// streams as serialisable state, no class instances.

import type {
  BalanceConfig,
  CopepodLaneView,
  GameEffect,
  GameEra,
  GameSessionConfig,
  GelPatchView,
  LeaderboardRow,
  PoolLayoutView,
  RandomSource,
  RandomState,
  RoundPhase,
  ServerRandomStreamLabel,
  SurgeView,
} from '@evolution/shared';
import type {
  CellRecord,
  DnaFragmentRecord,
  FoodMoteRecord,
  GiantSeatRecord,
  PlayerRecord,
  PoolCreatureSeatRecord,
  PoolSwarmRecord,
  SpawnerState,
  WildSeatRecord,
} from './entities.js';
import type { MassFlowLedger } from './mass-flow-ledger.js';

export interface WorldState {
  tick: number;
  /** The current round's seed; a rematch increments it. */
  seed: number;
  /**
   * 0 at creation, the current tick at a rematch (docs/ecology/food-and-spawn.md §3.1): `tick − roundStartTick`
   * is the integer the timer boundaries and the world clock read; carried on the snapshot.
   */
  roundStartTick: number;
  roundPhase: RoundPhase;
  /** Derived from the tick counter every tick and carried for the snapshot. */
  roundTimeLeftMs: number;
  config: GameSessionConfig;
  /** Defaults from the shared constants; patched only by `debug_set_balance`. */
  balance: BalanceConfig;
  /**
   * The last era whose move has run (docs/architecture/server-simulation.md §3): `dish` when the world is built (creation,
   * rematch), kept by a reseed. The step runs every move after it up to `roundEraAt` (ticket #868); the snapshot's `era`
   * copies it. Hashed in the eras' section (`era-hashed-section.ts`), which a world opens only once it has era state.
   */
  eraMovedInto: GameEra;
  gelPatches: GelPatchView[];
  /**
   * The rock pool's layout (docs/game-design/phases.md §14.4.6): drawn from the `pool` stream at the round's start when
   * the pool is in play (ticket #870), null in every other round. The snapshot carries it from the pool's warning tick.
   */
  poolLayout: PoolLayoutView | null;
  /** The surge from its warning to its end (phases.md §14.5.2, ticket #903), else null. */
  surge: SurgeView | null;
  /** The copepod's pass from its warning to its end (phases.md §14.6.4, ticket #873), else null. */
  copepodLane: CopepodLaneView | null;
  /**
   * The pool creatures' seats in seat order (phases.md §14.6.2): placed by the pool's move (ticket #872), null in every
   * world that has none, so a world without creatures hashes as before them (the eras' section's gate).
   */
  poolCreatureSeats: PoolCreatureSeatRecord[] | null;
  /**
   * The green speck swarms in swarm order (phases.md §14.5.2): placed by the pool's move (ticket #870), null in every
   * world the move has not run in, so a dish world hashes as before them.
   */
  poolSwarms: PoolSwarmRecord[] | null;
  /**
   * The first tick the pool's move grace no longer covers (phases.md §14.4.2 step 8): set by the move itself to its
   * tick plus `ERA_MOVE_GRACE_SECONDS`, never derived from the clock (wire-contract.md §4 "The cameras across the
   * move"); null in every world the move has not run in. Before it nothing targets a player and no engulf of a player
   * cell starts (`simulation/move-grace.ts`).
   */
  moveGraceEndsAtTick: number | null;
  /** Insertion order. */
  cells: CellRecord[];
  food: FoodMoteRecord[];
  dnaFragments: DnaFragmentRecord[];
  /** Join order. */
  players: PlayerRecord[];
  /**
   * Seat order (docs/ecology/wild-cells.md §3.3): `WILD_CELL_COUNT` seats from world creation, never fewer in the dish;
   * the pool's move empties them with the dish's wild cells (phases.md §14.4.2 step 4).
   */
  wildSeats: WildSeatRecord[];
  /**
   * Seat order (docs/ecology/giants.md §3.5.9): one seat per species of `GIANT_SPECIES_IN_DISH`, seated at world
   * creation, plus any a fixture or `debug_spawn` seats. Apart from `wildSeats`, so the die-off's sum and
   * `WILD_CELL_COUNT` stay the wild seats'.
   */
  giantSeats: GiantSeatRecord[];
  /**
   * The first giant seat's number: `WILD_CELL_COUNT` as the world was created, so a mid-round `debug_set_balance` of
   * the count never renumbers a giant seat or gives one a live wild seat's number (docs/ecology/giants.md §3.5.9).
   */
  firstGiantSeatNumber: number;
  leaderboard: LeaderboardRow[];
  spawners: { food: SpawnerState; dnaFragments: SpawnerState };
  /** The server streams' state, walked in `SERVER_RANDOM_STREAM_LABELS` order (docs/determinism/random-streams.md §3, docs/determinism/ordering-and-state-hash.md §5). */
  random: Record<ServerRandomStreamLabel, RandomState>;
  nextEntityNumber: number;
  /** The counter this round's world was built from (a rematch continues it): what a replay rebuilds with (docs/determinism/replay-tests-and-traps.md §6). */
  roundFirstEntityNumber: number;
  /** Effects since the last broadcast, drained by `serializeDelta` every `SNAPSHOT_EVERY_TICKS` ticks. */
  effects: GameEffect[];
  /** Why each player cell's mass moved (#383): transient like `effects`, never hashed or replayed. */
  massFlow: MassFlowLedger;
}

/** Player inputs the simulation ignored, by reason (docs/architecture/server-simulation.md §3.2); reported by the debug handle. */
export interface InputRejectionCounters {
  staleSequence: number;
  sprintOnCooldown: number;
  staleTraitChoice: number;
}

export interface StepContext {
  readonly balance: BalanceConfig;
  /** Live sources resumed from `world.random` for this step and written back after it (step.ts). */
  readonly streams: Record<ServerRandomStreamLabel, RandomSource>;
  /**
   * **The same array as `WorldState.effects`**, passed here so a system that already holds the
   * context need not reach for the world (`step.ts` builds the context from it). Pushing to either
   * is pushing to the one list the module drains, so the two spellings across the engulf step
   * (`context.effects` for `cell_absorbed`, `world.effects` for `cell_released`) are one queue,
   * in push order. Never replace it with a fresh array: the world would keep the old one.
   */
  readonly effects: GameEffect[];
  readonly rejections: InputRejectionCounters;
}

export function createInputRejectionCounters(): InputRejectionCounters {
  return { staleSequence: 0, sprintOnCooldown: 0, staleTraitChoice: 0 };
}
