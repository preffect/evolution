import { describe, expect, it } from 'vitest';
import { ManualClock, RENDER_STAGE, RENDER_STAGE_NAMES } from '@evolution/shared';
import { RenderStageTimer, SampleRing, UNTIMED_STAGES, quantileOf } from './render-stage-timer';

describe('quantileOf', () => {
  it('takes the sorted sample at the quantile and 0 with no samples', () => {
    expect(quantileOf([5, 1, 3, 2, 4], 0.95)).toBe(5);
    expect(quantileOf([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantileOf([], 0.95)).toBe(0);
  });
});

describe('SampleRing', () => {
  it('keeps the last `capacity` samples and reports their average, peak and p95', () => {
    const ring = new SampleRing(3);
    for (const sample of [50, 1, 2, 3]) ring.push(sample);
    expect(ring.count).toBe(3);
    expect(ring.average()).toBe(2);
    expect(ring.peak()).toBe(3);
    expect(ring.p95()).toBe(3);
  });
});

describe('RenderStageTimer', () => {
  it('reports every stage key, a p95 per stage and the frame statistics', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    for (let frame = 0; frame < 20; frame += 1) {
      timer.beginFrame();
      timer.measure(RENDER_STAGE.cells, () => clock.advanceMilliseconds(frame === 19 ? 10 : 1));
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

  it('folds time accrued between frames into the stage’s next sample, once', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    expect(timer.accrue(RENDER_STAGE.net, () => clock.advanceMilliseconds(3))).toBeUndefined();
    timer.accrue(RENDER_STAGE.net, () => clock.advanceMilliseconds(1));
    timer.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(2));
    expect(timer.report().renderStagesMs.net).toBe(6);
    timer.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(1));
    expect(timer.report().renderStagesMs.net).toBe(6);
    const timerWithSmallWindow = new RenderStageTimer(clock, 1);
    timerWithSmallWindow.accrue(RENDER_STAGE.net, () => clock.advanceMilliseconds(3));
    timerWithSmallWindow.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(2));
    timerWithSmallWindow.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(1));
    expect(timerWithSmallWindow.report().renderStagesMs.net).toBe(1);
  });

  it('returns the measured work’s result and records the stage even when it throws', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    expect(timer.measure(RENDER_STAGE.food, () => 7)).toBe(7);
    expect(() =>
      timer.measure(RENDER_STAGE.food, () => {
        clock.advanceMilliseconds(4);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(timer.report().renderStagesMs.food).toBe(4);
  });

  it('keeps only the last `capacity` frames, ignores an end without a begin and reports zeros before any frame', () => {
    const clock = new ManualClock(0);
    expect(new RenderStageTimer(clock).report()).toMatchObject({ fps: 0, frameTimeAvgMs: 0, frameTimeP95Ms: 0 });
    const timer = new RenderStageTimer(clock, 2);
    timer.endFrame();
    for (const cost of [50, 1, 1]) {
      timer.beginFrame();
      clock.advanceMilliseconds(cost);
      timer.endFrame();
    }
    expect(timer.report().frameTimePeakMs).toBe(1);
    expect(timer.frameCount).toBe(2);
  });
});

describe('RenderStageTimer nesting', () => {
  it('takes a stage measured inside another out of the outer sample', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    timer.measure(RENDER_STAGE.cells, () => {
      clock.advanceMilliseconds(2);
      timer.measure(RENDER_STAGE.organelles, () => clock.advanceMilliseconds(5));
      clock.advanceMilliseconds(1);
    });
    expect(timer.report().renderStagesMs.cells).toBe(3);
    expect(timer.report().renderStagesMs.organelles).toBe(5);
  });
});

describe('UNTIMED_STAGES', () => {
  it('runs the work and returns its result', () => {
    expect(UNTIMED_STAGES.measure(RENDER_STAGE.camera, () => 'done')).toBe('done');
    expect(UNTIMED_STAGES.accrue(RENDER_STAGE.camera, () => 'done')).toBe('done');
  });
});
