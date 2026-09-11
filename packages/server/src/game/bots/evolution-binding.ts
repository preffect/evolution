// The Evolution bot binding (docs/TESTING.md §8.4): how a bot reads a wire `GameSnapshot` and
// speaks to the Evolution module. Cells and motes are the snapshot's own views; `canEngulf` is the
// shared predicate (docs/ECOLOGY.md §6.1) closed over the balance the caller supplies, read at
// every call so a `debug_set_balance` reaches the bots too. The in-process roster feeds it full
// snapshots; over the wire a client feeds it what it received.

import {
  canEngulf,
  DEFAULT_BALANCE,
  type BalanceConfig,
  type CellView,
  type GameInput,
  type GameSnapshot,
  type PlayerId,
} from '@evolution/shared';
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

/** The wire client's binding (`testing/bot-client/cli.ts`): no room balance reaches a wire client, so it reads the defaults. */
export const evolutionBotBinding = createEvolutionBotBinding(() => DEFAULT_BALANCE);
