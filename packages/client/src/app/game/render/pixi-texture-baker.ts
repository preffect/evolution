// The Pixi `TextureBaker` (docs/RENDERING.md §6): a radial bake spec is sampled per pixel into
// premultiplied bytes (`textures/radial-bake.ts`) and uploaded as a sprite texture; a Canvas-2D bake
// comes from the canvas factory it wraps and becomes a texture through `textures/pixi-textures.ts`.
// Not Pixi's `FillGradient`: its radial build floods the gradient canvas with the last stop before
// painting, so a bake that is clear at the centre (the vignette) came out at its edge alpha over the
// whole quad (#229).

import type { TextureBaker } from './render-textures';
import { spriteTextureFromBytes, textureFromBake } from './textures/pixi-textures';
import { bakeRadialBytes } from './textures/radial-bake';
import type { BakeCanvasFactory } from './textures/texture-bake';

export function createPixiTextureBaker(canvases: BakeCanvasFactory): TextureBaker {
  return {
    bakeRadial: (spec) => spriteTextureFromBytes(bakeRadialBytes(spec), spec.sizePx),
    create: (width, height) => canvases.create(width, height),
    textureFromBake,
  };
}
