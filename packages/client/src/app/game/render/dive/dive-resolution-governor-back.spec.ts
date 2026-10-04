// @vitest-environment node
// The dive's resolution governor stepping back (docs/rendering/opening-dive.md §6, ticket #804): a step down that did
// not help undone and backed off, a notch back up after a stretch on budget, a notch that did not fit tried ever more
// rarely so it never pumps, and the falling ceiling.

import { describe, expect, it } from 'vitest';
import { DIVE_RESOLUTION_GOVERNOR } from '../constants';
import {
  SLOW_MS,
  SMOOTH_MS,
  SOFTWARE_LENS_MS,
  gpuBound,
  governorFeed as feed,
} from '../../../../testing/dive-governor-feed';

const {
  windowFrames,
  stepRatio,
  floorResolution,
  stepUpAfterMs,
  probeFailMs,
  maxStepUpAfterMs,
  uselessStepHoldMs,
  sustainedMs,
} = DIVE_RESOLUTION_GOVERNOR;

describe('DiveResolutionGovernor stepping back', () => {
  it('keeps a step down that helped', () => {
    const subject = feed(1);
    // 36 ms at full resolution: a notch gives about 25 ms, which helped, and the next about 18 ms, on budget.
    subject.untilChange(gpuBound(36), sustainedMs * 4);
    subject.untilChange(gpuBound(36), sustainedMs * 4);
    // On budget at the second notch: it stays there until the wait for a notch up.
    subject.frames(Math.floor(stepUpAfterMs / 20), gpuBound(36));
    expect(subject.changes).toEqual([stepRatio, stepRatio * stepRatio]);
  });

  it('never undoes a leap, though the next window is no quicker (the camera moved on to a heavier band)', () => {
    const subject = feed(1);
    subject.frames(windowFrames * 10, SOFTWARE_LENS_MS);
    expect(subject.changes).toEqual([floorResolution]);
  });

  it('undoes a one-notch step down that did not help, and tries the next only after a wait that doubles', () => {
    const subject = feed(1);
    const undoneAtMs: number[] = [];
    // Frames over budget whatever the resolution: the page's own work, not the GPU's.
    const limitMs = uselessStepHoldMs * 16;
    while (undoneAtMs.length < 4 && subject.nowMs < limitMs) {
      subject.frames(1, SLOW_MS);
      if (subject.changes.length % 2 === 0 && subject.changes.length / 2 > undoneAtMs.length) {
        undoneAtMs.push(subject.nowMs);
      }
    }
    expect(subject.changes).toEqual([stepRatio, 1, stepRatio, 1, stepRatio, 1, stepRatio, 1]);
    const waits = undoneAtMs.slice(1).map((atMs, index) => atMs - undoneAtMs[index]!);
    const expected = [1, 2, 4].map((factor) => uselessStepHoldMs * factor);
    waits.forEach((waitMs, index) => {
      expect(waitMs).toBeGreaterThanOrEqual(expected[index]!);
      expect(waitMs).toBeLessThan(expected[index]! + SLOW_MS * (windowFrames + 1) * 3 + sustainedMs * 2);
    });
  });

  it('steps one notch back up after a stretch on budget, and on up to the dive’s ratio', () => {
    const subject = feed(1);
    subject.untilChange(gpuBound(36), sustainedMs * 4);
    subject.untilChange(gpuBound(36), sustainedMs * 4);
    const low = subject.governor.resolution;
    expect(low).toBeCloseTo(stepRatio * stepRatio, 12);
    const waitedMs = subject.smoothUntilChange(stepUpAfterMs * 2);
    expect(waitedMs).toBeGreaterThanOrEqual(stepUpAfterMs);
    expect(waitedMs).toBeLessThan(stepUpAfterMs + SMOOTH_MS * (windowFrames + 2));
    expect(subject.governor.resolution).toBeCloseTo(stepRatio, 12);
    subject.smoothUntilChange(stepUpAfterMs * 2);
    expect(subject.governor.resolution).toBe(1);
    expect(subject.smoothUntilChange(maxStepUpAfterMs * 2)).toBeGreaterThanOrEqual(maxStepUpAfterMs * 2);
  });

  it('backs off a notch that did not fit: each failed try waits twice as long, so it never pumps', () => {
    const subject = feed(1);
    subject.untilChange(SLOW_MS, sustainedMs * 4);
    const fits = subject.governor.resolution;
    const waits: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      waits.push(subject.smoothUntilChange(maxStepUpAfterMs * 2));
      expect(subject.governor.resolution).toBe(1);
      // The notch up is too much: its frames run over at once, and it steps back down within the probe's window.
      subject.untilChange(SLOW_MS, sustainedMs * 4);
      expect(subject.governor.resolution).toBe(fits);
    }
    const expected = [1, 2, 4, 8, 16, 16].map((factor) => Math.min(maxStepUpAfterMs, stepUpAfterMs * factor));
    waits.forEach((waitMs, attempt) => {
      expect(waitMs).toBeGreaterThanOrEqual(expected[attempt]!);
      expect(waitMs).toBeLessThan(expected[attempt]! + SMOOTH_MS * (windowFrames + 2));
    });
  });

  it('puts the wait back once a notch up holds past the probe’s window', () => {
    const subject = feed(1);
    subject.untilChange(gpuBound(36), sustainedMs * 4);
    subject.untilChange(gpuBound(36), sustainedMs * 4);
    // Fail the first try at the middle notch: the next waits twice as long.
    subject.smoothUntilChange(maxStepUpAfterMs);
    subject.untilChange(SLOW_MS, sustainedMs * 4);
    expect(subject.smoothUntilChange(maxStepUpAfterMs)).toBeGreaterThanOrEqual(stepUpAfterMs * 2);
    // That notch holds: the try at the top waits the first wait again.
    subject.frames(Math.ceil(probeFailMs / SMOOTH_MS) + windowFrames, SMOOTH_MS);
    const waitedMs = subject.smoothUntilChange(maxStepUpAfterMs);
    expect(subject.governor.resolution).toBe(1);
    expect(waitedMs).toBeLessThan(stepUpAfterMs);
  });

  it('renders at most at the falling ceiling, and a notch down from it goes under it', () => {
    const subject = feed(2, 1.5);
    subject.frames(1, SMOOTH_MS);
    expect(subject.governor.resolution).toBe(1.5);
    subject.untilChange(SLOW_MS, sustainedMs * 4);
    // The rung under 1.5 on the ladder from 2 (2 × 0.84² ≈ 1.41), not the one under 2 (1.68, clipped to 1.5 again).
    expect(subject.governor.resolution).toBeCloseTo(2 * stepRatio * stepRatio, 12);
    // Still, the ceiling lifts; the governed rung stays.
    subject.frames(1, SMOOTH_MS, { ceiling: 2 });
    expect(subject.governor.resolution).toBeCloseTo(2 * stepRatio * stepRatio, 12);
  });

  it('never steps up past the ceiling: a rung above it would render nothing more', () => {
    const subject = feed(2, 1.5);
    subject.frames(maxStepUpAfterMs / SMOOTH_MS, SMOOTH_MS);
    expect(subject.changes).toEqual([1.5]);
    expect(subject.governor.notch).toBe(0);
  });
});
