import { describe, expect, it } from 'vitest';
import {
  formatDivergence,
  formatExpectationFailure,
  ScenarioAssertionError,
  ScenarioDivergenceError,
  ScenarioSetupError,
} from './errors.js';
import { MISSING_VALUE } from '../structural-diff.js';

const IDENTITY = { scenarioName: 'E9: A absorbs B', seed: 42 };
const FAILURE = { tick: 30, label: 'A mass', expected: '115.92 ± 0.01', actual: '110 (off by 5.92)' };

describe('scenario errors', () => {
  it('names the scenario, the seed, the tick and both values in an assertion failure', () => {
    const error = new ScenarioAssertionError(IDENTITY, [FAILURE], null);
    expect(error.name).toBe('ScenarioAssertionError');
    expect(error.message).toBe(
      'Scenario "E9: A absorbs B" failed (seed 42):\n  at tick 30: A mass\n    expected 115.92 ± 0.01, got 110 (off by 5.92)',
    );
    expect(error.failures).toEqual([FAILURE]);
  });

  it('lists every failure and the replay path when one was written', () => {
    const error = new ScenarioAssertionError(IDENTITY, [FAILURE, { ...FAILURE, tick: 31 }], '/tmp/e9.replay.json');
    expect(error.message).toContain('at tick 31');
    expect(error.message.endsWith('  replay written to /tmp/e9.replay.json')).toBe(true);
    expect(error.replayPath).toBe('/tmp/e9.replay.json');
  });

  it('reports the first differing checkpoint and how far the runs agreed', () => {
    const divergence = { tick: 600, expectedHash: 'aaaa', actualHash: 'bbbb', lastAgreedTick: 0 };
    const error = new ScenarioDivergenceError(IDENTITY, divergence);
    expect(error.name).toBe('ScenarioDivergenceError');
    expect(error.message).toBe(
      'Scenario "E9: A absorbs B" diverged (seed 42): first differing checkpoint at tick 600: expected aaaa, got bbbb (identical through tick 0)',
    );
    expect(formatDivergence({ ...divergence, lastAgreedTick: null })).toContain('(no checkpoint agreed)');
  });

  it('adds the first differing path and both values when the snapshots are attached', () => {
    const divergence = { tick: 2, expectedHash: 'aaaa', actualHash: 'bbbb', lastAgreedTick: 1 };
    const difference = { path: '$.cells.player_1.targetX', expected: 72, actual: MISSING_VALUE };
    const snapshots = {
      expectedSnapshot: { a: 1 },
      actualSnapshot: { a: 2 },
      wasReproduced: true,
      firstDifference: difference,
    };
    const error = new ScenarioDivergenceError(IDENTITY, divergence, snapshots);
    expect(error.snapshots).toBe(snapshots);
    expect(error.message.split('\n').slice(1)).toEqual([
      '  first differing path at tick 2: $.cells.player_1.targetX',
      '    expected 72, got (missing)',
    ]);
    expect(formatDivergence(divergence, { ...snapshots, firstDifference: null })).toContain(
      'the snapshots at tick 2 agree: the hashed state differs outside the snapshot',
    );
    expect(formatDivergence(divergence, { ...snapshots, wasReproduced: false })).toContain(
      're-running both sides to tick 2 did not reproduce the divergence',
    );
    expect(new ScenarioDivergenceError(IDENTITY, divergence).snapshots).toBeNull();
  });

  it('formats one failure on two indented lines', () => {
    expect(formatExpectationFailure(FAILURE).split('\n')).toEqual([
      '  at tick 30: A mass',
      '    expected 115.92 ± 0.01, got 110 (off by 5.92)',
    ]);
  });

  it('is a distinct error class for setup mistakes', () => {
    const error = new ScenarioSetupError('no seed');
    expect(error.name).toBe('ScenarioSetupError');
    expect(error).toBeInstanceOf(Error);
  });
});
