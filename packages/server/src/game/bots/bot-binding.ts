// How a bot reads a snapshot and speaks to a module (docs/TESTING.md §8.3): the perception the
// strategies look through, the self-locator derived from it, and the input mapping. A
// `ScenarioAdapter` extends this, so the adapter of a world IS its binding: one `perception`,
// one `locateCell`, one `toInput` for the scenario runner, the bot client and `debug_spawn_bot`.
// The echo binding is the template's: no cells, nothing to see, and the echo's own input
// mapping. It is typed over `unknown` because the echo has no snapshot shape worth naming: the
// same binding serves the in-process roster (fed `EchoSnapshot`) and the over-the-wire client
// (fed the wire `GameSnapshot`). The Evolution binding is `evolution-binding.ts`.

import type { GameInput, PlayerId } from '@evolution/shared';
import type { PlayerCommand } from './bot-strategy.js';
import { NO_WORLD_PERCEPTION, type BotPerception, type CellLocation } from './perception.js';

export interface BotWorldBinding<Input, Snapshot> {
  readonly name: string;
  readonly perception: BotPerception<Snapshot>;
  /**
   * The player's cell as a location, or `undefined` when the player has none (spectating, not
   * yet spawned). Derived from `perception.ownCellOf` through `locateCellThrough`, so a binding
   * never carries a second self-locator.
   */
  locateCell(snapshot: Snapshot, playerId: PlayerId): CellLocation | undefined;
  /** The input `submitInput` accepts for a command, stamped with the client tick as its sequence. */
  toInput(command: PlayerCommand, sequence: number): Input;
}

/** The `locateCell` a binding derives from its perception: the own cell, narrowed to a location. */
export function locateCellThrough<Snapshot>(
  perception: BotPerception<Snapshot>,
): (snapshot: Snapshot, playerId: PlayerId) => CellLocation | undefined {
  return (snapshot, playerId) => {
    const cell = perception.ownCellOf(snapshot, playerId);
    return cell === undefined ? undefined : { x: cell.x, y: cell.y, radius: cell.radius };
  };
}

/**
 * A command without a target aims at the origin: the wire has no "keep the latched target" input
 * (`targetX` / `targetY` are required, docs/ARCHITECTURE.md §4), so a script that wants to hold
 * still targets the cell's own centre.
 */
const ORIGIN = 0;

/** The one mapping from a game-term command to the wire `GameInput`: both bindings share it. */
export function toWireInput(playerCommand: PlayerCommand, sequence: number): GameInput {
  return {
    sequence,
    targetX: playerCommand.targetX ?? ORIGIN,
    targetY: playerCommand.targetY ?? ORIGIN,
    shouldSprint: playerCommand.isSprinting ?? false,
    traitChoice: playerCommand.traitChoice ?? null,
  };
}

export const echoBotBinding: BotWorldBinding<GameInput, unknown> = {
  name: 'echo',
  perception: NO_WORLD_PERCEPTION,
  locateCell: locateCellThrough(NO_WORLD_PERCEPTION),
  toInput: toWireInput,
};
