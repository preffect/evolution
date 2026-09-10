// Camera (docs/GAME-DESIGN.md §7, §12). Read by the client only, but gameplay-visible, so it is
// a design constant here and not a render constant (docs/CODE-STANDARDS.md §2).

/** Half the view height in cell radii. */
export const CAMERA_VIEW_RADII = 12;
/** Zoom-in limit (wu). */
export const CAMERA_MIN_VIEW_HALF_HEIGHT_WU = 300;
/** Zoom-out limit (wu). */
export const CAMERA_MAX_VIEW_HALF_HEIGHT_WU = 1500;
/** Position smoothing time constant (s). */
export const CAMERA_FOLLOW_SECONDS = 0.08;
/** Zoom smoothing time constant (s). */
export const CAMERA_ZOOM_SECONDS = 0.6;
