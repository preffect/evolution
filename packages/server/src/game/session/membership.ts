// Joins and leaves between ticks (docs/GAME-DESIGN.md §5.2, docs/PROGRESSION.md §5): one code
// path for the room's `addPlayer` / `removePlayer` and for the replay runner. A late joiner is
// appended in join order, placed by safe placement through the entry rule at the tick it is
// present for (the coming step), and lifted by the living players' medians past the grace; a
// removed player's cell dissolves into detritus.

import { RANDOM_STREAM, type PlayerId } from '@evolution/shared';
import { worldReferenceAt } from '../simulation/round-clock.js';
import { findCellOfPlayer, findPlayer, removeFromArray } from '../world/lookups.js';
import { resumeStreams, storeStreams, withStream } from '../world/streams.js';
import type { InputRejectionCounters, StepContext, WorldState } from '../world/world-state.js';
import { dissolveCell } from './death.js';
import { applyEntryState, entryState, lateJoinMedians } from './entry.js';
import { createPlayerRecord, spawnCellForPlayer, type PlayerIdentity } from './players.js';

/** Adds a player who was not in the world; returns false (and does nothing) when already present. */
export function addPlayerToWorld(
  world: WorldState,
  identity: PlayerIdentity,
  rejections: InputRejectionCounters,
): boolean {
  if (findPlayer(world, identity.playerId) !== undefined) {
    return false;
  }
  const entryTick = world.tick + 1;
  const player = createPlayerRecord(identity, world.players.length);
  const entry = entryState(
    player,
    lateJoinMedians(world, entryTick),
    worldReferenceAt(world, entryTick),
    world.balance,
  );
  world.players.push(player);
  const streams = resumeStreams(world);
  const context: StepContext = { balance: world.balance, streams, effects: world.effects, rejections };
  spawnCellForPlayer(world, player, entry.mass, streams[RANDOM_STREAM.spawnPlacement]);
  applyEntryState(world, player, entry, context);
  storeStreams(world, streams);
  return true;
}

/** Removes the player and dissolves its cell; returns false when the player is not in the world. */
export function removePlayerFromWorld(world: WorldState, playerId: PlayerId): boolean {
  const player = findPlayer(world, playerId);
  if (player === undefined) {
    return false;
  }
  const cell = findCellOfPlayer(world, playerId);
  if (cell !== undefined) {
    withStream(world, RANDOM_STREAM.spawner, (spawner) => dissolveCell(world, cell, spawner));
  }
  removeFromArray(world.players, player);
  return true;
}
