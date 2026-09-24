// The Evolution bot bindings (docs/testing/bots-and-design-tables.md §8.3): how a bot reads the world and speaks to the
// Evolution module. Over the wire a client reads the `GameSnapshot` it received (the snapshot's own views). In
// process, the roster the module drives reads the live `WorldState` itself (ticket #181): a `CellRecord`, a
// `FoodMoteRecord` and a `DnaFragmentRecord` already carry every field a strategy reads, so no snapshot is built
// each tick for the bots. Both see the same things in the same order (the full snapshot is built from the same
// arrays), except that the world's positions are exact where the wire's are quantised. `canEngulf` is the shared
// predicate (docs/ecology/absorption.md §6.1) closed over the balance the caller supplies, read at every call so a
// `debug_set_balance` reaches the bots too.

import {
  canEngulf,
  DEFAULT_BALANCE,
  type BalanceConfig,
  type CellView,
  type GameInput,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
import type { CellRecord } from '../world/entities.js';
import type { WorldState } from '../world/world-state.js';
import { locateCellThrough, toWireInput, type BotWorldBinding } from './bot-binding.js';
import type { BotMoteView, BotPerception, PlayerBotCellView } from './perception.js';

export const EVOLUTION_BINDING_NAME = 'evolution';

/** The player's own cell in a wire snapshot, or `undefined` while it has none (spectating). */
export function ownCellInSnapshot(snapshot: GameSnapshot, playerId: PlayerId): PlayerBotCellView | undefined {
  return snapshot.cells.find((cell): cell is CellView & PlayerBotCellView => cell.playerId === playerId);
}

/**
 * The fragments while any exist, else the motes: the greedy graze of docs/PROGRESSION.md §7 (the
 * nearest fragment, else the nearest food mote) through the grazer's one "nearest mote" rule.
 */
export function motesOfSnapshot(snapshot: GameSnapshot): readonly BotMoteView[] {
  return snapshot.dnaFragments.length > 0 ? snapshot.dnaFragments : snapshot.food.spawned;
}

export function createEvolutionBotPerception(getBalance: () => BalanceConfig): BotPerception<GameSnapshot> {
  return {
    ownCellOf: ownCellInSnapshot,
    cellsOf: (snapshot) => snapshot.cells,
    motesOf: motesOfSnapshot,
    canEngulf: (predator, prey) => canEngulf(predator, prey, getBalance().absorption),
  };
}

export function createEvolutionBotBinding(getBalance: () => BalanceConfig): BotWorldBinding<GameInput, GameSnapshot> {
  const perception = createEvolutionBotPerception(getBalance);
  return {
    name: EVOLUTION_BINDING_NAME,
    perception,
    locateCell: locateCellThrough(perception),
    toInput: toWireInput,
  };
}

/** The player's own cell in the live world, or `undefined` while it has none (spectating). */
export function ownCellInWorld(world: WorldState, playerId: PlayerId): PlayerBotCellView | undefined {
  return world.cells.find((cell): cell is CellRecord & PlayerBotCellView => cell.playerId === playerId);
}

/** The same greedy graze as `motesOfSnapshot`, over the world's own records. */
export function motesOfWorld(world: WorldState): readonly BotMoteView[] {
  return world.dnaFragments.length > 0 ? world.dnaFragments : world.food;
}

/** What the in-process roster sees: the live world, read where it stands, no snapshot built. */
export function createEvolutionWorldBotPerception(getBalance: () => BalanceConfig): BotPerception<WorldState> {
  return {
    ownCellOf: ownCellInWorld,
    cellsOf: (world) => world.cells,
    motesOf: motesOfWorld,
    canEngulf: (predator, prey) => canEngulf(predator, prey, getBalance().absorption),
  };
}

/** The binding of the bots the module drives itself (`debug_spawn_bot`). */
export function createEvolutionWorldBotBinding(
  getBalance: () => BalanceConfig,
): BotWorldBinding<GameInput, WorldState> {
  const perception = createEvolutionWorldBotPerception(getBalance);
  return {
    name: EVOLUTION_BINDING_NAME,
    perception,
    locateCell: locateCellThrough(perception),
    toInput: toWireInput,
  };
}

/** The wire client's binding (`testing/bot-client/cli.ts`): no room balance reaches a wire client, so it reads the defaults. */
export const evolutionBotBinding = createEvolutionBotBinding(() => DEFAULT_BALANCE);
