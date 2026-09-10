// The seam between the scenario runner and a `GameModule` (docs/TESTING.md §8). The runner
// knows ticks, players, scripts and hashes; everything game-specific (how to build the module,
// read a snapshot, hash the state, turn a command into the wire input, find a player's cell,
// place a fixture) lives in an adapter. An adapter extends the bot `BotWorldBinding`
// (`game/bots/bot-binding.ts`), so the adapter of a world is also what the bot client and
// `debug_spawn_bot` see through: one perception, one `locateCell`, one `toInput`.
// `echo-adapter.ts` serves the template's echo module; the Evolution module gets its own with #98.

import type { PlayerId, StateHash } from '@evolution/shared';
import type { BotWorldBinding } from '../../game/bots/bot-binding.js';
import type { CellLocation } from '../../game/bots/perception.js';
import type { GameModule, RoomInitOptions } from '../../game/game-module.js';

export type { PlayerCommand, TraitChoiceCommand } from '../../game/bots/bot-strategy.js';
export type { CellLocation } from '../../game/bots/perception.js';

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
export interface ScenarioAdapter<Input, Snapshot, Fixture> extends BotWorldBinding<Input, Snapshot> {
  /** Builds the module the way the lobby would: the round seed is `options.config.seed`, no `RandomSource` is passed. */
  createModule(options: RoomInitOptions): GameModule<Input, Snapshot>;
  /**
   * The state the scripts and the expectations see. Called exactly once per tick, after the
   * step, and must not disturb the module (a delta serialiser belongs in the room, not here).
   */
  readSnapshot(module: GameModule<Input, Snapshot>): Snapshot;
  /** The hash replays and determinism checks compare (`computeStateHash` once the world exists). */
  hashState(module: GameModule<Input, Snapshot>): StateHash;
  /**
   * As the binding declares it, with one scenario-side difference: an adapter over a module with
   * no world throws `ScenarioSetupError` instead of answering `undefined`, so a script that needs
   * a cell fails loudly rather than idles (the echo *binding* the bot hosts use still holds).
   */
  locateCell(snapshot: Snapshot, playerId: PlayerId): CellLocation | undefined;
  /** Applies a placed cell, mote or fragment before step `context.tick`; throws `ScenarioSetupError` if unsupported. */
  applyFixture(module: GameModule<Input, Snapshot>, fixture: Fixture, context: FixtureContext): void;
}
