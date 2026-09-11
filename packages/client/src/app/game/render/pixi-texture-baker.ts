// The Pixi `TextureBaker` (docs/RENDERING.md §6): a radial bake spec becomes a Graphics with a
// radial `FillGradient` over its own bounds, rendered once to a texture. The only file that turns
// a bake into a Pixi texture in slice A; slice B (#206) adds the Canvas-2D path beside it.

import { FillGradient, Graphics, type Container, type Texture } from 'pixi.js';
import { hexWithAlpha } from './colour';
import { HALF } from './geometry';
import { RADIAL_BAKE_SHAPE, type RadialBakeSpec, type TextureBaker } from './render-textures';

/** The slice of a Pixi renderer the baker needs: `Renderer.generateTexture` satisfies it. */
export interface TextureGenerator {
  generateTexture(target: Container): Texture;
}

const UNIT_SQUARE_CENTRE = { x: HALF, y: HALF } as const;
/** A gradient in the shape's local (0..1) space reaches the corners at this radius. */
const HALF_DIAGONAL = HALF * Math.SQRT2;

function radialGradient(spec: RadialBakeSpec): FillGradient {
  return new FillGradient({
    type: 'radial',
    center: UNIT_SQUARE_CENTRE,
    innerRadius: 0,
    outerCenter: UNIT_SQUARE_CENTRE,
    outerRadius: HALF_DIAGONAL,
    colorStops: spec.stops.map((stop) => ({ offset: stop.offset, color: hexWithAlpha(spec.colour, stop.alpha) })),
  });
}

function bakeShape(spec: RadialBakeSpec): Graphics {
  const graphics = new Graphics();
  if (spec.shape === RADIAL_BAKE_SHAPE.disc) {
    const radius = spec.sizePx * HALF;
    graphics.circle(radius, radius, radius);
  } else {
    graphics.rect(0, 0, spec.sizePx, spec.sizePx);
  }
  return graphics.fill(radialGradient(spec));
}

export function createPixiTextureBaker(generator: TextureGenerator): TextureBaker {
  return {
    bakeRadial(spec) {
      const graphics = bakeShape(spec);
      const texture = generator.generateTexture(graphics);
      graphics.destroy();
      return texture;
    },
  };
}
