// @vitest-environment node
// The dive's resolution governor (docs/rendering/opening-dive.md §6, ticket #804): its ladder, how many notches a slow
// frame costs, stepping down on a window of slow frames but never on one long task or CPU-bound frames, stepping back
// up with headroom, and backing off a notch that did not fit so it never pumps.

import { describe, expect, it } from 'vitest';
import { DIVE_RESOLUTION_GOVERNOR, DIVE_TARGET_FRAME_MS } from '../constants';
import { DiveResolutionGovernor, diveNotchesDown, diveResolutionLadder } from './dive-resolution-governor';

const {
  windowFrames,
  minWindowFrames,
  windowMs,
  stepRatio,
  floorResolution,
  stepUpAfterMs,
  probeFailMs,
  maxStepUpAfterMs,
  maxGapMs,
  uselessStepHoldMs,
  leapRatio,
} = DIVE_RESOLUTION_GOVERNOR;
const SMOOTH_MS = DIVE_TARGET_FRAME_MS;
/** A frame a little over budget: one notch is enough for it. */
const SLOW_MS = 22.5;
/** The drop's lens under software GL at zoom −2.3 (ticket #804's hand-off). */
const SOFTWARE_LENS_MS = 550;

/** A frame's gap: a fixed one, or one that follows the resolution it was drawn at. */
type FrameGap = number | ((resolution: number) => number);

/** A GPU-bound frame: `fullMs` at the dive's ratio `top`, its cost going with the pixels. */
function gpuBound(fullMs: number, top = 1): (resolution: number) => number {
  return (resolution) => fullMs * Math.pow(resolution / top, 2);
}

/** Feeds frames to a governor on a clock of its own; every frame is judged unless a test says otherwise. */
class FrameFeed {
  nowMs = 0;
  readonly changes: number[] = [];

  constructor(
    readonly governor: DiveResolutionGovernor,
    private readonly ceiling: number,
  ) {}

  /** `count` frames `gapMs` apart, each with `cpuMs` of CPU work; answers the resolution after them. */
  frames(count: number, gap: FrameGap, options: { cpuMs?: number; ceiling?: number; isJudged?: boolean } = {}): number {
    for (let frame = 0; frame < count; frame += 1) {
      this.nowMs += typeof gap === 'number' ? gap : gap(this.governor.resolution);
      const hasChanged = this.governor.noteFrame({
        nowMs: this.nowMs,
        cpuMs: options.cpuMs ?? 0,
        ceiling: options.ceiling ?? this.ceiling,
        isJudged: options.isJudged ?? true,
      });
      if (hasChanged) this.changes.push(this.governor.resolution);
    }
    return this.governor.resolution;
  }

  /** Smooth frames until the resolution changes or `limitMs` passes; answers how long that took. */
  smoothUntilChange(limitMs: number): number {
    const startedMs = this.nowMs;
    const before = this.governor.resolution;
    while (this.governor.resolution === before && this.nowMs - startedMs < limitMs) this.frames(1, SMOOTH_MS);
    return this.nowMs - startedMs;
  }
}

function feed(top: number, ceiling = top): FrameFeed {
  return new FrameFeed(new DiveResolutionGovernor(top), ceiling);
}

describe('diveResolutionLadder', () => {
  it('steps from the dive’s ratio by the notch down to the floor, which ends it', () => {
    const ladder = diveResolutionLadder(1);
    expect(ladder[0]).toBe(1);
    expect(ladder[1]).toBeCloseTo(stepRatio, 12);
    expect(ladder.at(-1)).toBe(floorResolution);
    for (let rung = 1; rung < ladder.length - 1; rung += 1) {
      expect(ladder[rung]! / ladder[rung - 1]!).toBeCloseTo(stepRatio, 12);
    }
    expect(ladder.at(-2)!).toBeGreaterThan(floorResolution);
  });

  it('is one rung when the dive’s ratio is under the floor already', () => {
    expect(diveResolutionLadder(floorResolution / 2)).toEqual([floorResolution / 2]);
  });
});

describe('diveNotchesDown', () => {
  it('is none on budget, and none when the CPU alone is over it (fewer pixels would not help)', () => {
    expect(diveNotchesDown(SMOOTH_MS, 0)).toBe(0);
    expect(diveNotchesDown(SOFTWARE_LENS_MS, DIVE_TARGET_FRAME_MS)).toBe(0);
    expect(diveNotchesDown(SOFTWARE_LENS_MS, DIVE_TARGET_FRAME_MS + 1)).toBe(0);
  });

  it('is one for a frame a little over, and as many as the GPU’s pixels must shrink by for a slow one', () => {
    expect(diveNotchesDown(SLOW_MS, 0)).toBe(1);
    // Up to the leap, one notch however far over: a page's own work can explain that much.
    expect(diveNotchesDown(DIVE_TARGET_FRAME_MS * leapRatio - 1, 0)).toBe(1);
    expect(diveNotchesDown(DIVE_TARGET_FRAME_MS * leapRatio, 0)).toBeGreaterThan(1);
    const cpuMs = 4;
    const notches = diveNotchesDown(SOFTWARE_LENS_MS, cpuMs);
    const pixelsAfter = (count: number): number => Math.pow(stepRatio, 2 * count) * (SOFTWARE_LENS_MS - cpuMs);
    expect(pixelsAfter(notches)).toBeLessThanOrEqual(DIVE_TARGET_FRAME_MS - cpuMs);
    expect(pixelsAfter(notches - 1)).toBeGreaterThan(DIVE_TARGET_FRAME_MS - cpuMs);
  });
});

describe('DiveResolutionGovernor', () => {
  it('starts at the dive’s ratio and holds it through smooth frames', () => {
    const subject = feed(2);
    expect(subject.frames(600, SMOOTH_MS)).toBe(2);
    expect(subject.changes).toEqual([]);
  });

  it('steps one notch down once a window of frames runs a little over budget, and not before', () => {
    const subject = feed(1);
    // The first frame only starts the clock: a window is that many gaps after it.
    subject.frames(windowFrames, SLOW_MS);
    expect(subject.governor.resolution).toBe(1);
    subject.frames(1, SLOW_MS);
    expect(subject.governor.resolution).toBeCloseTo(stepRatio, 12);
  });

  it('never moves for one long task among smooth frames (a bake landing, an upload)', () => {
    const subject = feed(1);
    for (let burst = 0; burst < 20; burst += 1) {
      subject.frames(windowFrames, SMOOTH_MS);
      subject.frames(1, SOFTWARE_LENS_MS);
    }
    expect(subject.changes).toEqual([]);
  });

  it('leaps straight to the floor under software GL’s lens, in one change, from either ratio, and stays', () => {
    for (const top of [1, 2]) {
      const subject = feed(top);
      subject.frames(windowFrames * 10, gpuBound(SOFTWARE_LENS_MS, top));
      expect(subject.changes).toEqual([floorResolution]);
    }
  });

  it('judges frames seconds apart once a few of them span its window, not after a full window of them', () => {
    const subject = feed(2);
    const gapMs = windowMs / (minWindowFrames - 1);
    // The first frame starts the clock; `minWindowFrames − 1` gaps are short of the window's span.
    subject.frames(minWindowFrames, gapMs);
    expect(subject.changes).toEqual([]);
    subject.frames(1, gapMs);
    expect(subject.changes).toEqual([floorResolution]);
  });

  it('never judges fewer than its least window, however slow', () => {
    const subject = feed(1);
    for (let run = 0; run < 10; run += 1) {
      subject.frames(minWindowFrames, maxGapMs);
      subject.governor.interrupt();
    }
    expect(subject.changes).toEqual([]);
  });

  it('never steps down for frames whose CPU work alone is over budget', () => {
    const subject = feed(2);
    subject.frames(100, SOFTWARE_LENS_MS, { cpuMs: SOFTWARE_LENS_MS - 1 });
    expect(subject.changes).toEqual([]);
  });

  it('does not judge frames while a bake runs or the probe draws, nor a gap too long to be a frame', () => {
    const subject = feed(1);
    subject.frames(100, SOFTWARE_LENS_MS, { isJudged: false });
    expect(subject.changes).toEqual([]);
    // Off screen, the ticker stopped: each gap is longer than a frame, and none counts.
    subject.frames(20, maxGapMs + 1);
    expect(subject.changes).toEqual([]);
    // The same frames judged and within reach do move it.
    subject.frames(windowFrames + 1, gpuBound(SOFTWARE_LENS_MS));
    expect(subject.changes).toEqual([floorResolution]);
  });

  it('breaks the window on an interrupt: frames either side never make one window', () => {
    const subject = feed(1);
    for (let run = 0; run < 10; run += 1) {
      subject.frames(windowFrames - 1, SLOW_MS);
      subject.governor.interrupt();
      // The next frame only starts the clock again.
      subject.frames(1, SLOW_MS);
      subject.governor.interrupt();
    }
    expect(subject.changes).toEqual([]);
  });

  it('starts the window again after a step: the frame carrying the resize and the old resolution’s never count', () => {
    const subject = feed(1);
    subject.frames(windowFrames + 1, SLOW_MS);
    expect(subject.changes).toHaveLength(1);
    // A full window at the new resolution is needed again, plus the frame that only starts the clock, before the
    // governor judges anything: here that the step did not help, so it is undone.
    subject.frames(windowFrames, SLOW_MS);
    expect(subject.changes).toHaveLength(1);
    subject.frames(1, SLOW_MS);
    expect(subject.changes).toEqual([stepRatio, 1]);
  });

  it('keeps a step down that helped', () => {
    const subject = feed(1);
    // 36 ms at full resolution: a notch gives about 25 ms, which helped, and the next about 18 ms, on budget.
    subject.frames(windowFrames * 10, gpuBound(36));
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
    while (undoneAtMs.length < 4) {
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
      expect(waitMs).toBeLessThan(expected[index]! + SLOW_MS * (windowFrames + 1) * 3);
    });
  });

  it('steps one notch back up after a stretch on budget, and on up to the dive’s ratio', () => {
    const subject = feed(1);
    subject.frames(windowFrames * 3, gpuBound(36));
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
    subject.frames(windowFrames + 1, SLOW_MS);
    const fits = subject.governor.resolution;
    const waits: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      waits.push(subject.smoothUntilChange(maxStepUpAfterMs * 2));
      expect(subject.governor.resolution).toBe(1);
      // The notch up is too much: its frames run over at once, and it steps back down within the probe's window.
      subject.frames(windowFrames + 1, SLOW_MS);
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
    subject.frames(windowFrames * 3, gpuBound(36));
    // Fail the first try at the middle notch: the next waits twice as long.
    subject.smoothUntilChange(maxStepUpAfterMs);
    subject.frames(windowFrames + 1, SLOW_MS);
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
    subject.frames(windowFrames + 1, SLOW_MS);
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
