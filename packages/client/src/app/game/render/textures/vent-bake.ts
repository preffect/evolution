// The thermal vent's fissure (sheet 02 vent table): the heat pool, two basalt crust plates with
// their rims, and the molten seam with its hot core, all rotated with the fissure. Drawn into the
// dish field at the origin; the heat shimmer over it is deferred (RENDERING §6, one filter).

import {
  VENT_CRUST,
  VENT_CRUST_ALPHA,
  VENT_CRUST_PLATE,
  VENT_CRUST_RIM,
  VENT_FISSURE_ROTATION_DEG,
  VENT_FISSURE_SIZE_WU,
  VENT_HEAT_POOL_ALPHA,
  VENT_PLUME,
  VENT_SEAM_ALPHA,
  VENT_SEAM_HOT,
  VENT_SEAM_WIDTH_SHARE,
  ZONE_VENT,
} from '../constants';
import { HALF, degreesToRadians } from '../geometry';
import { fillEllipse, type BakeContext2D } from './texture-bake';

const SIDES = [-1, 1] as const;

interface Fissure {
  readonly centre: number;
  readonly length: number;
  readonly width: number;
  readonly rotation: number;
}

/** Two basalt plates either side of the seam, each with its rim wash. */
function paintCrust(context: BakeContext2D, fissure: Fissure): void {
  const offset = fissure.width * VENT_CRUST_PLATE.offsetShare;
  for (const side of SIDES) {
    const plate = {
      x: fissure.centre + Math.sin(fissure.rotation) * offset * side,
      y: fissure.centre - Math.cos(fissure.rotation) * offset * side,
      radiusX: fissure.length * VENT_CRUST_PLATE.sizeShare,
      radiusY: fissure.width * VENT_CRUST_PLATE.sizeShare * HALF,
      rotation: fissure.rotation,
    };
    fillEllipse(context, plate, { colour: VENT_CRUST, alpha: VENT_CRUST_ALPHA });
    fillEllipse(context, plate, { colour: VENT_CRUST_RIM, alpha: VENT_CRUST_ALPHA * HALF });
  }
}

/** The fissure centred at `centre` px on both axes, at `pxPerWu`: heat pool, crust, seam, hot core. */
export function paintVent(context: BakeContext2D, centre: number, pxPerWu: number): void {
  const fissure: Fissure = {
    centre,
    length: VENT_FISSURE_SIZE_WU.length * pxPerWu,
    width: VENT_FISSURE_SIZE_WU.width * pxPerWu,
    rotation: degreesToRadians(VENT_FISSURE_ROTATION_DEG),
  };
  fillEllipse(
    context,
    { x: centre, y: centre, radiusX: fissure.length, radiusY: fissure.width, rotation: fissure.rotation },
    { colour: VENT_PLUME, alpha: VENT_HEAT_POOL_ALPHA },
  );
  paintCrust(context, fissure);
  const seam = {
    x: centre,
    y: centre,
    radiusX: fissure.length * HALF,
    radiusY: fissure.width * VENT_SEAM_WIDTH_SHARE,
    rotation: fissure.rotation,
  };
  fillEllipse(context, seam, { colour: ZONE_VENT, alpha: VENT_SEAM_ALPHA });
  fillEllipse(
    context,
    { ...seam, radiusX: seam.radiusX * HALF, radiusY: seam.radiusY * HALF },
    { colour: VENT_SEAM_HOT, alpha: 1 },
  );
}
