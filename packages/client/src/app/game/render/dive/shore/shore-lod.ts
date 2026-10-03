// The shore band's levels of detail (docs/rendering/opening-dive.md §4, ticket #801): one baked snapshot every
// `SHORE_LOD.stepZoom` of zoom from where the shore fades in down to its cut. Level k is drawn at zoom z_k for its fades
// and detail, over the view at z_k (the widest it serves), at the scale of z_k − step (the finest it serves), so for
// every zoom in (z_k − step, z_k] it covers the view and is only ever shrunk on screen. The next level crossfades in
// over the step, so a fade the mockup runs over a few tenths of zoom never pops.

import { DIVE_ZOOM_BASE } from '../../constants/dive';
import { SHORE_LOD } from '../../constants/dive-shore';
import { HALF } from '../../geometry';
import type { ShoreView } from './shore-paint';

/** A stage size in CSS px. */
export interface StageSize {
  readonly width: number;
  readonly height: number;
}

/** How many levels the band has: from `topZoom` to the first level at or under the cut. */
export const SHORE_LEVEL_COUNT = Math.ceil((SHORE_LOD.topZoom - SHORE_LOD.cutZoom) / SHORE_LOD.stepZoom) + 1;

/** How much larger than the stage a level is drawn: one step of zoom. */
export const SHORE_LEVEL_OVERSIZE = DIVE_ZOOM_BASE ** SHORE_LOD.stepZoom;

/** A tiny share of a step, so a zoom that lands exactly on a level is that level's despite rounding. */
const LEVEL_EPSILON = 1e-9;

/** Level k's own zoom, z_k. */
export function shoreLevelZoom(level: number): number {
  return SHORE_LOD.topZoom - level * SHORE_LOD.stepZoom;
}

/** The level that serves `zoom`: the one with z_k − step < zoom ≤ z_k, within the band's levels. */
export function shoreLevelAt(zoom: number): number {
  const level = Math.floor((SHORE_LOD.topZoom - zoom) / SHORE_LOD.stepZoom + LEVEL_EPSILON);
  return Math.min(SHORE_LEVEL_COUNT - 1, Math.max(0, level));
}

/** How far into its level's step `zoom` lies, 0 at z_k to 1 at the next level: the next level's crossfade. */
export function shoreLevelProgress(zoom: number): number {
  const level = shoreLevelAt(zoom);
  return Math.min(1, Math.max(0, (shoreLevelZoom(level) - zoom) / SHORE_LOD.stepZoom));
}

/** The snapshot ratio for a screen's: the screen's, at most `SHORE_LOD.maxDevicePixelRatio`. */
export function shoreSnapshotRatio(devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, SHORE_LOD.maxDevicePixelRatio);
}

/** The view level k is drawn over, for a stage of `stage` CSS px, at the ambient clock's rest. */
export function shoreLevelView(level: number, stage: StageSize, devicePixelRatio: number): ShoreView {
  const zoom = shoreLevelZoom(level);
  const widthPx = Math.ceil(stage.width * SHORE_LEVEL_OVERSIZE);
  const heightPx = Math.ceil(stage.height * SHORE_LEVEL_OVERSIZE);
  // the stage's width spans 10^z_k metres at one step's oversize
  const pixelsPerMetre = (stage.width * SHORE_LEVEL_OVERSIZE) / DIVE_ZOOM_BASE ** zoom;
  return {
    zoom,
    pixelsPerMetre,
    screenPixelsPerMetre: pixelsPerMetre / SHORE_LEVEL_OVERSIZE,
    widthPx,
    heightPx,
    devicePixelRatio: shoreSnapshotRatio(devicePixelRatio),
    halfWidthM: (widthPx / pixelsPerMetre) * HALF,
    halfHeightM: (heightPx / pixelsPerMetre) * HALF,
    timeSeconds: 0,
  };
}
