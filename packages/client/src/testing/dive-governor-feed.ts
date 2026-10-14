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
/** A GPU's work that ends a hair past a vsync, in floating point, still shows on it. */
const VSYNC_ROUNDING = 1e-9;

/** A frame's gap: a fixed one, or one that follows the resolution it was drawn at. */
export type FrameGap = number | ((resolution: number) => number);

/** A GPU-bound frame: `fullMs` at the dive's ratio `top`, its cost going with the pixels. */
export function gpuBound(fullMs: number, top = 1): (resolution: number) => number {
  return (resolution) => {
    const scale = resolution / top;
    return fullMs * scale * scale;
  };
}

/**
 * A GPU a little too slow behind the display's vsync (ticket #816): it works on one frame while the last is shown, and
 * each frame shows at the first vsync after its work (`gpuBound`), so the gaps mix 16.7 ms and 33 ms ones at a mean of
 * the GPU's frame. Under the vsync, every frame shows one vsync after the last.
 */
export function vsyncPaced(fullMs: number, top = 1): (resolution: number) => number {
  const gpuMs = gpuBound(fullMs, top);
  let doneMs = 0;
  let shownMs = 0;
  return (resolution) => {
    doneMs = Math.max(doneMs, shownMs - SMOOTH_MS) + gpuMs(resolution);
    const nextShownMs = Math.max(shownMs + SMOOTH_MS, Math.ceil(doneMs / SMOOTH_MS - VSYNC_ROUNDING) * SMOOTH_MS);
    const gapMs = nextShownMs - shownMs;
    shownMs = nextShownMs;
    return gapMs;
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

  /**
   * `count` frames `gapMs` apart, each with `cpuMs` of CPU work and `bakeMs` of bake slices in its gap; answers the
   * resolution after them.
   */
  frames(
    count: number,
    gap: FrameGap,
    options: { cpuMs?: number; bakeMs?: number; ceiling?: number; isJudged?: boolean } = {},
  ): number {
    for (let frame = 0; frame < count; frame += 1) {
      this.nowMs += typeof gap === 'number' ? gap : gap(this.governor.resolution);
      const hasChanged = this.governor.noteFrame({
        nowMs: this.nowMs,
        cpuMs: options.cpuMs ?? 0,
        ceiling: options.ceiling ?? this.ceiling,
        bakeMs: options.bakeMs ?? 0,
        isJudged: options.isJudged ?? true,
      });
      if (hasChanged) this.changes.push(this.governor.resolution);
    }
    return this.governor.resolution;
  }

  /** Frames `gap` apart until the resolution changes or `limitMs` passes; answers how long that took. */
  untilChange(gap: FrameGap, limitMs: number): number {
    const startedMs = this.nowMs;
    const before = this.governor.resolution;
    while (this.governor.resolution === before && this.nowMs - startedMs < limitMs) this.frames(1, gap);
    return this.nowMs - startedMs;
  }

  /** Smooth frames until the resolution changes or `limitMs` passes; answers how long that took. */
  smoothUntilChange(limitMs: number): number {
    return this.untilChange(SMOOTH_MS, limitMs);
  }
}

export function governorFeed(top: number, ceiling = top): FrameFeed {
  return new FrameFeed(new DiveResolutionGovernor(top), ceiling);
}
