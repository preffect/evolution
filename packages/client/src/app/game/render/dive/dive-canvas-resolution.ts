// The dive canvas under the resolution governor (docs/rendering/opening-dive.md §6, ticket #804): the session's side of
// `DiveResolutionGovernor`, which times each frame's own work and sets the canvas when the governor answers a new
// resolution.

import type { Clock } from '@evolution/shared';
import { DiveResolutionGovernor } from './dive-resolution-governor';
import { upperBandsDevicePixelRatio } from './dive-view';

/** What the dive canvas's governor needs from the session. */
export interface DiveCanvasResolutionParts {
  /** The dive's own device pixel ratio, the most the canvas renders at. */
  readonly top: number;
  readonly clock: Clock;
  /** The last frame's time handing work to the GPU (`DiveFrameTimes.lastFrameIssueMs`), which a GPU behind blocks. */
  readonly issueMs: () => number;
  /** Every bake has landed and the renderer is built: until then the bakes' slices slow the frames, not the GPU. */
  readonly isSettled: () => boolean;
  /** Sets the canvas's resolution (`PixiAppHandle.setResolution`). */
  readonly setResolution: (resolution: number) => void;
}

/**
 * A frame as the session reports it: its start, whether the dive falls (the canvas then renders at most at the upper
 * bands' ratio, the mockup's `DIVE_DPR`), and whether it draws (a still dive under reduced motion does not).
 */
export interface DiveCanvasFrame {
  readonly nowMs: number;
  readonly isMoving: boolean;
  readonly isDrawn: boolean;
}

/**
 * The dive canvas under the governor: it times each animation frame's own work (less its time handing work to the
 * GPU), hears each frame, and sets the canvas only when the resolution changes.
 */
export class DiveCanvasResolution {
  private readonly governor: DiveResolutionGovernor;
  /** What the canvas renders at: it opens at the dive's ratio. */
  private applied: number;
  private frameWorkMs = 0;

  constructor(private readonly parts: DiveCanvasResolutionParts) {
    this.governor = new DiveResolutionGovernor(parts.top);
    this.applied = parts.top;
  }

  get resolution(): number {
    return this.applied;
  }

  interrupt(): void {
    this.governor.interrupt();
  }

  /** Runs one animation frame's work and keeps its own share of it for the next frame's judgement. */
  timeFrame(work: () => void): void {
    const startedMs = this.parts.clock.nowMilliseconds();
    work();
    this.frameWorkMs = Math.max(0, this.parts.clock.nowMilliseconds() - startedMs - this.parts.issueMs());
  }

  noteFrame(frame: DiveCanvasFrame): void {
    this.governor.noteFrame({
      nowMs: frame.nowMs,
      cpuMs: this.frameWorkMs,
      ceiling: upperBandsDevicePixelRatio(this.parts.top, frame.isMoving),
      isJudged: frame.isDrawn && this.parts.isSettled(),
    });
    if (this.governor.resolution === this.applied) return;
    this.applied = this.governor.resolution;
    this.parts.setResolution(this.applied);
  }
}
