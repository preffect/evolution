// @vitest-environment node
// The hardware run's gate (docs/rendering/budget.md §7, ticket #264): an unavailable row never reads as a pass.

import { RENDER_STAGE, RENDER_STAGE_NAMES } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { EXPECTABLE_UNJUDGED_ROWS, benchGate, parseExpectedUnjudged } from './bench-gate';
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

  it('fails a window too short for a p95 even when the URL tries to excuse every row it left unjudged', () => {
    const quantileRows = [...RENDER_STAGE_NAMES, BUDGET_ROW.frame, BUDGET_ROW.gpu, BUDGET_ROW.hud];
    const short: BudgetVerdict = {
      ...JUDGED_EVERYWHERE,
      isFullyJudged: false,
      unjudged: quantileRows,
      sampleCount: 10,
      isP95Estimable: false,
    };
    const gate = benchGate(short, IS_ADVANCING, quantileRows);
    expect(gate.isPassed).toBe(false);
    expect(gate.isP95Estimable).toBe(false);
  });

  it('fails a short window on its own, with no row left unjudged to blame', () => {
    const short: BudgetVerdict = { ...JUDGED_EVERYWHERE, sampleCount: 10, isP95Estimable: false };
    expect(benchGate(short, IS_ADVANCING, []).isPassed).toBe(false);
  });

  it('excuses only a row a real machine can fail to measure: an expected `hud` still fails the gate', () => {
    const hudUnjudged: BudgetVerdict = { ...JUDGED_EVERYWHERE, isFullyJudged: false, unjudged: [BUDGET_ROW.hud] };
    const gate = benchGate(hudUnjudged, IS_ADVANCING, [BUDGET_ROW.hud]);
    expect(gate.isPassed).toBe(false);
    expect(gate.expectedUnjudged).toEqual([]);
    expect(gate.unexpectedUnjudged).toEqual([BUDGET_ROW.hud]);
  });

  it('fails an over-budget run even with every unjudged row expected', () => {
    const overrun = { name: BUDGET_ROW.frame, measured: 13, budget: 12 };
    const over: BudgetVerdict = { ...GPU_UNJUDGED, isWithinBudget: false, overruns: [overrun] };
    expect(benchGate(over, IS_ADVANCING, [BUDGET_ROW.gpu]).isPassed).toBe(false);
  });
});

describe('parseExpectedUnjudged', () => {
  it('reads `gpu` and drops every other name, unknown or not excusable, which can only fail the gate', () => {
    expect(parseExpectedUnjudged(null)).toEqual([]);
    expect(parseExpectedUnjudged(`${BUDGET_ROW.hud}, ${BUDGET_ROW.gpu},gpux,${RENDER_STAGE.dish}`)).toEqual([
      BUDGET_ROW.gpu,
    ]);
    expect(EXPECTABLE_UNJUDGED_ROWS).toEqual([BUDGET_ROW.gpu]);
  });
});
