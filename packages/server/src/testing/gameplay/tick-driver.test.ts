import { describe, expect, it } from 'vitest';
import { ScenarioSetupError } from './errors.js';
import { driveTicks, type TickHooks } from './tick-driver.js';

function recordingHooks(): TickHooks & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    beforeStep: (stepTick) => events.push(`before ${stepTick}`),
    step: () => events.push('step'),
    afterStep: (tick) => events.push(`after ${tick}`),
  };
}

describe('driveTicks', () => {
  it('runs before, step, after for every tick in order', () => {
    const hooks = recordingHooks();
    driveTicks(3, hooks);
    expect(hooks.events).toEqual([
      'before 1',
      'step',
      'after 1',
      'before 2',
      'step',
      'after 2',
      'before 3',
      'step',
      'after 3',
    ]);
  });

  it('steps exactly the requested count when it is not a multiple of the burst cap', () => {
    const hooks = recordingHooks();
    driveTicks(23, hooks);
    expect(hooks.events.filter((event) => event === 'step')).toHaveLength(23);
    expect(hooks.events.at(-1)).toBe('after 23');
  });

  it('does nothing for zero ticks', () => {
    const hooks = recordingHooks();
    driveTicks(0, hooks);
    expect(hooks.events).toEqual([]);
  });

  it('rejects a negative or fractional tick count', () => {
    expect(() => driveTicks(-1, recordingHooks())).toThrow(ScenarioSetupError);
    expect(() => driveTicks(1.5, recordingHooks())).toThrow(ScenarioSetupError);
  });
});
