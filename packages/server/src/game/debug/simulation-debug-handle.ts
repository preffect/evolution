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

/** A nested record whose leaves are numbers: `debug_set_balance` patches number leaves only (docs/CODE-STANDARDS.md §2). */
export interface BalancePatch {
  readonly [key: string]: number | BalancePatch;
}

/**
 * What a game module exposes to the debug tools. Reads return plain JSON; a read of something
 * that does not exist returns `undefined`; a mutation that cannot apply throws `DebugRequestError`.
 */
export interface SimulationDebugHandle {
  /** No `serializeFullState` here: `debug_get_game_state` reads `GameRoom.getFullState()`, the module's own `game_state` payload. */
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
