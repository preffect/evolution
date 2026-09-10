// The input schedule (docs/TESTING.md §8): which script feeds which player before which step.
// "At tick T" means the command is submitted between tick T − 1 and tick T, so step T applies
// it (docs/ECOLOGY.md §8: the fixture acts between ticks). Joins and leaves use the same stamp.

import type { PlayerCommand } from './adapter.js';
import { ScenarioSetupError } from './errors.js';
import { mergeCommands, type PlayerScript, type ScriptContext } from './scripts.js';

/** The first tick an input can apply in: step 1 produces tick 1 from the initial state. */
export const FIRST_STEP_TICK = 1;
export const EVERY_TICK = 1;

export interface ScheduledScript<Snapshot> {
  readonly playerIndex: number;
  readonly fromTick: number;
  /** Inclusive; `null` runs to the end of the scenario. */
  readonly toTick: number | null;
  readonly everyTicks: number;
  readonly script: PlayerScript<Snapshot>;
}

/** Rejects a window that could never fire (tick 0, a reversed range, a non-positive stride). */
export function validateScheduleWindow(
  entry: Pick<ScheduledScript<unknown>, 'fromTick' | 'toTick' | 'everyTicks'>,
): void {
  if (!Number.isInteger(entry.fromTick) || entry.fromTick < FIRST_STEP_TICK) {
    throw new ScenarioSetupError(
      `inputs apply from tick ${FIRST_STEP_TICK} (before the first step), got tick ${entry.fromTick}`,
    );
  }
  if (entry.toTick !== null && (!Number.isInteger(entry.toTick) || entry.toTick < entry.fromTick)) {
    throw new ScenarioSetupError(`input window ends at tick ${entry.toTick}, before it starts at ${entry.fromTick}`);
  }
  if (!Number.isInteger(entry.everyTicks) || entry.everyTicks < EVERY_TICK) {
    throw new ScenarioSetupError(`an input stride must be a positive whole number of ticks, got ${entry.everyTicks}`);
  }
}

export function isScriptDueAt<Snapshot>(entry: ScheduledScript<Snapshot>, stepTick: number): boolean {
  if (stepTick < entry.fromTick) {
    return false;
  }
  if (entry.toTick !== null && stepTick > entry.toTick) {
    return false;
  }
  return (stepTick - entry.fromTick) % entry.everyTicks === 0;
}

/**
 * Every command due before `stepTick`, merged per player in schedule order (later entries win a
 * field; the sprint flag is OR-merged). Players are visited in index order so replays stay in join order.
 */
export function collectCommandsForTick<Snapshot>(
  entries: readonly ScheduledScript<Snapshot>[],
  stepTick: number,
  contextFor: (playerIndex: number) => ScriptContext<Snapshot>,
): Map<number, PlayerCommand> {
  const commands = new Map<number, PlayerCommand>();
  for (const entry of entries) {
    if (!isScriptDueAt(entry, stepTick)) {
      continue;
    }
    const produced = entry.script(contextFor(entry.playerIndex));
    if (produced === null) {
      continue;
    }
    const previous = commands.get(entry.playerIndex);
    commands.set(entry.playerIndex, previous === undefined ? produced : mergeCommands(previous, produced));
  }
  return new Map([...commands.entries()].sort(([leftIndex], [rightIndex]) => leftIndex - rightIndex));
}
