// A viewer's interest area (docs/architecture/wire-contract.md §4.2 lever 1): the world rectangle whose food and DNA
// fragments that viewer is sent. Each camera state covers its view at `INTEREST_VIEW_ASPECT_RATIO` grown by the room's
// margin (`interestMarginFor(balance)`), and the area is the box around every recent state, because the client draws
// behind the newest snapshot. Pure.

import { INTEREST_VIEW_ASPECT_RATIO, type CameraState } from '@evolution/shared';

/** A world-space rectangle (wu), edges inclusive. */
export interface InterestArea {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** One camera state's view at the widest covered aspect, grown by `marginWu` on every side. */
export function viewAreaOf(camera: CameraState, marginWu: number): InterestArea {
  const halfHeight = camera.viewHalfHeightWu + marginWu;
  const halfWidth = camera.viewHalfHeightWu * INTEREST_VIEW_ASPECT_RATIO + marginWu;
  return {
    minX: camera.x - halfWidth,
    minY: camera.y - halfHeight,
    maxX: camera.x + halfWidth,
    maxY: camera.y + halfHeight,
  };
}

/** The box around the views of every camera state: the newest and the ones the client may still be drawing. */
export function interestAreaOf(cameras: readonly [CameraState, ...CameraState[]], marginWu: number): InterestArea {
  return cameras
    .map((camera) => viewAreaOf(camera, marginWu))
    .reduce((union, area) => ({
      minX: Math.min(union.minX, area.minX),
      minY: Math.min(union.minY, area.minY),
      maxX: Math.max(union.maxX, area.maxX),
      maxY: Math.max(union.maxY, area.maxY),
    }));
}

/** The cull predicate: whether a point is inside the area. */
export function isInInterestArea(area: InterestArea, x: number, y: number): boolean {
  return x >= area.minX && x <= area.maxX && y >= area.minY && y <= area.maxY;
}
