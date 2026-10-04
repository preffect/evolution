// The game renderer's clip and fade on the dive (docs/rendering/opening-dive.md §3): while the slime round the dish
// shows, the renderer's root is clipped to the dish's outer wall, so the slime round it stays the slime band's; once
// the view lies inside the dish, the clip lifts. While the dish fades in over the slime (both on the dive's one
// canvas) its fade is a group alpha of its own (`DiveDishFade`), as the canvas's opacity was when the slime had a
// canvas of its own.

import { AlphaFilter, type Container, type Graphics, type Rectangle } from 'pixi.js';
import { hexToNumber } from '../colour';
import { WHITE } from '../constants';
import { HALF } from '../geometry';
import { DIVE_DISH_CLIP_RADIUS_WU } from './dive-bands';
import { diveRendererZoom } from './dive-camera';
import type { DiveView } from './dive-view';

/** Clips `root` to the dish's wall with `clip` while the slime shows; inside the dish, not at all. */
export function clipDiveRendererToDish(root: Container, clip: Graphics, view: DiveView): void {
  clip.clear();
  if (!view.bands.slime.isActive) {
    root.mask = null;
    return;
  }
  const { width, height } = view.camera.viewport;
  const radiusPx = DIVE_DISH_CLIP_RADIUS_WU * diveRendererZoom(view.camera);
  clip.circle(width * HALF, height * HALF, radiusPx).fill(hexToNumber(WHITE));
  root.mask = clip;
}

/**
 * The dish's fade as a group alpha: under 1 the renderer's root draws into a texture of the stage's size first and that
 * is laid at the alpha, so the dish's own layers never show through each other; at 1 it draws straight on.
 */
export class DiveDishFade {
  private readonly filter = new AlphaFilter();

  get alpha(): number {
    return this.filter.alpha;
  }

  /** `root` faded to `alpha` over what lies under it, within `screen`. */
  apply(root: Container, alpha: number, screen?: Rectangle): void {
    const isFiltered = (root.filters as readonly unknown[] | null | undefined)?.[0] === this.filter;
    if (alpha >= 1) {
      if (isFiltered) root.filters = null;
      return;
    }
    this.filter.alpha = alpha;
    if (screen !== undefined) root.filterArea = screen;
    if (!isFiltered) root.filters = [this.filter];
  }

  /** `root` back to drawing straight on, and the filter freed. */
  release(root: Container): void {
    this.apply(root, 1);
    this.filter.destroy();
  }
}
