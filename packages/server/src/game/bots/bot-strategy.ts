// The strategy seam (docs/TESTING.md §8, §8.3): what a bot decides over and what it answers with.
// A strategy sees the same context a scenario script sees, so a scripted player and a
// strategy-driven one travel the same path through the scenario schedule, the bot client and the
// in-process roster. A strategy may keep state across its decisions (a `hunter` that commits to
// a target), which is why every host holds a factory: each run builds a fresh instance, and a
// random choice comes from `context.random`, never from outside the seed. The strategies
// themselves live in `strategies/`; the scenario-only script helpers in `testing/gameplay/scripts.ts`.

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

export interface ScriptContext<Snapshot> {
  /** The tick of `snapshot`: the state the script is looking at. */
  readonly tick: number;
  /** The tick the command will be applied in (`tick + 1`). */
  readonly stepTick: number;
  readonly playerIndex: number;
  readonly playerId: PlayerId;
  readonly snapshot: Snapshot;
  /** The player's cell (`BotWorldBinding.locateCell`), or `undefined` when the player has none. */
  readonly cell: CellLocation | undefined;
  readonly seed: number;
  /** This player's own stream, forked from the run's seed: the only place a bot may draw from. */
  readonly random: RandomSource;
}

/** Answers the command to submit before `stepTick`, or `null` to send nothing this tick. */
export type PlayerScript<Snapshot> = (context: ScriptContext<Snapshot>) => PlayerCommand | null;

/** No input at all ("idle" in the scenario tables and the `idle` strategy). */
export const idle: PlayerScript<unknown> = () => null;

export interface BotStrategy<Snapshot> {
  readonly name: string;
  /** The command for this tick, or `null` to send nothing. */
  decide(context: ScriptContext<Snapshot>): PlayerCommand | null;
}

/** Builds one strategy instance per run; what `.bot()`, the pilot and the catalogue hand around. */
export type BotStrategyFactory<Snapshot> = () => BotStrategy<Snapshot>;

/** Wraps a script as a named strategy factory, so a scripted bot and a real one share one type. */
export function createScriptedStrategy<Snapshot>(
  name: string,
  script: PlayerScript<Snapshot>,
): BotStrategyFactory<Snapshot> {
  return () => ({ name, decide: script });
}

/** The script form of a strategy instance: what the scenario schedule runs. */
export function strategyScript<Snapshot>(strategy: BotStrategy<Snapshot>): PlayerScript<Snapshot> {
  return (context) => strategy.decide(context);
}
