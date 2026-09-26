// @vitest-environment node
// The hardware run's gate (docs/rendering/budget.md §7, ticket #264): an unavailable row never reads as a pass.

import { RENDER_STAGE } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { BUDGET_ROW_NAMES, benchGate, parseExpectedUnjudged } from './bench-gate';
import { BUDGET_ROW, type BudgetVerdict } from './render-benchmark';

const JUDGED_EVERYWHERE: BudgetVerdict = {
  isWithinBudget: true,
  isFullyJudged: true,
  overruns: [],
  unjudged: [],
  informational: [],
  timerResolutionMs: 0.005,
  stagesTotalMs: 3,
  residualP95Ms: 0.5,
  derivedResidualMs: 0.2,
  sampleCount: 240,
  isP95Estimable: true,
};
const GPU_UNJUDGED: BudgetVerdict = { ...JUDGED_EVERYWHERE, isFullyJudged: false, unjudged: [BUDGET_ROW.gpu] };
const IS_ADVANCING = true;

describe('benchGate', () => {
  it('passes a fully judged, within-budget run that advanced a tick a frame', () => {
    expect(benchGate(JUDGED_EVERYWHERE, IS_ADVANCING, []).isPassed).toBe(true);
  });

  it('fails a within-budget run with an unjudged row nobody expected: an unavailable GPU is not a pass', () => {
    const gate = benchGate(GPU_UNJUDGED, IS_ADVANCING, []);
    expect(GPU_UNJUDGED.isWithinBudget, 'the verdict alone would read as a pass').toBe(true);
    expect(gate.isPassed).toBe(false);
    expect(gate.unexpectedUnjudged).toEqual([BUDGET_ROW.gpu]);
  });

  it('passes the same run once the URL named the row as expected unjudged', () => {
    const gate = benchGate(GPU_UNJUDGED, IS_ADVANCING, [BUDGET_ROW.gpu]);
    expect(gate.isPassed).toBe(true);
    expect(gate.unexpectedUnjudged).toEqual([]);
  });

  it('fails a parked run whatever the verdict: its `net` is the interpolation half only', () => {
    const gate = benchGate(JUDGED_EVERYWHERE, !IS_ADVANCING, []);
    expect(gate.isPassed).toBe(false);
    expect(gate.isTickAdvancing).toBe(false);
  });

  it('fails an over-budget run even with every unjudged row expected', () => {
    const overrun = { name: BUDGET_ROW.frame, measured: 13, budget: 12 };
    const over: BudgetVerdict = { ...GPU_UNJUDGED, isWithinBudget: false, overruns: [overrun] };
    expect(benchGate(over, IS_ADVANCING, [BUDGET_ROW.gpu]).isPassed).toBe(false);
  });
});

describe('parseExpectedUnjudged', () => {
  it('reads the named rows and drops unknown names, which can only fail the gate', () => {
    expect(parseExpectedUnjudged(null)).toEqual([]);
    expect(parseExpectedUnjudged(`${BUDGET_ROW.hud}, ${BUDGET_ROW.gpu},gpux`).sort()).toEqual(
      [BUDGET_ROW.gpu, BUDGET_ROW.hud].sort(),
    );
  });

  it('accepts every row a verdict can name, the stages among them', () => {
    expect(BUDGET_ROW_NAMES).toContain(RENDER_STAGE.dish);
    expect(parseExpectedUnjudged(BUDGET_ROW_NAMES.join(','))).toEqual(BUDGET_ROW_NAMES);
  });
});
