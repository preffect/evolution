// The texture bundle every layer draws from (docs/RENDERING.md §6, §8): the round seed's cosmetic
// stream plus the shared textures, rebuilt when the seed changes (a rematch). Slice A needs two
// radial bakes, described here as data and drawn by the `TextureBaker` the Pixi app hands over
// (`pixi-texture-baker.ts`; a fake in tests, since jsdom has no canvas). Slice B (#206) replaces
// them with the Canvas-2D bakes (the glow atlas, the mote and organelle atlases, the noise strip
// and tile, the palette texture, the dish field) and slice C (#207) reads the atlases from here.

import { RANDOM_STREAM, createSeededRandom, type RandomSource } from '@evolution/shared';
import type { Texture } from 'pixi.js';
import {
  GLOW_TEXTURE_PX,
  VIGNETTE,
  VIGNETTE_ALPHA,
  VIGNETTE_RADIUS_FRACTION,
  VIGNETTE_TEXTURE_PX,
  WHITE,
} from './constants';

export interface RadialStop {
  /** 0 at the centre, 1 at the half-diagonal of the bake. */
  readonly offset: number;
  readonly alpha: number;
}

export const RADIAL_BAKE_SHAPE = { disc: 'disc', square: 'square' } as const;
export type RadialBakeShape = (typeof RADIAL_BAKE_SHAPE)[keyof typeof RADIAL_BAKE_SHAPE];

/** One radial-gradient bake: a `sizePx` square (or the disc inscribed in it) shaded from its centre. */
export interface RadialBakeSpec {
  readonly sizePx: number;
  readonly shape: RadialBakeShape;
  readonly colour: string;
  readonly stops: readonly RadialStop[];
}

/** What turns a bake spec into a texture: `pixi-texture-baker.ts` in the app, a stub in tests. */
export interface TextureBaker {
  bakeRadial(spec: RadialBakeSpec): Texture;
}

export interface RenderTextures {
  readonly seed: number;
  /** `fork(RANDOM_STREAM.cosmetic)` of the round seed: every cosmetic phase derives from it (RENDERING §1). */
  readonly cosmetic: RandomSource;
  /** A white soft disc the depth particles (and later the effects) tint at use. */
  readonly glowTexture: Texture;
  /** The screen-space vignette: clear inside `VIGNETTE_RADIUS_FRACTION`, the vignette colour at the corners. */
  readonly vignetteTexture: Texture;
}

export interface RenderTextureOptions {
  readonly seed: number;
  readonly baker: TextureBaker;
}

const CLEAR = 0;
const OPAQUE = 1;
/** Where the inscribed disc's rim sits on the centre-to-corner scale. */
const DISC_RIM_OFFSET = 1 / Math.SQRT2;

/** The soft disc: opaque at the centre, clear at the rim (the glow atlas's `disc`, ASSET-GENERATION §1.5). */
export const SOFT_DISC_BAKE: RadialBakeSpec = {
  sizePx: GLOW_TEXTURE_PX,
  shape: RADIAL_BAKE_SHAPE.disc,
  colour: WHITE,
  stops: [
    { offset: 0, alpha: OPAQUE },
    { offset: DISC_RIM_OFFSET, alpha: CLEAR },
  ],
};

/** The vignette: transparent to `VIGNETTE_RADIUS_FRACTION` of the half-diagonal, then to the vignette colour. */
export const VIGNETTE_BAKE: RadialBakeSpec = {
  sizePx: VIGNETTE_TEXTURE_PX,
  shape: RADIAL_BAKE_SHAPE.square,
  colour: VIGNETTE,
  stops: [
    { offset: 0, alpha: CLEAR },
    { offset: VIGNETTE_RADIUS_FRACTION, alpha: CLEAR },
    { offset: 1, alpha: VIGNETTE_ALPHA },
  ],
};

export function createRenderTextures(options: RenderTextureOptions): RenderTextures {
  return {
    seed: options.seed,
    cosmetic: createSeededRandom(options.seed).fork(RANDOM_STREAM.cosmetic),
    glowTexture: options.baker.bakeRadial(SOFT_DISC_BAKE),
    vignetteTexture: options.baker.bakeRadial(VIGNETTE_BAKE),
  };
}

export function destroyRenderTextures(textures: RenderTextures): void {
  textures.glowTexture.destroy(true);
  textures.vignetteTexture.destroy(true);
}
