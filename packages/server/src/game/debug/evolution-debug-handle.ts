// The Evolution debug handle (docs/ARCHITECTURE.md §8): every capability of the template's seam,
// declared `Required` so a forgotten member is a type error. Reads project the world; mutations
// go through debug-operations.ts and are recorded in the replay; a reseed closes the recording;
// the bot pair adds and removes a player the module's own roster drives (docs/TESTING.md §8.3).

import {
  ENTITY_KIND,
  type BalanceConfig,
  type EntityKind,
  type GameInput,
  type GameSnapshot,
  type PlayerId,
  type StateHash,
} from '@evolution/shared';
import { DebugRequestError } from './debug-request-error.js';
import type {
  BalancePatch,
  BotSpawnRequest,
  BoundingBox,
  DnaGrant,
  EntityFilter,
  PlayerPatch,
  SimulationDebugHandle,
  SpawnedBot,
  SpawnRequest,
} from './simulation-debug-handle.js';
import type { InProcessBotRoster } from '../bots/in-process-bots.js';
import type { CellRecord, EngulfReleaseRecord, SpitOutRefractoryRecord } from '../world/entities.js';
import { REPLAY_ORIGIN } from '../replay/replay-format.js';
import type { ReplayRecorder } from '../replay/replay-recorder.js';
import { toCellView, toDnaFragmentView, toFoodMoteView, toPlayerProgressView } from '../serialize/serialize.js';
import { findCellOfPlayer, findPlayer } from '../world/lookups.js';
import { computeStateHash } from '../world/state-hash.js';
import type { InputRejectionCounters, WorldState } from '../world/world-state.js';
import { DEBUG_PATCH_KIND, applyDebugPatch, reseedForDebug, type DebugPatch } from './debug-operations.js';

/** The module's own `addPlayer` / `removePlayer`: a bot joins and leaves exactly like a late joiner; both answer whether the world took it. */
export interface ModuleMembership {
  addPlayer(playerId: PlayerId, avatarIndex: number, playerName: string): boolean;
  removePlayer(playerId: PlayerId): boolean;
}

export interface EvolutionDebugHandleDependencies {
  readonly world: WorldState;
  readonly recorder: ReplayRecorder;
  readonly rejections: InputRejectionCounters;
  readonly bots: InProcessBotRoster<GameInput, GameSnapshot>;
  readonly membership: ModuleMembership;
}

/** A view tagged with its entity kind (a mote's own `kind` is its food kind), what `debug_get_entities` lists. */
export interface DebugEntity {
  readonly entityKind: EntityKind;
  readonly x: number;
  readonly y: number;
}

const ENTITY_KINDS: readonly EntityKind[] = Object.values(ENTITY_KIND);

/** What `debug_get_player_progress` reports of a cell's engulf record (docs/ARCHITECTURE.md §8). */
export interface EngulfDebugState {
  readonly carriedOffsetX: number | null;
  readonly carriedOffsetY: number | null;
  readonly spitOutRefractories: readonly SpitOutRefractoryRecord[];
  readonly lastRelease: EngulfReleaseRecord | null;
}

/**
 * The engulf record the wire does not carry (docs/ECOLOGY.md §6.1): the carried offset of a sealed
 * prey, the predator's spit-out memories (so a QA agent driving an engulf with `debug_set_player`
 * can see why a restart is refused) and the last release with its reason. That reason exists nowhere
 * else a debug tool can reach: `cell_released` rides the delta broadcast alone, and the full-state
 * snapshot carries `effects: []` by construction, so `escaped`, `ratio`, `spat_out` and `aborted`
 * would otherwise be indistinguishable. The phase is derived from `cell.engulfProgress` by the
 * shared `engulfPhaseOf`, so it is not repeated here.
 */
function engulfDebugStateOf(cell: CellRecord): EngulfDebugState {
  return {
    carriedOffsetX: cell.carriedOffsetX,
    carriedOffsetY: cell.carriedOffsetY,
    spitOutRefractories: cell.spitOutRefractories.map((refractory) => ({ ...refractory })),
    lastRelease: cell.lastRelease === null ? null : { ...cell.lastRelease },
  };
}

function isInside(entity: DebugEntity, bbox: BoundingBox | undefined): boolean {
  if (bbox === undefined) {
    return true;
  }
  return entity.x >= bbox.minX && entity.x <= bbox.maxX && entity.y >= bbox.minY && entity.y <= bbox.maxY;
}

function requireEntityKind(kind: string | undefined): EntityKind | undefined {
  if (kind === undefined) {
    return undefined;
  }
  if (!ENTITY_KINDS.includes(kind as EntityKind)) {
    throw new DebugRequestError(`"${kind}" is not an entity kind (${ENTITY_KINDS.join(', ')})`);
  }
  return kind as EntityKind;
}

export class EvolutionDebugHandle implements Required<SimulationDebugHandle> {
  constructor(private readonly dependencies: EvolutionDebugHandleDependencies) {}

  listEntities(filter: EntityFilter): readonly DebugEntity[] {
    const kind = requireEntityKind(filter.kind);
    const { world } = this.dependencies;
    const entities: DebugEntity[] = [
      ...world.cells.map((cell) => ({ entityKind: ENTITY_KIND.cell, ...toCellView(cell) })),
      ...world.food.map((mote) => ({ entityKind: ENTITY_KIND.foodMote, ...toFoodMoteView(mote) })),
      ...world.dnaFragments.map((fragment) => ({
        entityKind: ENTITY_KIND.dnaFragment,
        ...toDnaFragmentView(fragment),
      })),
    ];
    return entities.filter(
      (entity) => (kind === undefined || entity.entityKind === kind) && isInside(entity, filter.bbox),
    );
  }

  getPlayerDebugState(playerId: PlayerId): unknown {
    const { world, rejections } = this.dependencies;
    const player = findPlayer(world, playerId);
    if (player === undefined) {
      return undefined;
    }
    const cell = findCellOfPlayer(world, playerId);
    return {
      progress: toPlayerProgressView(player),
      cell: cell === undefined ? null : toCellView(cell),
      engulf: cell === undefined ? null : engulfDebugStateOf(cell),
      modifiers: cell === undefined ? null : { ...cell.modifiers },
      stage: cell?.stage ?? null,
      ownedTraits: player.ownedTraits.map((trait) => ({ ...trait })),
      offerQueue: structuredClone(player.offerQueue),
      rejections: { ...rejections },
    };
  }

  grantDna(playerId: PlayerId, grant: DnaGrant): unknown {
    return this.applyAndRecord({ kind: DEBUG_PATCH_KIND.grantDna, playerId, grant });
  }

  spawn(request: SpawnRequest): unknown {
    return this.applyAndRecord({ kind: DEBUG_PATCH_KIND.spawn, request });
  }

  setPlayer(playerId: PlayerId, patch: PlayerPatch): unknown {
    return this.applyAndRecord({ kind: DEBUG_PATCH_KIND.setPlayer, playerId, patch });
  }

  /** The closed recording ends at the hash before the streams are rebuilt (docs/DETERMINISM.md §6). */
  reseed(seed: number): void {
    const { world, recorder } = this.dependencies;
    const closingHash = computeStateHash(world);
    reseedForDebug(world, seed);
    recorder.startNewRound(world, REPLAY_ORIGIN.reseed, closingHash);
  }

  getBalance(): BalanceConfig {
    return this.dependencies.world.balance;
  }

  patchBalance(patch: BalancePatch): BalanceConfig {
    this.applyAndRecord({ kind: DEBUG_PATCH_KIND.setBalance, patch });
    return this.dependencies.world.balance;
  }

  computeStateHash(): StateHash {
    return computeStateHash(this.dependencies.world);
  }

  exportReplay(): unknown {
    return this.dependencies.recorder.export(this.dependencies.world);
  }

  /**
   * The roster builds the pilot and the identity, the room claims the seat, then the module adds
   * the player (recorded as a join); a refused seat leaves nothing behind (docs/ARCHITECTURE.md §8).
   */
  spawnBot(request: BotSpawnRequest, seat: (bot: SpawnedBot) => void): SpawnedBot {
    const { bots, membership } = this.dependencies;
    const bot = bots.spawn(request);
    try {
      seat(bot);
    } catch (error) {
      bots.remove(bot.playerId);
      throw error;
    }
    if (!membership.addPlayer(bot.playerId, bot.avatarIndex, bot.playerName)) {
      bots.remove(bot.playerId);
      throw new DebugRequestError(`"${bot.playerId}" is already a player in this world`);
    }
    return bot;
  }

  /** Refuses a player the roster did not spawn before anything is removed. */
  removeBot(playerId: PlayerId): SpawnedBot {
    const { bots, membership } = this.dependencies;
    const bot = bots.remove(playerId);
    membership.removePlayer(playerId);
    return bot;
  }

  /** Applied first so a refused patch is never recorded. */
  private applyAndRecord(patch: DebugPatch): unknown {
    const { world, recorder } = this.dependencies;
    const result = applyDebugPatch(world, patch);
    recorder.recordDebugPatch(world, patch);
    return result;
  }
}

export function createEvolutionDebugHandle(dependencies: EvolutionDebugHandleDependencies): EvolutionDebugHandle {
  return new EvolutionDebugHandle(dependencies);
}
