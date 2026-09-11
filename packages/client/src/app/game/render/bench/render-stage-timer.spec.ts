import { describe, expect, it } from 'vitest';
import { ManualClock, RENDER_STAGE, RENDER_STAGE_NAMES } from '@evolution/shared';
import { RenderStageTimer, quantileOf } from './render-stage-timer';

describe('quantileOf', () => {
  it('takes the sorted sample at the quantile and 0 with no samples', () => {
    expect(quantileOf([5, 1, 3, 2, 4], 0.95)).toBe(5);
    expect(quantileOf([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantileOf([], 0.95)).toBe(0);
  });
});

describe('RenderStageTimer', () => {
  it('reports every stage key, a p95 per stage and the frame statistics', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    for (let frame = 0; frame < 20; frame += 1) {
      timer.beginFrame();
      timer.begin(RENDER_STAGE.cells);
      clock.advanceMilliseconds(frame === 19 ? 10 : 1);
      timer.end(RENDER_STAGE.cells);
      timer.measure(RENDER_STAGE.submit, () => clock.advanceMilliseconds(2));
      timer.endFrame();
    }
    const report = timer.report();
    expect(Object.keys(report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
    expect(report.renderStagesMs.cells).toBe(10);
    expect(report.renderStagesMs.submit).toBe(2);
    expect(report.renderStagesMs.net).toBe(0);
    expect(report.frameTimePeakMs).toBe(12);
    expect(report.frameTimeAvgMs).toBeCloseTo((19 * 3 + 12) / 20, 9);
    expect(report.fps).toBeCloseTo(1000 / report.frameTimeAvgMs, 9);
    expect(timer.frameCount).toBe(20);
  });

  it('keeps only the last `capacity` samples and ignores an end without a begin', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock, 2);
    timer.end(RENDER_STAGE.food);
    timer.endFrame();
    for (const cost of [50, 1, 1]) {
      timer.beginFrame();
      clock.advanceMilliseconds(cost);
      timer.endFrame();
    }
    expect(timer.report().frameTimePeakMs).toBe(1);
    expect(timer.frameCount).toBe(2);
    expect(timer.report().renderStagesMs.food).toBe(0);
  });

  it('reports zeros before any frame', () => {
    const report = new RenderStageTimer(new ManualClock()).report();
    expect(report).toMatchObject({ fps: 0, frameTimeAvgMs: 0, frameTimeP95Ms: 0, frameTimePeakMs: 0 });
  });
});
