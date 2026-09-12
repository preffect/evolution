import { ManualClock, P95_QUANTILE, RENDER_STAGE, RENDER_STAGE_NAMES } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { RENDER_P95_MIN_SAMPLE_FRAMES } from '../constants';
import { RenderStageTimer, SampleRing, UNTIMED_STAGES, quantileOf } from './render-stage-timer';

describe('quantileOf', () => {
  it('interpolates between the two ranks around the quantile and reads 0 with no samples', () => {
    // Rank 0.95 × (5 − 1) = 3.8: four fifths of the way from the fourth sample to the fifth.
    expect(quantileOf([5, 1, 3, 2, 4], P95_QUANTILE)).toBeCloseTo(4.8, 9);
    expect(quantileOf([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(quantileOf([7], P95_QUANTILE)).toBe(7);
    expect(quantileOf([], P95_QUANTILE)).toBe(0);
  });

  it('is below the maximum at the shortest window a p95 is estimable in', () => {
    const window = Array.from({ length: RENDER_P95_MIN_SAMPLE_FRAMES }, (_unused, index) => index + 1);
    const maximum = RENDER_P95_MIN_SAMPLE_FRAMES;
    expect(quantileOf(window, P95_QUANTILE)).toBeLessThan(maximum);
    expect(quantileOf(window, P95_QUANTILE)).toBeGreaterThan(maximum - 2);
  });
});

describe('SampleRing', () => {
  it('keeps the last `capacity` samples and reports their average, peak, minimum and p95', () => {
    const ring = new SampleRing(3);
    for (const sample of [50, 1, 2, 3]) ring.push(sample);
    expect(ring.count).toBe(3);
    expect(ring.average()).toBe(2);
    expect(ring.peak()).toBe(3);
    expect(ring.minimum()).toBe(1);
    expect(ring.p95()).toBeCloseTo(2.9, 9);
    expect(ring.window()).toEqual([1, 2, 3]);
  });

  it('drops the newest sample on pop, in a full ring as in a partial one, and pops nothing when empty', () => {
    const ring = new SampleRing(2);
    ring.pop();
    expect(ring.count).toBe(0);
    for (const sample of [1, 2, 3]) ring.push(sample);
    ring.pop();
    expect(ring.window()).toEqual([2]);
    ring.push(9);
    expect(ring.window()).toEqual([2, 9]);
  });

  it('reports zero for the minimum of an empty window', () => {
    expect(new SampleRing(2).minimum()).toBe(0);
  });
});

describe('RenderStageTimer', () => {
  it('reports every stage key, a p95 per stage and the frame statistics', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    // The worst two of twenty frames: a p95 sits inside that top pair, one outlier in twenty does not reach it.
    for (let frame = 0; frame < 20; frame += 1) {
      timer.beginFrame();
      timer.measure(RENDER_STAGE.cells, () => clock.advanceMilliseconds(frame >= 18 ? 10 : 1));
      timer.measure(RENDER_STAGE.submit, () => clock.advanceMilliseconds(2));
      timer.endFrame();
    }
    const report = timer.report();
    expect(Object.keys(report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
    expect(report.renderStagesMs.cells).toBe(10);
    expect(report.renderStagesMs.submit).toBe(2);
    expect(report.renderStagesMs.net).toBe(0);
    expect(report.frameTimePeakMs).toBe(12);
    expect(report.frameTimeAvgMs).toBeCloseTo((18 * 3 + 2 * 12) / 20, 9);
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
    // Samples [6, 1]: the accrual rode the first one only, so the second is the bare millisecond.
    expect(timer.report().renderStagesMs.net).toBeCloseTo(5.75, 9);
    const timerWithSmallWindow = new RenderStageTimer(clock, 1);
    timerWithSmallWindow.accrue(RENDER_STAGE.net, () => clock.advanceMilliseconds(3));
    timerWithSmallWindow.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(2));
    timerWithSmallWindow.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(1));
    expect(timerWithSmallWindow.report().renderStagesMs.net).toBe(1);
  });

  it('returns the measured work’s result and records the stage even when it throws', () => {
    const clock = new ManualClock(0);
    expect(new RenderStageTimer(clock).measure(RENDER_STAGE.food, () => 7)).toBe(7);
    const timer = new RenderStageTimer(clock);
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

  it('takes time accrued inside an open bracket out of that bracket too, so it is charged once', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    timer.measure(RENDER_STAGE.cells, () => {
      clock.advanceMilliseconds(2);
      timer.accrue(RENDER_STAGE.effects, () => clock.advanceMilliseconds(7));
    });
    timer.measure(RENDER_STAGE.effects, () => clock.advanceMilliseconds(1));
    expect(timer.report().renderStagesMs.cells).toBe(2);
    expect(timer.report().renderStagesMs.effects).toBe(8);
  });
});

describe('RenderStageTimer residual', () => {
  it('measures the frame time no top-level bracket covered, frame by frame', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    for (let frame = 0; frame < 4; frame += 1) {
      timer.beginFrame();
      timer.measure(RENDER_STAGE.cells, () => clock.advanceMilliseconds(3));
      // Work inside the frame that no stage brackets: the dish placement, the HUD.
      clock.advanceMilliseconds(frame === 3 ? 5 : 1);
      timer.endFrame();
    }
    expect(timer.residual().minimumMs).toBe(1);
    expect(timer.residual().peakMs).toBe(5);
    expect(timer.residual().p95Ms).toBeGreaterThan(1);
  });

  it('does not count out-of-frame accrued work as frame time, so the residual stays a measurement', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    timer.accrue(RENDER_STAGE.net, () => clock.advanceMilliseconds(20));
    timer.beginFrame();
    timer.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(2));
    timer.endFrame();
    expect(timer.report().renderStagesMs.net, 'the apply is charged to the stage').toBe(22);
    expect(timer.residual().peakMs, 'but never to the frame it was not inside').toBe(0);
  });

  it('records nothing for a frame that produced no work to draw', () => {
    const clock = new ManualClock(0);
    const timer = new RenderStageTimer(clock);
    timer.beginFrame();
    timer.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(1));
    timer.cancelFrame(RENDER_STAGE.net);
    clock.advanceMilliseconds(50);
    expect(timer.frameCount).toBe(0);
    expect(timer.report().renderStagesMs.net).toBe(0);
    timer.beginFrame();
    timer.measure(RENDER_STAGE.net, () => clock.advanceMilliseconds(4));
    timer.endFrame();
    expect(timer.report().renderStagesMs.net, 'the cancelled frame biases nothing').toBe(4);
  });
});

describe('UNTIMED_STAGES', () => {
  it('runs the work and returns its result', () => {
    expect(UNTIMED_STAGES.measure(RENDER_STAGE.camera, () => 'done')).toBe('done');
    expect(UNTIMED_STAGES.accrue(RENDER_STAGE.camera, () => 'done')).toBe('done');
  });
});
