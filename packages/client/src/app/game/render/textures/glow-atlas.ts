// The glow atlas (docs/RENDERING.md §6, docs/ASSET-GENERATION.md §1.5): white radial sprites the
// effects and the fragments tint at use: a glow (core + soft + wide + glint), a thin ring and a soft ray.
// The soft disc the depth particles tint is slice A's `SOFT_DISC_BAKE` (render-textures.ts).

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { hexWithAlpha } from '../colour';
import {
  GLOW_LAYERS,
  GLOW_LAYER_ALPHAS,
  GLOW_TEXTURE_PX,
  RAY_BASE_ALPHA,
  RAY_GRADIENT_STOPS,
  RAY_TEXTURE_PX,
  RING_INNER_FEATHER_WIDTHS,
  RING_TEXTURE_PX,
  RING_WIDTH_FRACTION,
  WHITE,
} from '../constants';
import { HALF } from '../geometry';
import { fillHalo, fillRadial, type BakeCanvas, type BakeCanvasFactory } from './texture-bake';

export const GLOW_SPRITE = { glow: 'glow', ring: 'ring', ray: 'ray' } as const;
export type GlowSpriteKey = (typeof GLOW_SPRITE)[keyof typeof GLOW_SPRITE];

export type GlowAtlasBakes = Readonly<Record<GlowSpriteKey, BakeCanvas>>;

/** Wide under soft under core, then the glint toward the light: the §1.5 layers in the same white. */
function bakeGlow(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(GLOW_TEXTURE_PX, GLOW_TEXTURE_PX);
  const centre = GLOW_TEXTURE_PX * HALF;
  const layers = [
    { reach: GLOW_LAYERS.wide, alpha: GLOW_LAYER_ALPHAS.wide },
    { reach: GLOW_LAYERS.soft, alpha: GLOW_LAYER_ALPHAS.soft },
    { reach: GLOW_LAYERS.core, alpha: GLOW_LAYER_ALPHAS.core },
  ];
  for (const layer of layers) {
    fillHalo(
      canvas.context,
      { x: centre, y: centre, radius: centre * layer.reach },
      { colour: WHITE, alpha: layer.alpha },
    );
  }
  const glint = centre * GLOW_LAYERS.glintOffset;
  fillHalo(
    canvas.context,
    { x: centre + glint, y: centre + glint, radius: centre * GLOW_LAYERS.glintRadius },
    { colour: WHITE, alpha: GLOW_LAYER_ALPHAS.glint },
  );
  return canvas;
}

/** A ring of `RING_WIDTH_FRACTION` of the radius, feathered on both sides. */
function bakeRing(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(RING_TEXTURE_PX, RING_TEXTURE_PX);
  const centre = RING_TEXTURE_PX * HALF;
  const inner = 1 - RING_WIDTH_FRACTION * RING_INNER_FEATHER_WIDTHS;
  fillRadial(canvas.context, { x: centre, y: centre, radius: centre }, [
    { offset: inner, colour: WHITE, alpha: 0 },
    { offset: 1 - RING_WIDTH_FRACTION, colour: WHITE, alpha: 1 },
    { offset: 1, colour: WHITE, alpha: 0 },
  ]);
  return canvas;
}

/** A vertical ray: brightest at the base (the bottom), fading to the tip, feathered across as an ellipse. */
function bakeRay(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(RAY_TEXTURE_PX.width, RAY_TEXTURE_PX.height);
  const { context } = canvas;
  const gradient = context.createLinearGradient(0, RAY_TEXTURE_PX.height, 0, 0);
  for (let stop = 0; stop <= RAY_GRADIENT_STOPS; stop += 1) {
    const share = stop / RAY_GRADIENT_STOPS;
    gradient.addColorStop(share, hexWithAlpha(WHITE, RAY_BASE_ALPHA * (1 - share)));
  }
  context.fillStyle = gradient;
  context.beginPath();
  const halfWidth = RAY_TEXTURE_PX.width * HALF;
  const halfHeight = RAY_TEXTURE_PX.height * HALF;
  context.ellipse(halfWidth, halfHeight, halfWidth, halfHeight, 0, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  return canvas;
}

export function bakeGlowAtlas(factory: BakeCanvasFactory): GlowAtlasBakes {
  return {
    [GLOW_SPRITE.glow]: bakeGlow(factory),
    [GLOW_SPRITE.ring]: bakeRing(factory),
    [GLOW_SPRITE.ray]: bakeRay(factory),
  };
}
