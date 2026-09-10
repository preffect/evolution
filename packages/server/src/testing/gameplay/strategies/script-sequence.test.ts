import { describe, expect, it } from 'vitest';
import { createTestScriptContext } from '../../builders.js';
import { ScenarioSetupError } from '../errors.js';
import { sprint, targetPoint } from '../scripts.js';
import { SCRIPT_SEQUENCE_STRATEGY_NAME, createScriptSequenceStrategy } from './script-sequence.js';

const STEPS = [
  { script: targetPoint(1, 0), decisions: 2 },
  { script: sprint(), decisions: 1 },
];

function decisions(count: number, isLooping = false) {
  const strategy = createScriptSequenceStrategy(STEPS, { isLooping })();
  return Array.from({ length: count }, () => strategy.decide(createTestScriptContext()));
}

describe('script sequence strategy', () => {
  it('runs each step for its decisions in order, then idles', () => {
    expect(decisions(5)).toEqual([{ targetX: 1, targetY: 0 }, { targetX: 1, targetY: 0 }, { isSprinting: true }, null, null]);
  });

  it('starts over after the last step when looping', () => {
    expect(decisions(5, true)).toEqual([
      { targetX: 1, targetY: 0 },
      { targetX: 1, targetY: 0 },
      { isSprinting: true },
      { targetX: 1, targetY: 0 },
      { targetX: 1, targetY: 0 },
    ]);
  });

  it('carries the default name or the one given', () => {
    expect(createScriptSequenceStrategy(STEPS)().name).toBe(SCRIPT_SEQUENCE_STRATEGY_NAME);
    expect(createScriptSequenceStrategy(STEPS, { name: 'dash' })().name).toBe('dash');
  });

  it('starts every instance at the first step', () => {
    const factory = createScriptSequenceStrategy(STEPS);
    const first = factory();
    first.decide(createTestScriptContext());
    first.decide(createTestScriptContext());
    expect(factory().decide(createTestScriptContext())).toEqual({ targetX: 1, targetY: 0 });
  });

  it('rejects an empty list and a step with no decisions', () => {
    expect(() => createScriptSequenceStrategy([])).toThrow(ScenarioSetupError);
    expect(() => createScriptSequenceStrategy([{ script: sprint(), decisions: 0 }])).toThrow(ScenarioSetupError);
    expect(() => createScriptSequenceStrategy([{ script: sprint(), decisions: 1.5 }])).toThrow(ScenarioSetupError);
  });
});
