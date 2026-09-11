// The thermal vent's fissure (sheet 02 vent table): the heat pool, two basalt crust plates with
// their rims, and the molten seam with its hot core, all rotated with the fissure. Drawn into the
// dish field; the shimmer filter runs over the vent sprite at play time.

import {
  VENT_CRUST,
  VENT_CRUST_ALPHA,
  VENT_CRUST_RIM,
  VENT_FISSURE_ROTATION_DEG,
  VENT_FISSURE_SIZE_WU,
  VENT_HEAT_POOL_ALPHA,
  VENT_PLUME,
  VENT_SEAM_ALPHA,
  VENT_SEAM_HOT,
  ZONE_VENT,
} from '../constants';
import { degreesToRadians } from '../geometry';
import { fillEllipse, type BakeContext2D } from './texture-bake';

const HALF = 0.5;
const SEAM_WIDTH_SHARE = 0.16;
const CRUST_OFFSET_SHARE = 0.32;
const CRUST_SIZE_SHARE = 0.5;
const SIDES = [-1, 1] as const;

function paintCrust(context: BakeContext2D, centre: number, length: number, width: number): void {
  const rotation = degreesToRadians(VENT_FISSURE_ROTATION_DEG);
  const crustOffset = width * CRUST_OFFSET_SHARE;
  for (const side of SIDES) {
    const plate = {
      x: centre + Math.sin(rotation) * crustOffset * side,
      y: centre - Math.cos(rotation) * crustOffset * side,
      radiusX: length * CRUST_SIZE_SHARE,
      radiusY: width * CRUST_SIZE_SHARE * HALF,
      rotation,
    };
    fillEllipse(context, plate, { colour: VENT_CRUST, alpha: VENT_CRUST_ALPHA });
    fillEllipse(context, plate, { colour: VENT_CRUST_RIM, alpha: VENT_CRUST_ALPHA * HALF });
  }
}

export function paintVent(context: BakeContext2D, centre: number, pxPerWu: number): void {
  const rotation = degreesToRadians(VENT_FISSURE_ROTATION_DEG);
  const length = VENT_FISSURE_SIZE_WU.length * pxPerWu;
  const width = VENT_FISSURE_SIZE_WU.width * pxPerWu;
  fillEllipse(
    context,
    { x: centre, y: centre, radiusX: length, radiusY: width, rotation },
    { colour: VENT_PLUME, alpha: VENT_HEAT_POOL_ALPHA },
  );
  paintCrust(context, centre, length, width);
  const seam = { x: centre, y: centre, radiusX: length * HALF, radiusY: width * SEAM_WIDTH_SHARE, rotation };
  fillEllipse(context, seam, { colour: ZONE_VENT, alpha: VENT_SEAM_ALPHA });
  fillEllipse(
    context,
    { ...seam, radiusX: seam.radiusX * HALF, radiusY: seam.radiusY * HALF },
    { colour: VENT_SEAM_HOT, alpha: 1 },
  );
}
