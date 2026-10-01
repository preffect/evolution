// The game renderer's clip on the dive (docs/rendering/opening-dive.md §3): while the slime round the dish shows,
// the renderer's root is clipped to the dish's outer wall, so the slime round it stays the mockup's; once the view
// lies inside the dish, the clip lifts.

import type { Container, Graphics } from 'pixi.js';
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
