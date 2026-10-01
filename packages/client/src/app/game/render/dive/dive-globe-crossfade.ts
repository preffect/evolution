// The planet's crossfade on the dive (docs/rendering/opening-dive.md §4, ticket #805): until the world's coastline bake
// lands, the upper bands draw the flat fallback globe; when it lands, the full planet (its stars, rim and clouds) comes
// up over it across `DIVE_GLOBE_CROSSFADE_MS` instead of in one frame. The session asks once a frame, on its clock.

import { DIVE_GLOBE_CROSSFADE_MS } from '../constants';
import { clamp01 } from '../geometry';

export interface DiveGlobeCrossfadeFrame {
  readonly nowMs: number;
  /** The baked planet can draw (the world's coastline bake has landed). */
  readonly isPlanetReady: boolean;
  readonly isMotionReduced: boolean;
}

/** Fully the fallback globe: the planet's opacity while it has not baked. */
const FALLBACK_ONLY = 0;
/** Fully the planet. */
const PLANET_ONLY = 1;

export class DiveGlobeCrossfade {
  /** This open drew the fallback globe, so the planet fades in over it when it lands. */
  private hasShownFallback = false;
  private planetShownAtMs: number | null = null;

  /**
   * The planet's opacity over the fallback globe this frame: 0 while it bakes, then rising to 1 across the crossfade
   * from the first frame it can draw. A planet that was ready from the first frame (its bake kept from an earlier open)
   * is 1 at once, as it is under reduced motion, where a still dive draws only when something changed.
   */
  alphaAt(frame: DiveGlobeCrossfadeFrame): number {
    if (!frame.isPlanetReady) {
      this.hasShownFallback = true;
      return FALLBACK_ONLY;
    }
    if (!this.hasShownFallback || frame.isMotionReduced) return PLANET_ONLY;
    this.planetShownAtMs ??= frame.nowMs;
    const alpha = clamp01((frame.nowMs - this.planetShownAtMs) / DIVE_GLOBE_CROSSFADE_MS);
    if (alpha >= PLANET_ONLY) this.hasShownFallback = false;
    return alpha;
  }
}
