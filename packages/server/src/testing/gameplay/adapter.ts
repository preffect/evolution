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

/** What the session hands `applyFixture` besides the record: the runner's ids, never the DSL's id scheme. */
export interface FixtureContext {
  /** The tick the fixture applies before: 0 for a setup fixture, T for `.atTick(T).place…`. */
  readonly tick: number;
  /** The id of a scenario player index (`PlacedCell.playerIndex`, `insideCellOf`, `eastOfCellOf`). */
  playerId(playerIndex: number): PlayerId;
}

/**
 * Duties of an adapter over a world (#98), stated here so the seam cannot be met without them:
 * - `applyFixture` resolves the record's `PlacementAnchor` (`placement.ts`): `resolveFixedAnchor`
 *   for a point or a named zone, the world for a cell centre or a gel patch.
 * - ECOLOGY §8: placing anything disables the initial fill and both spawners for the run, and the
 *   scenario fails (`ScenarioSetupError`) when a seeded gel patch lies within `GEL_PATCH_CLEARANCE_WU`
 *   of the broth point (`isClearOfGelPatches`); never tolerate it, pick another seed.
 * - A scheduled fixture (`context.tick` > 0) is applied between ticks, after that tick's joins and
 *   leaves and before its scripts, exactly as recorded in the replay's `patches`.
 */
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
  /**
   * The player's cell in `snapshot`, or `undefined` when the player is present but has none
   * (spectating, not yet spawned). An adapter over a module with no world throws
   * `ScenarioSetupError` instead, so a script that needs a cell fails loudly rather than idles.
   */
  locateCell(snapshot: Snapshot, playerId: PlayerId): CellLocation | undefined;
  /** Applies a placed cell, mote or fragment before step `context.tick`; throws `ScenarioSetupError` if unsupported. */
  applyFixture(module: GameModule, fixture: Fixture, context: FixtureContext): void;
}
