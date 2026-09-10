// A script list: each step runs its script for `decisions` consecutive decisions, then the next
// step takes over; after the last step the bot idles (or starts over with `isLooping`). The
// scripts are the pure ones of `scripts.ts`, so the sequence is as deterministic as they are.
// (`createScriptedStrategy` in `bots.ts` wraps ONE script for ever; this chains several.)

import type { PlayerCommand } from '../adapter.js';
import type { BotStrategy, BotStrategyFactory } from '../bots.js';
import { ScenarioSetupError } from '../errors.js';
import type { PlayerScript, ScriptContext } from '../scripts.js';

export interface ScriptSequenceStep<Snapshot> {
  readonly script: PlayerScript<Snapshot>;
  /** How many consecutive decisions this step owns; a positive whole number. */
  readonly decisions: number;
}

export interface ScriptSequenceOptions {
  readonly name?: string;
  readonly isLooping?: boolean;
}

export const SCRIPT_SEQUENCE_STRATEGY_NAME = 'script_sequence';

function validateSteps<Snapshot>(steps: readonly ScriptSequenceStep<Snapshot>[]): void {
  if (steps.length === 0) {
    throw new ScenarioSetupError('a script sequence needs at least one step');
  }
  for (const [index, step] of steps.entries()) {
    if (!Number.isInteger(step.decisions) || step.decisions < 1) {
      throw new ScenarioSetupError(`step ${index} of a script sequence must own a positive whole number of decisions`);
    }
  }
}

export function createScriptSequenceStrategy<Snapshot>(
  steps: readonly ScriptSequenceStep<Snapshot>[],
  options: ScriptSequenceOptions = {},
): BotStrategyFactory<Snapshot> {
  validateSteps(steps);
  const { name = SCRIPT_SEQUENCE_STRATEGY_NAME, isLooping = false } = options;
  const totalDecisions = steps.reduce((sum, step) => sum + step.decisions, 0);
  return (): BotStrategy<Snapshot> => {
    let decisionsMade = 0;
    const stepAt = (decision: number): ScriptSequenceStep<Snapshot> | undefined => {
      let offset = isLooping ? decision % totalDecisions : decision;
      for (const step of steps) {
        if (offset < step.decisions) {
          return step;
        }
        offset -= step.decisions;
      }
      return undefined;
    };
    return {
      name,
      decide(context: ScriptContext<Snapshot>): PlayerCommand | null {
        const step = stepAt(decisionsMade);
        decisionsMade += 1;
        return step === undefined ? null : step.script(context);
      },
    };
  };
}
