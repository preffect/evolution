// The Evolution bot binding (docs/TESTING.md §8.4): how a bot reads a wire `GameSnapshot` and
// speaks to the Evolution module. Cells and motes are the snapshot's own views; `canEngulf` is the
// shared predicate (docs/ECOLOGY.md §6.1) closed over the balance the caller supplies, read at
// every call so a `debug_set_balance` reaches the bots too. The in-process roster feeds it full
// snapshots; over the wire a client feeds it what it received.

import { canEngulf, DEFAULT_BALANCE, type BalanceConfig, type GameInput, type GameSnapshot } from '@evolution/shared';
import { locateCellInSnapshot } from '../gameplay/evolution-views.js';
import { toWireInput } from '../gameplay/wire-input.js';
import type { BotMoteView, BotPerception } from '../gameplay/strategies/perception.js';
import type { BotWorldBinding } from './bot-binding.js';

export const EVOLUTION_BINDING_NAME = 'evolution';

/** The fragments while any exist, else the motes: the greedy graze of docs/PROGRESSION.md §7 (the nearest fragment, else the nearest mote). */
export function motesOfSnapshot(snapshot: GameSnapshot): readonly BotMoteView[] {
  return snapshot.dnaFragments.length > 0 ? snapshot.dnaFragments : snapshot.food.spawned;
}

export function createEvolutionBotPerception(getBalance: () => BalanceConfig): BotPerception<GameSnapshot> {
  return {
    cellsOf: (snapshot) => snapshot.cells,
    motesOf: motesOfSnapshot,
    canEngulf: (predator, prey) => canEngulf(predator, prey, getBalance().absorption),
  };
}

export function createEvolutionBotBinding(getBalance: () => BalanceConfig): BotWorldBinding<GameInput, GameSnapshot> {
  return {
    name: EVOLUTION_BINDING_NAME,
    locateCell: locateCellInSnapshot,
    toInput: toWireInput,
    perception: createEvolutionBotPerception(getBalance),
  };
}

/** The wire client's binding (`cli.ts`): no room balance reaches a wire client, so it reads the defaults. */
export const evolutionBotBinding = createEvolutionBotBinding(() => DEFAULT_BALANCE);
