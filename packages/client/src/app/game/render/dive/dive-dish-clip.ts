// The game renderer's clip and fade on the dive (docs/rendering/opening-dive.md §3): while the slime round the dish
// shows, the renderer's root is clipped to the dish's outer wall, so the slime round it stays the slime band's; once
// the view lies inside the dish, the clip lifts. While the dish fades in over the slime (both on the dive's one
// canvas) its fade is a group alpha of its own (`DiveDishFade`), as the canvas's opacity was when the slime had a
// canvas of its own.

import { AlphaFilter, Rectangle, type Container, type Graphics } from 'pixi.js';
import { hexToNumber } from '../colour';
import { WHITE } from '../constants';
import { HALF } from '../geometry';
import { DIVE_DISH_CLIP_RADIUS_WU } from './dive-bands';
import { diveRendererZoom } from './dive-camera';
import type { DiveView } from './dive-view';

/** The dish's clip in the stage's css px: its centre and radius. */
function dishClipCircle(view: DiveView): { readonly x: number; readonly y: number; readonly radius: number } {
  const { width, height } = view.camera.viewport;
  return { x: width * HALF, y: height * HALF, radius: DIVE_DISH_CLIP_RADIUS_WU * diveRendererZoom(view.camera) };
}

/** Clips `root` to the dish's wall with `clip` while the slime shows; inside the dish, not at all. */
export function clipDiveRendererToDish(root: Container, clip: Graphics, view: DiveView): void {
  clip.clear();
  if (!view.bands.slime.isActive) {
    root.mask = null;
    return;
  }
  const { x, y, radius } = dishClipCircle(view);
  clip.circle(x, y, radius).fill(hexToNumber(WHITE));
  root.mask = clip;
}

/** The box round the dish's clip, within the stage: nothing of the masked dish draws outside it. */
export function dishClipBounds(view: DiveView): Rectangle {
  const { width, height } = view.camera.viewport;
  const { x, y, radius } = dishClipCircle(view);
  const left = Math.max(0, Math.floor(x - radius));
  const top = Math.max(0, Math.floor(y - radius));
  const right = Math.min(width, Math.ceil(x + radius));
  const bottom = Math.min(height, Math.ceil(y + radius));
  return new Rectangle(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

/**
 * The dish's fade as a group alpha: under 1 the renderer's root draws into a texture round the dish first, at the
 * canvas's own resolution (a filter's default is 1×, which drew the dish soft at DPR 2), and that is laid at the alpha,
 * so the dish's own layers never show through each other; at 1 it draws straight on.
 */
export class DiveDishFade {
  private readonly filter = new AlphaFilter({ alpha: 1, resolution: 'inherit' });

  /** The resolution the faded dish is drawn at: the canvas's (`'inherit'`). */
  get resolution(): number | 'inherit' {
    return this.filter.resolution;
  }

  get alpha(): number {
    return this.filter.alpha;
  }

  /** `root` faded to `alpha` over what lies under it, within `area` (css px). */
  apply(root: Container, alpha: number, area?: Rectangle): void {
    const isFiltered = (root.filters as readonly unknown[] | null | undefined)?.[0] === this.filter;
    if (alpha >= 1) {
      if (isFiltered) root.filters = null;
      return;
    }
    this.filter.alpha = alpha;
    if (area !== undefined) root.filterArea = area;
    if (!isFiltered) root.filters = [this.filter];
  }

  /** `root` back to drawing straight on, and the filter freed. */
  release(root: Container): void {
    this.apply(root, 1);
    this.filter.destroy();
  }
}
