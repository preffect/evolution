// @vitest-environment node
// The dive's resolution governor and a GPU only a little too slow (docs/rendering/opening-dive.md §6, ticket #816):
// 40–55 fps mixes quick and late frames, as a busy page's do, so no window is over budget throughout; a span of
// seconds whose mean is a little slow tries one notch down, keeps it when the frames came quicker, and gives it back
// when they did not.

import { MILLISECONDS_PER_SECOND } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_RESOLUTION_GOVERNOR, DIVE_TARGET_FRAME_MS } from '../constants';
import { SMOOTH_MS, governorFeed as feed, vsyncPaced, type FrameGap } from '../../../../testing/dive-governor-feed';

const { stepRatio, spanMs, slightlySlowRatio, trialCpuShare, uselessStepHoldMs, maxStepUpAfterMs } =
  DIVE_RESOLUTION_GOVERNOR;
/** A GPU at about 50 fps at the dive's ratio: its frames 20 ms of work, a vsync or two apart. */
const FIFTY_FPS_MS = 20;
/** A GPU at about 40 fps: every other frame misses its vsync. */
const FORTY_FPS_MS = 25;
/** How long each case runs: several spans, and the first notches up tried. */
const RUN_MS = 30_000;
/** A page's own work well under the trial's share of the frame: a GPU's frames, the page idle. */
const LIGHT_CPU_MS = 1;
/** Two vsyncs: a missed one. */
const MISSED_MS = SMOOTH_MS * 2;
/** One notch under the dive's ratio of 2. */
const ONE_NOTCH = 2 * stepRatio;

type Feed = ReturnType<typeof feed>;

/** Frames `gap` apart for `durationMs`, `cpuMs` of the page's own work each; answers the ms spent at each resolution. */
function run(subject: Feed, gap: FrameGap, durationMs: number, cpuMs = LIGHT_CPU_MS): Map<number, number> {
  const spentMs = new Map<number, number>();
  const endMs = subject.nowMs + durationMs;
  while (subject.nowMs < endMs) {
    const resolution = subject.governor.resolution;
    const before = subject.nowMs;
    subject.frames(1, gap, { cpuMs });
    spentMs.set(resolution, (spentMs.get(resolution) ?? 0) + subject.nowMs - before);
  }
  return spentMs;
}

/** Quick and missed frames in turn whatever the resolution: a mean of 25 ms, 40 fps, the page's own doing. */
function alternating(): () => number {
  let frame = 0;
  return () => (frame++ % 2 === 0 ? MISSED_MS : SMOOTH_MS);
}

/** When the resolution changed, while `gap`'s frames run `durationMs`. */
function changeTimes(subject: Feed, gap: FrameGap, durationMs: number): number[] {
  const changedAtMs: number[] = [];
  const endMs = subject.nowMs + durationMs;
  while (subject.nowMs < endMs) {
    const before = subject.changes.length;
    subject.frames(1, gap, { cpuMs: LIGHT_CPU_MS });
    if (subject.changes.length > before) changedAtMs.push(subject.nowMs);
  }
  return changedAtMs;
}

describe('DiveResolutionGovernor and a GPU a little too slow (ticket #816)', () => {
  it('steps one notch down for a GPU at 40–50 fps, whose windows are never over budget throughout, and stays', () => {
    for (const fullMs of [FIFTY_FPS_MS, FORTY_FPS_MS]) {
      const subject = feed(2);
      const spentMs = run(subject, vsyncPaced(fullMs, 2), RUN_MS);
      // One notch is 0.7× the pixels, 14–18 ms of work: at or near 60 fps. Notches up are tried, and given back.
      expect(subject.changes[0]).toBeCloseTo(ONE_NOTCH, 12);
      expect(Math.min(...subject.changes)).toBeCloseTo(ONE_NOTCH, 12);
      expect(spentMs.get(ONE_NOTCH)!).toBeGreaterThan(RUN_MS * 0.6);
    }
  });

  it('tries the notch once a span of the frames is over, not before', () => {
    const subject = feed(2);
    const waitedMs = subject.untilChange(vsyncPaced(FIFTY_FPS_MS, 2), RUN_MS);
    expect(subject.changes).toHaveLength(1);
    // The first frame starts the clock; the span ends a frame or two past `spanMs`.
    expect(waitedMs).toBeGreaterThanOrEqual(spanMs);
    expect(waitedMs).toBeLessThan(spanMs + MISSED_MS * 2);
  });

  it('leaves a GPU alone whose mean is within the slack, and not one just past it', () => {
    const slackMs = DIVE_TARGET_FRAME_MS * slightlySlowRatio;
    const under = feed(2);
    run(under, vsyncPaced(slackMs * 0.97, 2), RUN_MS);
    expect(under.changes).toEqual([]);
    const over = feed(2);
    run(over, vsyncPaced(slackMs * 1.03, 2), RUN_MS);
    expect(over.changes[0]).toBeCloseTo(ONE_NOTCH, 12);
  });

  it('never tries a notch while the page’s own work fills its share of the frame: its missed vsyncs are its own', () => {
    const busyCpuMs = DIVE_TARGET_FRAME_MS * trialCpuShare;
    const busy = feed(2);
    run(busy, vsyncPaced(FIFTY_FPS_MS, 2), RUN_MS, busyCpuMs);
    expect(busy.changes).toEqual([]);
    const lighter = feed(2);
    run(lighter, vsyncPaced(FIFTY_FPS_MS, 2), RUN_MS, busyCpuMs * 0.9);
    expect(lighter.changes[0]).toBeCloseTo(ONE_NOTCH, 12);
  });

  it('gives a trial back when the frames come no quicker, and tries again only after a wait that doubles', () => {
    const subject = feed(2);
    const [down, back, again, backAgain, third] = changeTimes(subject, alternating(), uselessStepHoldMs * 6);
    expect(subject.changes.slice(0, 5)).toEqual([ONE_NOTCH, 2, ONE_NOTCH, 2, ONE_NOTCH]);
    // A trial lasts a span; the wait after it is 6 s, then 12 s, and a span more to judge the frames again.
    expect(back! - down!).toBeLessThan(spanMs + MISSED_MS * 2);
    expect(again! - back!).toBeGreaterThanOrEqual(uselessStepHoldMs);
    expect(again! - back!).toBeLessThan(uselessStepHoldMs + spanMs + MISSED_MS * 2);
    expect(third! - backAgain!).toBeGreaterThanOrEqual(uselessStepHoldMs * 2);
  });

  it('backs off a notch up that a span steps back down soon after: it never pumps', () => {
    const subject = feed(2);
    const changedAtMs = changeTimes(subject, vsyncPaced(FIFTY_FPS_MS, 2), maxStepUpAfterMs * 3);
    const upsAtMs = changedAtMs.filter((_atMs, index) => subject.changes[index] === 2);
    // The wait before each notch up doubles (3, 6, 12, 24, 48 s): the time between them grows every time.
    expect(upsAtMs.length).toBeGreaterThanOrEqual(3);
    const betweenMs = upsAtMs.slice(1).map((atMs, index) => atMs - upsAtMs[index]!);
    betweenMs.slice(1).forEach((intervalMs, index) => expect(intervalMs).toBeGreaterThan(betweenMs[index]!));
    expect(subject.governor.resolution).toBeCloseTo(ONE_NOTCH, 12);
  });

  it('leaves stalls out of the span: a long task a second among smooth frames never tries a notch', () => {
    const subject = feed(2);
    const longTaskMs = 200;
    const framesASecond = Math.round(MILLISECONDS_PER_SECOND / SMOOTH_MS);
    for (let second = 0; second < RUN_MS / MILLISECONDS_PER_SECOND; second += 1) {
      subject.frames(framesASecond - 1, SMOOTH_MS, { cpuMs: LIGHT_CPU_MS });
      subject.frames(1, longTaskMs, { cpuMs: LIGHT_CPU_MS });
    }
    expect(subject.changes).toEqual([]);
  });
});
