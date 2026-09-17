// The preview's walk arithmetic and budget verdict (docs/architecture/encyclopedia.md §12.7,
// docs/rendering/budget.md §7). The verdict rows go `null` rather than pass wherever the evidence cannot support
// one, which is the rule the bench report already follows: a number that could not be measured is never a pass.

import { TICK_INTERVAL_S } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { PREVIEW_FRAME_BUDGET_MS, PREVIEW_OPEN_BUDGET_MS } from '../constants';
import type { PreviewOpenTimings } from './preview-session';
import {
  PREVIEW_BUDGETS,
  PREVIEW_WALK_STEP_MS,
  previewBudgetVerdict,
  previewOpenP95Ms,
  previewWalkFrameCount,
} from './preview-timings';

const millisecondsPerSecond = 1000;

function timings(openedToFirstFrameMs: number): PreviewOpenTimings {
  return { initMs: 1, bakeMs: 1, firstSubmitMs: 1, openedToFirstFrameMs };
}

describe('the walk', () => {
  it('steps exactly one simulation tick a frame', () => {
    expect(PREVIEW_WALK_STEP_MS).toBeCloseTo(TICK_INTERVAL_S * millisecondsPerSecond, 9);
  });

  it('visits every tick from the loop start up to the park, and none past it', () => {
    const parkSeconds = 3;
    const frames = previewWalkFrameCount(parkSeconds);
    expect(frames).toBe(Math.floor(parkSeconds / TICK_INTERVAL_S));
    expect(frames * PREVIEW_WALK_STEP_MS).toBeCloseTo(parkSeconds * millisecondsPerSecond, 6);
    expect(previewWalkFrameCount(0)).toBe(0);
    expect(previewWalkFrameCount(TICK_INTERVAL_S / 2), 'less than one tick is no walk at all').toBe(0);
  });
});

describe('the budget verdict', () => {
  it('carries the two budgets the render constants own', () => {
    expect(PREVIEW_BUDGETS).toEqual({ openMs: PREVIEW_OPEN_BUDGET_MS, frameMs: PREVIEW_FRAME_BUDGET_MS });
  });

  it('judges no open without a warm one, and no frame without a finite p95', () => {
    expect(previewOpenP95Ms([])).toBeNull();
    expect(previewBudgetVerdict(null, 0.5)).toEqual({ isOpenWithinBudget: null, isFrameWithinBudget: true });
    expect(previewBudgetVerdict(null, Number.NaN)).toEqual({
      isOpenWithinBudget: null,
      isFrameWithinBudget: null,
    });
  });

  it('takes the open p95 over the warm opens alone: the cold one is never among them', () => {
    const warm = [timings(10), timings(12), timings(11)];
    const p95 = previewOpenP95Ms(warm);
    expect(p95).not.toBeNull();
    expect(p95!).toBeGreaterThanOrEqual(10);
    expect(p95!).toBeLessThanOrEqual(12);
  });

  it('fails a row that is over its budget', () => {
    expect(previewBudgetVerdict(PREVIEW_OPEN_BUDGET_MS - 1, 0.5).isOpenWithinBudget).toBe(true);
    expect(previewBudgetVerdict(PREVIEW_OPEN_BUDGET_MS + 1, 0.5).isOpenWithinBudget).toBe(false);
    expect(previewBudgetVerdict(1, PREVIEW_FRAME_BUDGET_MS + 1).isFrameWithinBudget).toBe(false);
  });
});
