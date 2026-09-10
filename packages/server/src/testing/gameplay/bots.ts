// Bots are input sources (docs/TESTING.md §8). A strategy decides from the same context a script
// sees, so a scripted player and a strategy-driven one travel the same path through the
// schedule. The strategies themselves (`graze`, `hunt`, `flee`, `idle`) arrive with #15 and the
// headless bot client reuses them for live sessions; this file is the interface only.

import type { PlayerCommand } from './adapter.js';
import type { PlayerScript, ScriptContext } from './scripts.js';

export interface BotStrategy<Snapshot> {
  readonly name: string;
  /** The command for this tick, or `null` to send nothing. */
  decide(context: ScriptContext<Snapshot>): PlayerCommand | null;
}

/** Wraps a script as a named strategy, so a scripted bot and a real one share one type. */
export function createScriptedStrategy<Snapshot>(name: string, script: PlayerScript<Snapshot>): BotStrategy<Snapshot> {
  return { name, decide: script };
}

/** The script form of a strategy: what the schedule stores. */
export function strategyScript<Snapshot>(strategy: BotStrategy<Snapshot>): PlayerScript<Snapshot> {
  return (context) => strategy.decide(context);
}
