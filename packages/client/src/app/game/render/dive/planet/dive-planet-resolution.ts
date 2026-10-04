// The planet's render resolution (docs/rendering/opening-dive.md §4, the mockup's `Globe.resize`): the upper bands'
// ratio, at most 1.5× for the sphere's crisp limb and 1× for the forest under the shore. The upper bands' ratio is
// never more than the dive canvas's, which the dive's resolution governor steps down on a slow GPU (ticket #804); the
// planet's own guard went with it, so two governors never step one frame down twice.

import { DIVE_PLANET_MAX_RATIO } from '../../constants';
import { isDivePlanetPlane } from './dive-planet-frame';

/** The planet's render texels per CSS px at `zoom` over upper bands drawn at `bandsRatio`. */
export function divePlanetRatioAt(zoom: number, bandsRatio: number): number {
  const cap = isDivePlanetPlane(zoom) ? DIVE_PLANET_MAX_RATIO.plane : DIVE_PLANET_MAX_RATIO.sphere;
  return Math.min(bandsRatio, cap);
}
