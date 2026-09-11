// The glow atlas (docs/RENDERING.md §6, docs/ASSET-GENERATION.md §1.5): white radial sprites the
// effects and the fragments tint at use: a glow (core + soft + wide), a thin ring, a soft ray and
// a soft disc. Baked once at startup.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  GLOW_LAYERS,
  GLOW_LAYER_ALPHAS,
  GLOW_TEXTURE_PX,
  RAY_TEXTURE_PX,
  RING_TEXTURE_PX,
  RING_WIDTH_FRACTION,
  WHITE,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { fillHalo, fillRadial, type BakeCanvas, type BakeCanvasFactory } from './texture-bake';

export const GLOW_SPRITE = { glow: 'glow', ring: 'ring', ray: 'ray', disc: 'disc' } as const;
export type GlowSpriteKey = (typeof GLOW_SPRITE)[keyof typeof GLOW_SPRITE];

export type GlowAtlas = Readonly<Record<GlowSpriteKey, BakeCanvas>>;

const HALF = 0.5;
const RAY_TIP_ALPHA = 0.9;
const RAY_STOPS = 3;
/** The ring's soft edge on each side, as a share of the radius. */
const RING_EDGES = 2;

function bakeGlow(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(GLOW_TEXTURE_PX, GLOW_TEXTURE_PX);
  const centre = GLOW_TEXTURE_PX * HALF;
  const disc = { x: centre, y: centre, radius: centre };
  fillHalo(
    canvas.context,
    { ...disc, radius: centre * GLOW_LAYERS.wide },
    { colour: WHITE, alpha: GLOW_LAYER_ALPHAS.wide },
  );
  fillHalo(
    canvas.context,
    { ...disc, radius: centre * GLOW_LAYERS.soft },
    { colour: WHITE, alpha: GLOW_LAYER_ALPHAS.soft },
  );
  fillHalo(
    canvas.context,
    { ...disc, radius: centre * GLOW_LAYERS.core },
    { colour: WHITE, alpha: GLOW_LAYER_ALPHAS.core },
  );
  return canvas;
}

function bakeDisc(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(GLOW_TEXTURE_PX, GLOW_TEXTURE_PX);
  const centre = GLOW_TEXTURE_PX * HALF;
  fillRadial(canvas.context, { x: centre, y: centre, radius: centre }, [
    { offset: 0, colour: WHITE, alpha: 1 },
    { offset: 1 - GLOW_LAYERS.core, colour: WHITE, alpha: 1 },
    { offset: 1, colour: WHITE, alpha: 0 },
  ]);
  return canvas;
}

/** A ring of `RING_WIDTH_FRACTION` of the radius, soft on both sides. */
function bakeRing(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(RING_TEXTURE_PX, RING_TEXTURE_PX);
  const centre = RING_TEXTURE_PX * HALF;
  const inner = 1 - RING_WIDTH_FRACTION * RING_EDGES;
  fillRadial(canvas.context, { x: centre, y: centre, radius: centre }, [
    { offset: inner, colour: WHITE, alpha: 0 },
    { offset: 1 - RING_WIDTH_FRACTION, colour: WHITE, alpha: 1 },
    { offset: 1, colour: WHITE, alpha: 0 },
  ]);
  return canvas;
}

/** A vertical ray: bright at the base, fading to the tip, feathered across. */
function bakeRay(factory: BakeCanvasFactory): BakeCanvas {
  const canvas = factory.create(RAY_TEXTURE_PX.width, RAY_TEXTURE_PX.height);
  const { context } = canvas;
  const gradient = context.createLinearGradient(0, RAY_TEXTURE_PX.height, 0, 0);
  for (let stop = 0; stop <= RAY_STOPS; stop += 1) {
    const share = stop / RAY_STOPS;
    gradient.addColorStop(share, hexWithAlpha(WHITE, RAY_TIP_ALPHA * (1 - share)));
  }
  context.fillStyle = gradient;
  context.beginPath();
  const halfWidth = RAY_TEXTURE_PX.width * HALF;
  const halfHeight = RAY_TEXTURE_PX.height * HALF;
  context.ellipse(halfWidth, halfHeight, halfWidth, halfHeight, 0, 0, RADIANS_PER_FULL_TURN);
  context.fill();
  return canvas;
}

export function bakeGlowAtlas(factory: BakeCanvasFactory): GlowAtlas {
  return {
    [GLOW_SPRITE.glow]: bakeGlow(factory),
    [GLOW_SPRITE.ring]: bakeRing(factory),
    [GLOW_SPRITE.ray]: bakeRay(factory),
    [GLOW_SPRITE.disc]: bakeDisc(factory),
  };
}
