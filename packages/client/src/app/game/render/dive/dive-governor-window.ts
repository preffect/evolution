// How the dive's resolution governor judges its frames (docs/rendering/opening-dive.md §6, tickets #804, #814 and
// #816): a window of a few frames by its median (or its mean once it spans a second), for frames well over budget, and
// a span of seconds by its mean, for a GPU only a little too slow. Pure: `DiveResolutionGovernor` steps on them.

import { DIVE_RESOLUTION_GOVERNOR, DIVE_TARGET_FRAME_MS } from '../constants';
import { HALF } from '../geometry';

/** A frame gap over this is over budget. */
export const SLOW_FRAME_MS = DIVE_TARGET_FRAME_MS * DIVE_RESOLUTION_GOVERNOR.slowFrameRatio;
/** A frame gap past this leaps: no page's own work explains it. */
export const LEAP_FRAME_MS = DIVE_TARGET_FRAME_MS * DIVE_RESOLUTION_GOVERNOR.leapRatio;
/** A span whose mean frame is over this is a little too slow (ticket #816). */
export const SLIGHTLY_SLOW_FRAME_MS = DIVE_TARGET_FRAME_MS * DIVE_RESOLUTION_GOVERNOR.slightlySlowRatio;

/**
 * Whether a window's frames were over budget nearly all of them (`sustainedFastFrames` at most on time): a GPU behind
 * misses every vsync, a busy page now and then (ticket #804's review: scattered 33 ms gaps among 16.7 ms ones on a
 * slow CPU stepped the canvas to the floor while the GPU idled).
 */
function isSustainedOverBudget(gapsMs: readonly number[]): boolean {
  const sorted = [...gapsMs].sort((first, second) => first - second);
  const fastest = sorted[Math.min(DIVE_RESOLUTION_GOVERNOR.sustainedFastFrames, sorted.length - 1)] ?? 0;
  return fastest > SLOW_FRAME_MS;
}

/** The median of a few numbers: the middle one, or the mean of the middle two. */
function medianOf(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const lastIndex = sorted.length - 1;
  return ((sorted[Math.floor(lastIndex * HALF)] ?? 0) + (sorted[Math.ceil(lastIndex * HALF)] ?? 0)) * HALF;
}

export function sumOf(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function meanOf(values: readonly number[]): number {
  return sumOf(values) / values.length;
}

/**
 * Whether a full window spans `windowMs` or more: at most `windowFrames` frames in it, so a mean of a sixth of a second
 * or slower, ten times the target. A GPU seconds behind (software GL) hands frames out in bursts, a few a vsync apart
 * and then a wait of seconds, so their median can be on budget while the dive draws a frame a second (ticket #814). A
 * busy page's slow frames (uploads, a slow CPU's) seldom make a whole second of six frames.
 */
function isFarBehind(gapsMs: readonly number[]): boolean {
  return sumOf(gapsMs) >= DIVE_RESOLUTION_GOVERNOR.windowMs;
}

/** A full window's typical frame and whether it was over budget throughout. */
export interface WindowVerdict {
  readonly gapMs: number;
  readonly cpuMs: number;
  readonly isSustained: boolean;
  /** Only its mean is over budget: its median is on budget, so long stalls among quick frames decide it. */
  readonly isMeanOnly: boolean;
}

/**
 * A window far behind is judged by its mean frame, the GPU's rate through the bursts, and is over budget throughout;
 * any other by its median, so one long task never moves it.
 */
export function windowVerdict(gapsMs: readonly number[], cpusMs: readonly number[]): WindowVerdict {
  const isBehind = isFarBehind(gapsMs);
  const typicalOf = isBehind ? meanOf : medianOf;
  return {
    gapMs: typicalOf(gapsMs),
    cpuMs: typicalOf(cpusMs),
    isSustained: isBehind || isSustainedOverBudget(gapsMs),
    isMeanOnly: isBehind && medianOf(gapsMs) <= SLOW_FRAME_MS,
  };
}

/** A span's mean frame and the mean of the page's own work in it. */
export interface SpanVerdict {
  readonly gapMs: number;
  readonly cpuMs: number;
}

/**
 * The frames of the last `spanMs` (ticket #816). A GPU a little too slow, 40–55 fps, mixes quick and late frames as a
 * busy page does, so no window of six is over budget throughout, and many are not over budget at all; their mean over
 * seconds is. Gaps past the leap are left out of the mean: a stall (the page's, or a GPU seconds behind) is the
 * window's to judge, and one a second would otherwise make a smooth view look slow.
 */
export class DiveFrameSpan {
  private spannedMs = 0;
  private gapsMs = 0;
  private cpusMs = 0;
  private frames = 0;

  /** Whether its frames span `spanMs`. */
  get isFull(): boolean {
    return this.spannedMs >= DIVE_RESOLUTION_GOVERNOR.spanMs;
  }

  add(gapMs: number, cpuMs: number): void {
    this.spannedMs += gapMs;
    if (gapMs > LEAP_FRAME_MS) return;
    this.gapsMs += gapMs;
    this.cpusMs += cpuMs;
    this.frames += 1;
  }

  /** Its verdict, `null` when every frame in it was a stall; the next span starts empty. */
  take(): SpanVerdict | null {
    const verdict = this.frames === 0 ? null : { gapMs: this.gapsMs / this.frames, cpuMs: this.cpusMs / this.frames };
    this.clear();
    return verdict;
  }

  clear(): void {
    this.spannedMs = 0;
    this.gapsMs = 0;
    this.cpusMs = 0;
    this.frames = 0;
  }
}
