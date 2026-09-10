import { describe, expect, it } from 'vitest';
import { ScenarioSetupError } from './errors.js';
import { driveTicks, type TickHooks } from './tick-driver.js';

/** The tick at which a clock advanced by relative 83.33 ms bursts first over-steps (float residue). */
const OVERSTEP_TICK = 23_152;
/** GAME-DESIGN G2: a full round plus the results screen, the longest table row. */
const G2_TICKS = 37_200;

function recordingHooks(): TickHooks & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    beforeStep: (stepTick) => events.push(`before ${stepTick}`),
    step: () => events.push('step'),
    afterStep: (tick) => events.push(`after ${tick}`),
  };
}

/** Counts instead of recording, for the long runs; checks every hook sees the tick it should. */
function countingHooks(): TickHooks & { steps: number; lastTick: number } {
  const counter = {
    steps: 0,
    lastTick: 0,
    beforeStep: (stepTick: number) => {
      if (stepTick !== counter.lastTick + 1) {
        throw new Error(`beforeStep ${stepTick} after tick ${counter.lastTick}`);
      }
    },
    step: () => {
      counter.steps += 1;
    },
    afterStep: (tick: number) => {
      counter.lastTick = tick;
    },
  };
  return counter;
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

  it('steps exactly 23 152 ticks, where relative clock advances would over-step by one', () => {
    const hooks = countingHooks();
    driveTicks(OVERSTEP_TICK, hooks);
    expect(hooks.steps).toBe(OVERSTEP_TICK);
    expect(hooks.lastTick).toBe(OVERSTEP_TICK);
  });

  it('drives the 37 200-tick G2 row with no dropped tick', () => {
    const hooks = countingHooks();
    expect(() => driveTicks(G2_TICKS, hooks)).not.toThrow();
    expect(hooks.steps).toBe(G2_TICKS);
    expect(hooks.lastTick).toBe(G2_TICKS);
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
