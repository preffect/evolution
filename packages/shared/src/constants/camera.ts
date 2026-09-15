// Camera (docs/game-design/controls-and-scope.md §7, docs/game-design/constants-and-acceptance.md §12). Read by the client only, but gameplay-visible, so it is
// a design constant here and not a render constant (docs/CODE-STANDARDS.md §2).

/**
 * How the view grows with the followed cell's radius: `(radius / spawnRadius) ^ this` times the zoom-in limit.
 * 0.5 is decision #324's Z1 partial zoom (the view grows with √radius, so the cell grows on screen); 1 would be a
 * size lock, 0 no zoom at all.
 */
export const CAMERA_VIEW_RADIUS_EXPONENT = 0.5;
/** Zoom-in limit (wu). */
export const CAMERA_MIN_VIEW_HALF_HEIGHT_WU = 300;
/** Zoom-out limit (wu). */
export const CAMERA_MAX_VIEW_HALF_HEIGHT_WU = 1500;
/** Position smoothing time constant (s). */
export const CAMERA_FOLLOW_SECONDS = 0.08;
/** Zoom smoothing time constant (s). */
export const CAMERA_ZOOM_SECONDS = 0.6;
