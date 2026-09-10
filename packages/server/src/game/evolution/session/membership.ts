// Joins and leaves between ticks (docs/GAME-DESIGN.md §5.2, docs/PROGRESSION.md §5): one code
// path for the room's `addPlayer` / `removePlayer` and for the replay runner. A late joiner is
// appended in join order, given the catch-up when the grace has passed, and placed by safe
// placement; a removed player's cell dissolves into detritus.

import { RANDOM_STREAM, type PlayerId } from '@evolution/shared';
import { applyCatchUp, computeLateJoinCatchUp } from '../progression/late-join.js';
import { findCellOfPlayer, findPlayer, removeFromArray } from '../world/lookups.js';
import { resumeStreams, storeStreams, withStream } from '../world/streams.js';
import type { InputRejectionCounters, StepContext, WorldState } from '../world/world-state.js';
import { dissolveCell } from './death.js';
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
  const catchUp = computeLateJoinCatchUp(world);
  const player = createPlayerRecord(identity, world.players.length);
  world.players.push(player);
  const streams = resumeStreams(world);
  const context: StepContext = { balance: world.balance, streams, effects: world.effects, rejections };
  if (catchUp !== null) {
    applyCatchUp(world, player, catchUp, context);
  }
  const mass = catchUp?.mass ?? world.balance.growth.CELL_STARTING_MASS;
  spawnCellForPlayer(world, player, mass, streams[RANDOM_STREAM.spawnPlacement]);
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
