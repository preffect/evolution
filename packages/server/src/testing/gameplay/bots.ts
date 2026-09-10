// Bots are input sources (docs/TESTING.md §8). A strategy decides from the same context a script
// sees, so a scripted player and a strategy-driven one travel the same path through the
// schedule. A strategy may keep state across its decisions (a `hunt` that commits to a target),
// which is why the schedule holds a factory: every run of `runDeterministic` builds a fresh
// instance, and a random choice comes from `context.random`, never from outside the seed. The
// strategies themselves (`graze`, `hunt`, `flee`, `idle`) arrive with #15; this file is the interface.

import type { PlayerCommand } from './adapter.js';
import type { PlayerScript, ScriptContext } from './scripts.js';

export interface BotStrategy<Snapshot> {
  readonly name: string;
  /** The command for this tick, or `null` to send nothing. */
  decide(context: ScriptContext<Snapshot>): PlayerCommand | null;
}

/** Builds one strategy instance per run; what `.bot()` takes. */
export type BotStrategyFactory<Snapshot> = () => BotStrategy<Snapshot>;

/** Wraps a script as a named strategy factory, so a scripted bot and a real one share one type. */
export function createScriptedStrategy<Snapshot>(
  name: string,
  script: PlayerScript<Snapshot>,
): BotStrategyFactory<Snapshot> {
  return () => ({ name, decide: script });
}

/** The script form of a strategy instance: what the schedule runs. */
export function strategyScript<Snapshot>(strategy: BotStrategy<Snapshot>): PlayerScript<Snapshot> {
  return (context) => strategy.decide(context);
}
