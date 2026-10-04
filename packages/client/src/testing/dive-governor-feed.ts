// The dive's resolution governor's spec harness (docs/rendering/opening-dive.md §6, ticket #804): frames fed to a
// governor on a clock of its own, a fixed gap apart or as far apart as the resolution makes them.

import { DIVE_TARGET_FRAME_MS } from '../app/game/render/constants';
import { DiveResolutionGovernor } from '../app/game/render/dive/dive-resolution-governor';

/** Smooth frames: one display frame at 60 Hz. */
export const SMOOTH_MS = DIVE_TARGET_FRAME_MS;
/** A frame a little over budget: one notch is enough for it. */
export const SLOW_MS = 22.5;
/** The drop's lens under software GL at zoom −2.3 (ticket #804's hand-off). */
export const SOFTWARE_LENS_MS = 550;

/** A frame's gap: a fixed one, or one that follows the resolution it was drawn at. */
export type FrameGap = number | ((resolution: number) => number);

/** A GPU-bound frame: `fullMs` at the dive's ratio `top`, its cost going with the pixels. */
export function gpuBound(fullMs: number, top = 1): (resolution: number) => number {
  return (resolution) => {
    const scale = resolution / top;
    return fullMs * scale * scale;
  };
}

/** Feeds frames to a governor on a clock of its own; every frame is judged unless a test says otherwise. */
export class FrameFeed {
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

export function governorFeed(top: number, ceiling = top): FrameFeed {
  return new FrameFeed(new DiveResolutionGovernor(top), ceiling);
}
