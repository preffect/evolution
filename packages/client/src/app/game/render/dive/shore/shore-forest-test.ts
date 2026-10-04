// Whether the planet shows under the shore (docs/rendering/opening-dive.md §3, the mockup's `glOn` in `drawFrame`):
// while the planet's band is active, far out always; close in only where some of the view lies past the rock band,
// on the planet's forest. The shore lays its own flat forest where it does not. The mockup's canvas ran this test
// until ticket #802, building the coast every frame; here the coast is built only when the test needs it, once per
// step of zoom, for the step's widest view, so a fall builds it a few times rather than on every frame.

import { DIVE_ZOOM_BASE } from '../../constants/dive';
import { SHORE_FOREST_TEST, SHORE_ZONE_REACH_M } from '../../constants/dive-shore';
import type { DiveCamera } from '../dive-camera';
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

/** Decimals a step's zoom is keyed by. */
const DIGITS = 3;

export class ShoreForestTest {
  /** The step and the stage the coast was last built for; `null` before the first build. */
  private builtFor: string | null = null;
  /** How many times the coast has been built: for the specs. */
  builds = 0;

  constructor(private readonly coast: ShoreCoast) {}

  /** Builds the coast for the widest view of the camera's step of zoom, unless it already was. */
  private buildFor(camera: DiveCamera): void {
    const stepZoom = SHORE_FOREST_TEST.rebuildStepZoom;
    const topZoom = Math.ceil(camera.zoom / stepZoom) * stepZoom;
    const key = `${topZoom.toFixed(DIGITS)}:${camera.viewport.width}x${camera.viewport.height}`;
    if (key === this.builtFor) return;
    const widen = DIVE_ZOOM_BASE ** (topZoom - camera.zoom);
    this.coast.build({
      halfWidthM: camera.halfWidthM * widen,
      halfHeightM: camera.halfHeightM * widen,
      pixelsPerMetre: camera.pixelsPerMetre / widen,
    });
    this.builtFor = key;
    this.builds += 1;
  }

  /** Whether the planet's forest shows at `view`. */
  isShown(view: DiveView): boolean {
    const { bands, camera } = view;
    if (!bands.planet.isActive) return false;
    if (camera.zoom >= SHORE_FOREST_TEST.belowZoom) return true;
    const { halfWidthM, halfHeightM } = camera;
    this.buildFor(camera);
    const band = SHORE_ZONE_REACH_M.band;
    const reach = band * SHORE_FOREST_TEST.reachBands + Math.max(halfWidthM, halfHeightM);
    return PROBES.some(([across, down]) => {
      const distance = this.coast.distance(across * halfWidthM, down * halfHeightM, reach);
      return Number.isNaN(distance) || distance > band - SHORE_FOREST_TEST.insetM;
    });
  }
}
