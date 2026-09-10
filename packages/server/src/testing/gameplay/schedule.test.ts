import { describe, expect, it } from 'vitest';
import { playerId } from '@evolution/shared';
import { ScenarioSetupError } from './errors.js';
import { collectCommandsForTick, isScriptDueAt, validateScheduleWindow, type ScheduledScript } from './schedule.js';
import type { ScriptContext } from './scripts.js';

function entry(overrides: Partial<ScheduledScript<null>>): ScheduledScript<null> {
  return { playerIndex: 0, fromTick: 1, toTick: null, everyTicks: 1, script: () => null, ...overrides };
}

function contextFor(playerIndex: number): ScriptContext<null> {
  return {
    tick: 0,
    stepTick: 1,
    playerIndex,
    playerId: playerId(`player_${playerIndex}`),
    snapshot: null,
    cell: undefined,
  };
}

describe('validateScheduleWindow', () => {
  it('rejects tick 0, a reversed window and a non-positive stride', () => {
    expect(() => validateScheduleWindow({ fromTick: 0, toTick: null, everyTicks: 1 })).toThrow(ScenarioSetupError);
    expect(() => validateScheduleWindow({ fromTick: 5, toTick: 4, everyTicks: 1 })).toThrow(/ends at tick 4/);
    expect(() => validateScheduleWindow({ fromTick: 1, toTick: null, everyTicks: 0 })).toThrow(/stride/);
    expect(() => validateScheduleWindow({ fromTick: 1.5, toTick: null, everyTicks: 1 })).toThrow(ScenarioSetupError);
  });

  it('accepts a single tick, an open window and a stride', () => {
    expect(() => validateScheduleWindow({ fromTick: 3, toTick: 3, everyTicks: 1 })).not.toThrow();
    expect(() => validateScheduleWindow({ fromTick: 1, toTick: null, everyTicks: 30 })).not.toThrow();
  });
});

describe('isScriptDueAt', () => {
  it('fires once for a single-tick window', () => {
    const single = entry({ fromTick: 3, toTick: 3 });
    expect([2, 3, 4].map((tick) => isScriptDueAt(single, tick))).toEqual([false, true, false]);
  });

  it('fires from the start tick on a stride, until the end tick inclusive', () => {
    const strided = entry({ fromTick: 10, toTick: 70, everyTicks: 30 });
    expect([9, 10, 40, 70, 100].map((tick) => isScriptDueAt(strided, tick))).toEqual([false, true, true, true, false]);
  });
});

describe('collectCommandsForTick', () => {
  it('merges the commands one player produced, later entries winning a field', () => {
    const entries = [
      entry({ script: () => ({ targetX: 1, targetY: 1, isSprinting: true }) }),
      entry({ script: () => ({ targetX: 2 }) }),
    ];
    expect([...collectCommandsForTick(entries, 1, contextFor)]).toEqual([
      [0, { targetX: 2, targetY: 1, isSprinting: true }],
    ]);
  });

  it('skips silent scripts and entries that are not due', () => {
    const entries = [entry({ script: () => null }), entry({ fromTick: 9, script: () => ({ targetX: 1 }) })];
    expect(collectCommandsForTick(entries, 1, contextFor).size).toBe(0);
  });

  it('returns players in index order whatever the schedule order', () => {
    const entries = [
      entry({ playerIndex: 2, script: () => ({ targetX: 2 }) }),
      entry({ playerIndex: 0, script: () => ({ targetX: 0 }) }),
    ];
    expect([...collectCommandsForTick(entries, 1, contextFor).keys()]).toEqual([0, 2]);
  });

  it('hands each script the context of its own player', () => {
    const seen: number[] = [];
    const entries = [
      entry({
        playerIndex: 1,
        script: (context) => {
          seen.push(context.playerIndex);
          return null;
        },
      }),
    ];
    collectCommandsForTick(entries, 1, contextFor);
    expect(seen).toEqual([1]);
  });
});
