// The scenario adapter for the Evolution module (docs/TESTING.md §8): the Evolution bot binding
// (`game/bots/evolution-binding.ts`) plus the scenario duties. The snapshot the scripts and the
// expectations see is the full snapshot of the tick plus that tick's effects and the spawners'
// counters (E2, E14 count spawns, not populations), with exact positions, read through the module's
// broadcast so the effects drain as on the wire; the hash is `computeStateHash` over the
// world; fixtures are the placed records of `fixtures.ts` and the world fixtures below.

import { DEFAULT_BALANCE, type BalanceConfig, type GameInput, type GameSnapshot } from '@evolution/shared';
import { createEvolutionBotBinding } from '../../game/bots/evolution-binding.js';
import { createEvolutionModule, type EvolutionModule } from '../../game/evolution-module.js';
import type { GameModule } from '../../game/game-module.js';
import { EXACT_POSITION, serializeFullSnapshot } from '../../game/serialize/serialize.js';
import { computeStateHash } from '../../game/world/state-hash.js';
import type { WorldState } from '../../game/world/world-state.js';
import type { FixtureContext, ScenarioAdapter } from './adapter.js';
import { applyPlacedFixture, prepareWorldForPlacement } from './evolution-fixtures.js';
import { PLACED_KIND, type PlacedFixture } from './fixtures.js';
import { createFileReplaySink } from './replay-sink.js';
import { createScenarioDsl } from './scenario.js';

/** The seed every design table row names (docs/ECOLOGY.md §8). */
export const TABLE_SEED = 42;
/**
 * The seed the placed rows run on: only the gel patches come from it, and seed 42 puts one 73 wu
 * from the broth point (docs/ECOLOGY.md §8: pick another seed, never tolerate it); 48 keeps every
 * patch over 2300 wu away, clear of the placed rows' eastward travel too.
 */
export const PLACED_ROW_SEED = 48;

/** Entities each spawner has produced since the world was created. */
export interface SpawnedCounts {
  readonly food: number;
  readonly dnaFragments: number;
}

/** The wire snapshot plus what the tables count that never rides the wire. */
export interface EvolutionScenarioSnapshot extends GameSnapshot {
  readonly spawnedCounts: SpawnedCounts;
}

export const WORLD_FIXTURE_KIND = {
  /** E14, W3, W9: both spawner accumulators back to 0 so no preamble residue carries into a window. */
  resetSpawnerAccumulators: 'reset_spawner_accumulators',
  /** E14, W3, W9: every mote and fragment removed, so neither spawner is capped. */
  clearFood: 'clear_food',
} as const;

export interface WorldFixture {
  readonly kind: (typeof WORLD_FIXTURE_KIND)[keyof typeof WORLD_FIXTURE_KIND];
}

export type EvolutionFixture = PlacedFixture | WorldFixture;

export const resetSpawnerAccumulators: WorldFixture = { kind: WORLD_FIXTURE_KIND.resetSpawnerAccumulators };
export const clearFood: WorldFixture = { kind: WORLD_FIXTURE_KIND.clearFood };

const PLACED_KINDS: readonly string[] = Object.values(PLACED_KIND);

function isPlacedFixture(fixture: EvolutionFixture): fixture is PlacedFixture {
  return PLACED_KINDS.includes(fixture.kind);
}

function applyWorldFixture(world: WorldState, fixture: WorldFixture): void {
  if (fixture.kind === WORLD_FIXTURE_KIND.resetSpawnerAccumulators) {
    world.spawners.food.accumulator = 0;
    world.spawners.dnaFragments.accumulator = 0;
    return;
  }
  world.food = [];
  world.dnaFragments = [];
}

/** The module under the runner: the Evolution module whose broadcast snapshot is the scenario one. */
export interface EvolutionScenarioModule extends GameModule<GameInput, EvolutionScenarioSnapshot> {
  readonly world: WorldState;
  /** Pins the last snapshot's projections before the world changes between ticks (fixtures do this before they write). */
  materialiseSnapshot(): void;
}

/** The module is always the one `createModule` built. */
function scenarioModuleOf(module: GameModule<GameInput, EvolutionScenarioSnapshot>): EvolutionScenarioModule {
  return module as EvolutionScenarioModule;
}

/** The snapshot parts a row rarely reads and that cost a projection of the whole dish: built on first access. */
const LAZY_SNAPSHOT_KEYS = [
  'gelPatches',
  'cells',
  'dnaFragments',
  'food',
  'players',
  'leaderboard',
  'appliedInputSequenceByPlayer',
] as const satisfies readonly (keyof GameSnapshot)[];

/** A scenario snapshot and the hook that pins its entity projections before the world moves on. */
export interface LazyScenarioSnapshot {
  readonly snapshot: EvolutionScenarioSnapshot;
  /** Builds the projections now, from the world as it stands; a no-op once built. */
  materialise(): void;
}

/**
 * Positions are exact here (the tables assert ± 0.01 wu); only the wire rounds them. The scalars,
 * the counters and this tick's effects (drained here, as the broadcast drains them) are captured
 * at once; the entity projections are built on first access, because the runner reads a snapshot
 * every tick and a whole-round row (37 200 ticks, twice) observes a handful of them. The rule:
 * the projections are pinned before anything changes the world between ticks (a scheduled
 * fixture, a join or a leave call `materialise`), so a script at the next tick reads this tick.
 */
export function createLazyScenarioSnapshot(world: WorldState): LazyScenarioSnapshot {
  let projected: GameSnapshot | undefined;
  const projection = (): GameSnapshot => {
    projected ??= serializeFullSnapshot(world, EXACT_POSITION);
    return projected;
  };
  const snapshot = {
    tick: world.tick,
    seed: world.seed,
    roundStartTick: world.roundStartTick,
    roundPhase: world.roundPhase,
    roundTimeLeftMs: world.roundTimeLeftMs,
    effects: world.effects.splice(0),
    spawnedCounts: { food: world.spawners.food.spawnedCount, dnaFragments: world.spawners.dnaFragments.spawnedCount },
  } as EvolutionScenarioSnapshot;
  for (const key of LAZY_SNAPSHOT_KEYS) {
    Object.defineProperty(snapshot, key, { enumerable: true, get: () => projection()[key] });
  }
  return {
    snapshot,
    materialise: () => {
      projection();
    },
  };
}

/** Applies a fixture before step `context.tick`; the first placed record switches the seeded spawns off. */
export function applyEvolutionFixture(world: WorldState, fixture: EvolutionFixture, context: FixtureContext): void {
  if (isPlacedFixture(fixture)) {
    if (world.spawners.food.isEnabled) {
      prepareWorldForPlacement(world);
    }
    applyPlacedFixture(world, fixture, context);
    return;
  }
  applyWorldFixture(world, fixture);
}

/**
 * The binding is built once and reads the balance of the module this adapter created last: a
 * scenario runs one module at a time (`runDeterministic` builds them in sequence), so the bots'
 * `canEngulf` closes over the live copy a fixture or a debug patch may have changed.
 */
const liveBalance: { balance: BalanceConfig } = { balance: DEFAULT_BALANCE };
const binding = createEvolutionBotBinding(() => liveBalance.balance);

/**
 * The Evolution module with the scenario snapshot as its broadcast; the runner reads only through
 * the adapter. Every between-tick write (a join, a leave, a fixture) pins the last snapshot first.
 */
function createScenarioModule(module: EvolutionModule): EvolutionScenarioModule {
  liveBalance.balance = module.world.balance;
  let latest: LazyScenarioSnapshot | undefined;
  const serialize = (): EvolutionScenarioSnapshot => {
    latest = createLazyScenarioSnapshot(module.world);
    return latest.snapshot;
  };
  const materialiseSnapshot = (): void => {
    latest?.materialise();
  };
  return {
    ...module,
    serializeRoomState: serialize,
    serializeFullState: () => ({ snapshot: serialize(), balance: module.world.balance }),
    addPlayer: (playerId, avatarIndex, playerName) => {
      materialiseSnapshot();
      module.addPlayer(playerId, avatarIndex, playerName);
    },
    removePlayer: (playerId) => {
      materialiseSnapshot();
      module.removePlayer(playerId);
    },
    materialiseSnapshot,
  };
}

export const evolutionAdapter: ScenarioAdapter<GameInput, EvolutionScenarioSnapshot, EvolutionFixture> = {
  ...binding,
  createModule: (options) => createScenarioModule(createEvolutionModule(options)),
  readSnapshot: (module) => module.serializeRoomState(),
  hashState: (module) => computeStateHash(scenarioModuleOf(module).world),
  applyFixture: (module, fixture, context) => {
    const scenarioModule = scenarioModuleOf(module);
    scenarioModule.materialiseSnapshot();
    applyEvolutionFixture(scenarioModule.world, fixture, context);
  },
};

/** The DSL bound to the Evolution module; a failing run writes its replay to `qa/replays/`. */
export const evolutionScenario = createScenarioDsl(evolutionAdapter, { replaySink: createFileReplaySink() });
