// Pure, reusable identity + math primitives shared by server and client.
// No framework dependencies. Game-agnostic.

export interface Vec2 {
  x: number;
  y: number;
}

// ===== Branded id types =====
// Branding keeps PlayerId / GameId / EntityId / Tick from being mixed up at
// the type level while remaining plain strings/numbers at runtime.

export type PlayerId = string & { readonly __brand: 'PlayerId' };
export type GameId = string & { readonly __brand: 'GameId' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type Tick = number & { readonly __brand: 'Tick' };

export const playerId = (value: string): PlayerId => value as PlayerId;
export const gameId = (value: string): GameId => value as GameId;
export const entityId = (value: string): EntityId => value as EntityId;
export const tick = (value: number): Tick => value as Tick;

/** The union of a table's values: the shape every `as const` id object derives its union from. */
export type ValueOf<Table> = Table[keyof Table];

// ===== Pure helpers =====

/** A record with every listed key at zero: how the per-tag and per-variant counters start. */
export function zeroRecord<Key extends string>(keys: readonly Key[]): Record<Key, number> {
  const record: Partial<Record<Key, number>> = {};
  for (const key of keys) {
    record[key] = 0;
  }
  return record as Record<Key, number>;
}

/** Clamp a number into the inclusive [min, max] range. */
export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/**
 * True when a room can accept another player: it has not started and is not
 * yet at capacity. Pure helper shared by the lobby (server) and room browser
 * (client) so "joinable" is defined in exactly one place.
 */
export const isRoomJoinable = (room: { isStarted: boolean; playerCount: number; maxPlayers: number }): boolean =>
  !room.isStarted && room.playerCount < room.maxPlayers;
