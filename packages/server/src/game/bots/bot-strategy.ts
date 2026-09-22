// The strategy seam (docs/testing/scenario-runner.md §8, docs/testing/bots-and-design-tables.md §8.3): what a bot decides over and what it answers with.
// A strategy sees the same context a scenario script sees, so a scripted player and a
// strategy-driven one travel the same path through the scenario schedule, the bot client and the
// in-process roster. A strategy may keep state across its decisions (a `hunter` that commits to
// a target), which is why every host holds a factory: each run builds a fresh instance, and a
// random choice comes from `context.random`, never from outside the seed. The strategies
// themselves live in `strategies/`; the scenario-only script helpers in `testing/gameplay/scripts.ts`.
// `ActorId` is who decides: a player's id for every bot and script (the default), a cell's entity id
// for a wild seat (`game/wild/wild-strategy.ts`, docs/ecology/wild-cells.md §3.3), which has no player.

import type { PlayerId, RandomSource } from '@evolution/shared';
import type { CellLocation } from './perception.js';

export interface TraitChoiceCommand {
  readonly offerId: number;
  readonly cardIndex: number;
}

/**
 * What a script or strategy asks a player to do this tick, in game terms rather than wire terms.
 * Every field is optional so scripts compose (`mergeCommands`); the binding turns the merged
 * command into the module's input shape.
 */
export interface PlayerCommand {
  readonly targetX?: number;
  readonly targetY?: number;
  readonly isSprinting?: boolean;
  readonly traitChoice?: TraitChoiceCommand | null;
}

export interface ScriptContext<Snapshot, ActorId = PlayerId> {
  /** The tick of `snapshot`: the state the script is looking at. */
  readonly tick: number;
  /** The tick the command will be applied in (`tick + 1`). */
  readonly stepTick: number;
  /** The player's index in the roster, or a wild seat's number. */
  readonly playerIndex: number;
  /** Who decides: what `perception.ownCellOf` locates the own cell by. */
  readonly actorId: ActorId;
  readonly snapshot: Snapshot;
  /** The player's cell (`BotWorldBinding.locateCell`), or `undefined` when the player has none. */
  readonly cell: CellLocation | undefined;
  readonly seed: number;
  /** This player's own stream, forked from the run's seed: the only place a bot may draw from. */
  readonly random: RandomSource;
}

/** Answers the command to submit before `stepTick`, or `null` to send nothing this tick. */
export type PlayerScript<Snapshot, ActorId = PlayerId> = (
  context: ScriptContext<Snapshot, ActorId>,
) => PlayerCommand | null;

/** No input at all ("idle" in the scenario tables and the `idle` strategy). */
export const idle: PlayerScript<unknown> = () => null;

export interface BotStrategy<Snapshot, ActorId = PlayerId> {
  readonly name: string;
  /** The command for this tick, or `null` to send nothing. */
  decide(context: ScriptContext<Snapshot, ActorId>): PlayerCommand | null;
}

/** Builds one strategy instance per run; what `.bot()`, the pilot and the catalogue hand around. */
export type BotStrategyFactory<Snapshot, ActorId = PlayerId> = () => BotStrategy<Snapshot, ActorId>;

/** Wraps a script as a named strategy factory, so a scripted bot and a real one share one type. */
export function createScriptedStrategy<Snapshot, ActorId = PlayerId>(
  name: string,
  script: PlayerScript<Snapshot, ActorId>,
): BotStrategyFactory<Snapshot, ActorId> {
  return () => ({ name, decide: script });
}

/** The script form of a strategy instance: what the scenario schedule runs. */
export function strategyScript<Snapshot, ActorId = PlayerId>(
  strategy: BotStrategy<Snapshot, ActorId>,
): PlayerScript<Snapshot, ActorId> {
  return (context) => strategy.decide(context);
}
