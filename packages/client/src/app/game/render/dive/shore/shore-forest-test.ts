// Whether the planet shows under the shore (docs/rendering/opening-dive.md §3, the mockup's `glOn` in `drawFrame`):
// while the planet's band is active, far out always; close in only where some of the view lies past the rock band,
// on the planet's forest. The shore lays its own flat forest where it does not. The mockup's canvas ran this test
// until ticket #802; the coast is built for the view only when the test needs it.

import { SHORE_FOREST_TEST, SHORE_ZONE_REACH_M } from '../../constants/dive-shore';
import type { DiveView } from '../dive-view';
import type { ShoreCoast } from './shore-coast';

/** Where the view is measured: its corners, the middles of its edges and its centre, in half views. */
const PROBES: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [0, 0],
];

export class ShoreForestTest {
  constructor(private readonly coast: ShoreCoast) {}

  /** Whether the planet's forest shows at `view`. */
  isShown(view: DiveView): boolean {
    const { bands, camera } = view;
    if (!bands.planet.isActive) return false;
    if (camera.zoom >= SHORE_FOREST_TEST.belowZoom) return true;
    const { halfWidthM, halfHeightM } = camera;
    this.coast.build({ halfWidthM, halfHeightM, pixelsPerMetre: camera.pixelsPerMetre });
    const band = SHORE_ZONE_REACH_M.band;
    const reach = band * SHORE_FOREST_TEST.reachBands + Math.max(halfWidthM, halfHeightM);
    return PROBES.some(([across, down]) => {
      const distance = this.coast.distance(across * halfWidthM, down * halfHeightM, reach);
      return Number.isNaN(distance) || distance > band - SHORE_FOREST_TEST.insetM;
    });
  }
}
