// The bots the Evolution module drives itself (`debug_spawn_bot`, docs/ARCHITECTURE.md §8): an
// in-process roster bound to the room's live balance, stepped before each tick on the full
// snapshot of the tick before, its inputs stamped with the coming tick as their sequence
// (docs/TESTING.md §8.1: inputs start at tick 1). The roster owns the pilots; the module owns the
// players and records their inputs like anyone else's, so a replay needs no bot.

import type { GameInput, GameSnapshot, PlayerId } from '@evolution/shared';
import { createEvolutionBotBinding } from './evolution-binding.js';
import { createInProcessBotRoster, type InProcessBotRoster } from './in-process-bots.js';
import { serializeFullSnapshot } from '../serialize/serialize.js';
import type { WorldState } from '../world/world-state.js';

export type EvolutionBotRoster = InProcessBotRoster<GameInput, GameSnapshot>;
export type InputSubmitter = (playerId: PlayerId, input: GameInput) => void;

export function createEvolutionBotRoster(world: WorldState): EvolutionBotRoster {
  return createInProcessBotRoster(createEvolutionBotBinding(() => world.balance));
}

/** Every bot decides on the world as it stands and submits for the coming tick; a room without bots serialises nothing. */
export function driveBots(roster: EvolutionBotRoster, world: WorldState, submit: InputSubmitter): void {
  if (roster.list().length === 0) {
    return;
  }
  roster.driveTick(serializeFullSnapshot(world), world.tick + 1, submit);
}
