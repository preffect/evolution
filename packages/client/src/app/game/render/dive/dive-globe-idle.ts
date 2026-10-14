// The planet's idle turn on the dive (docs/rendering/opening-dive.md §2, ticket #805): how long the dive has waited
// in orbit, its planet turning on its own, and so how far it has turned (`diveGlobeIdleSpin`). The session advances it
// once a frame on the injected clock.

import { DIVE_GLOBE_TURN_START_ZOOM } from '../constants';
import { diveGlobeIdleSpin } from './dive-camera';

export interface DiveGlobeIdleFrame {
  readonly nowMs: number;
  readonly zoom: number;
  readonly isMotionReduced: boolean;
  readonly isPaused: boolean;
}

export class DiveGlobeIdle {
  private idleMs = 0;
  private lastAdvancedAtMs: number | null = null;

  /**
   * The planet turns while the dive is in orbit above the opening turn: through the wait for the autoplay and the
   * hold before the fall, never while paused or under reduced motion.
   */
  advance(frame: DiveGlobeIdleFrame): void {
    const sinceLastMs = this.lastAdvancedAtMs === null ? 0 : frame.nowMs - this.lastAdvancedAtMs;
    this.lastAdvancedAtMs = frame.nowMs;
    if (frame.isMotionReduced || frame.isPaused || frame.zoom < DIVE_GLOBE_TURN_START_ZOOM) return;
    this.idleMs += sinceLastMs;
  }

  /** How far the planet has turned on its own, in degrees of longitude. */
  get spinDegrees(): number {
    return diveGlobeIdleSpin(this.idleMs);
  }
}
