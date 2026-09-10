// The one mapping from a game-term `PlayerCommand` to the wire `GameInput` (docs/TESTING.md §8):
// the echo adapter, the Evolution adapter and both bot bindings share it, so a scripted player
// and a bot speak the same input. A command without a target aims at the origin: the wire has no
// "keep the latched target" input (`targetX` / `targetY` are required, docs/ARCHITECTURE.md §4),
// so a script that wants to hold still targets the cell's own centre.

import type { GameInput } from '@evolution/shared';
import type { PlayerCommand } from './adapter.js';

const ORIGIN = 0;

export function toWireInput(playerCommand: PlayerCommand, sequence: number): GameInput {
  return {
    sequence,
    targetX: playerCommand.targetX ?? ORIGIN,
    targetY: playerCommand.targetY ?? ORIGIN,
    shouldSprint: playerCommand.isSprinting ?? false,
    traitChoice: playerCommand.traitChoice ?? null,
  };
}
