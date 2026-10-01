// The planet's render resolution (docs/rendering/opening-dive.md §4, the mockup's `Globe.resize` and its guard): the
// upper bands' ratio, at most 1.5× for the sphere's crisp limb and 1× for the forest under the shore, times a quality
// that steps down when frames keep coming slowly on a weak GPU. It never steps back up within an open.

import { DIVE_PLANET_MAX_RATIO, DIVE_PLANET_RESOLUTION_GUARD } from '../../constants';
import { isDivePlanetPlane } from './dive-planet-frame';

export class DivePlanetResolution {
  private quality = 1;
  private strikes = 0;
  private lastFrameMs: number | null = null;

  /** Notes a frame drawn at `nowMs`: one that came slowly after the last adds a strike, a quick one takes one off. */
  noteFrame(nowMs: number): void {
    const guard = DIVE_PLANET_RESOLUTION_GUARD;
    const last = this.lastFrameMs;
    this.lastFrameMs = nowMs;
    if (last === null || nowMs - last >= guard.sampleWindowMs) return;
    this.strikes = nowMs - last > guard.slowFrameMs ? this.strikes + 1 : Math.max(0, this.strikes - 1);
    if (this.strikes > guard.strikesToStep && this.quality > guard.floor) {
      this.quality *= guard.step;
      this.strikes = 0;
    }
  }

  /** The planet's render texels per CSS px at `zoom` over upper bands drawn at `bandsRatio`. */
  ratioAt(zoom: number, bandsRatio: number): number {
    const cap = isDivePlanetPlane(zoom) ? DIVE_PLANET_MAX_RATIO.plane : DIVE_PLANET_MAX_RATIO.sphere;
    return Math.min(bandsRatio, cap) * this.quality;
  }
}
