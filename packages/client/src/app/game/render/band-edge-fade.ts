// The drawn band's edge fades (#684, docs/rendering/budget.md §6): on a canvas wider than the interest aspect the
// band's stencil cuts every layer above the field with a straight vertical line, which read as a glitch where a cell
// or a ring straddled it. Two screen-space sprites of the `BAND_EDGE_FADE_BAKE` ramp sit over the band's edges,
// clear towards the middle, the field colour at the edge and feathered out over the field beyond it, so what the clip
// cuts has already faded out.
// They sit in the screen root under the vignette and batch into its draw call; a canvas no wider than the interest
// aspect hides them.

import { Sprite, type Texture } from 'pixi.js';
import type { ViewportPx } from './camera';
import { drawnWidthPx } from './camera';
import { BAND_EDGE_FADE_EDGE_STOP, BAND_EDGE_FADE_WIDTH_VIEW_FRACTION } from './constants';
import { HALF } from './geometry';

export interface BandEdgeFades {
  /** Mirrored: its ramp runs from the band's left edge inwards. */
  readonly left: Sprite;
  readonly right: Sprite;
}

export function createBandEdgeFades(texture: Texture): BandEdgeFades {
  return { left: new Sprite(texture), right: new Sprite(texture) };
}

/**
 * Places both fades over the band's edges for `viewport`, their `BAND_EDGE_FADE_EDGE_STOP` on the edge, or hides them
 * while the band spans the canvas.
 */
export function applyBandEdgeFades(fades: BandEdgeFades, viewport: ViewportPx): void {
  const bandWidth = drawnWidthPx(viewport);
  const isClipped = bandWidth < viewport.width;
  fades.left.visible = isClipped;
  fades.right.visible = isClipped;
  if (!isClipped) return;
  const fadeWidth = BAND_EDGE_FADE_WIDTH_VIEW_FRACTION * viewport.height;
  const insideWidth = BAND_EDGE_FADE_EDGE_STOP * fadeWidth;
  const bandLeft = (viewport.width - bandWidth) * HALF;
  const bandRight = bandLeft + bandWidth;
  const scaleY = viewport.height / fades.right.texture.height;
  const scaleX = fadeWidth / fades.right.texture.width;
  fades.right.position.set(bandRight - insideWidth, 0);
  fades.right.scale.set(scaleX, scaleY);
  fades.left.position.set(bandLeft + insideWidth, 0);
  fades.left.scale.set(-scaleX, scaleY);
}
