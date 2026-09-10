// The debug seam between the game module and the MCP tools (docs/ARCHITECTURE.md §8). Every
// member is a capability the module MAY implement; a tool whose capability is missing answers
// "not supported by this game module" instead of pretending. The echo module implements none;
// the Evolution module (#98) implements all of them.

import type { PlayerId, StateHash } from '@evolution/shared';

/** Axis-aligned world-unit box; both bounds inclusive. */
export interface BoundingBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

export interface EntityFilter {
  /** An entity kind id as the module names it; omitted means every kind. */
  readonly kind?: string;
  readonly bbox?: BoundingBox;
}

export interface SpawnRequest {
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  /** Kind-specific extras (variant, tags, mass...); the module validates them. */
  readonly params: Readonly<Record<string, unknown>>;
}

export interface PlayerPatch {
  readonly mass?: number;
  readonly level?: number;
  readonly traits?: readonly string[];
  readonly position?: { readonly x: number; readonly y: number };
}

export interface DnaGrant {
  readonly dna: number;
  readonly tags?: readonly string[];
}

/** What `debug_spawn_bot` asks for: a strategy by catalogue name, driven from a stream forked from `seed`. */
export interface BotSpawnRequest {
  readonly behavior: string;
  readonly seed: number;
  /** `hunter` only: hunt this player alone. */
  readonly preyPlayerId?: PlayerId;
}

/** The synthetic player a spawned bot occupies; what the room enrols and the tool answers with. */
export interface SpawnedBot {
  readonly playerId: PlayerId;
  readonly playerName: string;
  readonly avatarIndex: number;
  readonly behavior: string;
}

/** A nested record whose leaves are numbers: `debug_set_balance` patches number leaves only (docs/CODE-STANDARDS.md §2). */
export interface BalancePatch {
  readonly [key: string]: number | BalancePatch;
}

/**
 * What a game module exposes to the debug tools. Reads return plain JSON; a read of something
 * that does not exist returns `undefined`; a mutation that cannot apply throws `DebugRequestError`.
 */
export interface SimulationDebugHandle {
  /** The full state a joining client would receive (`debug_get_game_state`). */
  serializeFullState?(): unknown;
  listEntities?(filter: EntityFilter): readonly unknown[];
  getPlayerDebugState?(playerId: PlayerId): unknown;
  grantDna?(playerId: PlayerId, grant: DnaGrant): unknown;
  spawn?(request: SpawnRequest): unknown;
  setPlayer?(playerId: PlayerId, patch: PlayerPatch): unknown;
  /** Rebuilds every random stream from `seed` (docs/DETERMINISM.md §3). */
  reseed?(seed: number): void;
  getBalance?(): unknown;
  /** Applies a number-leaf patch and returns the live balance. */
  patchBalance?(patch: BalancePatch): unknown;
  computeStateHash?(): StateHash;
  exportReplay?(): unknown;
  /** Adds a synthetic player driven in-process by a named strategy (docs/TESTING.md §8.4); throws on an unknown name. */
  spawnBot?(request: BotSpawnRequest): SpawnedBot;
  /** Removes a bot this handle spawned; throws for any other player id. */
  removeBot?(playerId: PlayerId): SpawnedBot;
}

export type DebugCapability = keyof SimulationDebugHandle;

/** A handle known to implement `Name`. */
export type HandleWith<Name extends DebugCapability> = SimulationDebugHandle &
  Required<Pick<SimulationDebugHandle, Name>>;

export function hasDebugCapability<Name extends DebugCapability>(
  handle: SimulationDebugHandle,
  name: Name,
): handle is HandleWith<Name> {
  return typeof handle[name] === 'function';
}
