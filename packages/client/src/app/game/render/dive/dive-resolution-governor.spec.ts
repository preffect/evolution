// @vitest-environment node
// The dive's resolution governor (docs/rendering/opening-dive.md §6, ticket #804): its ladder, how many notches a slow
// frame costs, and stepping down on a window of slow frames but never on one long task, CPU-bound frames or frames it
// does not judge. Stepping back is `dive-resolution-governor-back.spec.ts`.

import { describe, expect, it } from 'vitest';
import { DIVE_RESOLUTION_GOVERNOR, DIVE_TARGET_FRAME_MS } from '../constants';
import { diveNotchesDown, diveResolutionLadder } from './dive-resolution-governor';
import {
  SLOW_MS,
  SMOOTH_MS,
  SOFTWARE_LENS_MS,
  gpuBound,
  governorFeed as feed,
} from '../../../../testing/dive-governor-feed';

const { windowFrames, minWindowFrames, windowMs, stepRatio, floorResolution, maxGapMs, leapRatio, sustainedMs } =
  DIVE_RESOLUTION_GOVERNOR;

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

  it('steps one notch down once frames run a little over budget throughout for a while, and not before', () => {
    const subject = feed(1);
    const waitedMs = subject.untilChange(SLOW_MS, sustainedMs * 4);
    expect(subject.governor.resolution).toBeCloseTo(stepRatio, 12);
    // The first frame starts the clock, a window fills, and it stays over budget for `sustainedMs`.
    expect(waitedMs).toBeGreaterThanOrEqual(SLOW_MS * windowFrames + sustainedMs);
    expect(waitedMs).toBeLessThan(SLOW_MS * (windowFrames + 2) + sustainedMs);
  });

  it('never steps down for a busy page’s missed vsyncs: 33 ms gaps among 16.7 ms ones (ticket #804’s review)', () => {
    const missed = DIVE_TARGET_FRAME_MS * 2;
    const cpuMs = 14;
    // Every other frame misses, then bursts of three in a row every few seconds: the GPU is never behind.
    const alternating = feed(2);
    for (let frame = 0; frame < 2000; frame += 1)
      alternating.frames(1, frame % 2 === 0 ? missed : SMOOTH_MS, { cpuMs });
    expect(alternating.changes).toEqual([]);
    const bursts = feed(2);
    for (let burst = 0; burst < 20; burst += 1) {
      bursts.frames(3, missed, { cpuMs });
      bursts.frames(200, SMOOTH_MS, { cpuMs });
    }
    expect(bursts.changes).toEqual([]);
  });

  it('still steps down when the GPU is behind on every frame', () => {
    const subject = feed(2);
    subject.untilChange(gpuBound(DIVE_TARGET_FRAME_MS * 2, 2), sustainedMs * 4);
    expect(subject.changes).toHaveLength(1);
    expect(subject.governor.resolution).toBeLessThan(2);
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
    // The first frame starts the clock; `minWindowFrames − 1` gaps are short of the window's span; the next is judged
    // over budget throughout, and the one after, `sustainedMs` on, steps.
    subject.frames(minWindowFrames + 1, gapMs);
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
    subject.untilChange(SLOW_MS, sustainedMs * 4);
    expect(subject.changes).toHaveLength(1);
    // A full window at the new resolution is needed again, plus the frame that only starts the clock, before the
    // governor judges anything: here that the step did not help, so it is undone.
    subject.frames(windowFrames, SLOW_MS);
    expect(subject.changes).toHaveLength(1);
    subject.frames(1, SLOW_MS);
    expect(subject.changes).toEqual([stepRatio, 1]);
  });
});
