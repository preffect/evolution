// The seam between the scenario runner and a `GameModule` (docs/TESTING.md §8). The runner
// knows ticks, players, scripts and hashes; everything game-specific (how to build the module,
// read a snapshot, hash the state, turn a command into the wire input, find a player's cell,
// place a fixture) lives in an adapter. `echo-adapter.ts` serves the template's echo module;
// the Evolution module gets its own adapter with #98.

import type { PlayerId, StateHash } from '@evolution/shared';
import type { GameModule, RoomInitOptions } from '../../game/game-module.js';

/** Where a player's cell is in a snapshot; what "target N radii east" is measured from. */
export interface CellLocation {
  readonly x: number;
  readonly y: number;
  readonly radiusWu: number;
}

export interface TraitChoiceCommand {
  readonly offerId: number;
  readonly cardIndex: number;
}

/**
 * What a script asks a player to do this tick, in game terms rather than wire terms. Every field
 * is optional so scripts compose (`mergeCommands`); the adapter turns the merged command into
 * the module's input shape.
 */
export interface PlayerCommand {
  readonly targetX?: number;
  readonly targetY?: number;
  readonly isSprinting?: boolean;
  readonly traitChoice?: TraitChoiceCommand | null;
}

/** `RoomInitOptions` plus the round seed, until #97 folds the seed into `GameSessionConfig`. */
export interface ScenarioModuleOptions extends RoomInitOptions {
  readonly seed: number;
}

export interface ScenarioAdapter<Input, Snapshot, Fixture> {
  readonly name: string;
  /** Builds the module the way the lobby would (the factory receives no `RandomSource`). */
  createModule(options: ScenarioModuleOptions): GameModule;
  /**
   * The state the scripts and the expectations see. Called exactly once per tick, after the
   * step, and must not disturb the module (a delta serialiser belongs in the room, not here).
   */
  readSnapshot(module: GameModule): Snapshot;
  /** The hash replays and determinism checks compare (`computeStateHash` once the world exists). */
  hashState(module: GameModule): StateHash;
  /** Turns a merged command into the input `submitInput` accepts, stamped with `sequence`. */
  toInput(command: PlayerCommand, sequence: number): Input;
  /** The player's cell in `snapshot`, or `undefined` when the player has none (spectating, echo). */
  locateCell(snapshot: Snapshot, playerId: PlayerId): CellLocation | undefined;
  /** Applies a placed cell, mote or fragment before tick 1; throws `ScenarioSetupError` if unsupported. */
  applyFixture(module: GameModule, fixture: Fixture): void;
}
