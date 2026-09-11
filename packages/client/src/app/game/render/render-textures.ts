// Every texture the renderer bakes at startup, from the round seed's cosmetic stream (docs/
// RENDERING.md §1, §6): the noise strip and tile, the palette, the glow, mote and organelle
// atlases, the dish field and the vignette. Rebuilt when the seed changes (a rematch).

import { RANDOM_STREAM, createSeededRandom, type GelPatchView, type RandomSource } from '@evolution/shared';
import type { Texture, TextureSource } from 'pixi.js';
import { NOISE_STRIP_ROWS, NOISE_STRIP_WIDTH, NOISE_TILE_SIZE_PX, PALETTE_SHADE_COUNT } from './constants';
import { PLAYER_PALETTE_COUNT } from '@evolution/shared';
import { buildNoiseStrip, type NoiseStrip } from './noise/noise-strip';
import { buildNoiseTile } from './noise/noise-tile';
import { bakePaletteTextureBytes } from './palette';
import { bakeDishField, bakeVignette, type DishField } from './textures/dish-texture';
import { bakeGlowAtlas, type GlowAtlas } from './textures/glow-atlas';
import { bakeMoteAtlas } from './textures/mote-atlas';
import { moteAtlasTextures, type MoteAtlas } from './textures/mote-atlas-textures';
import { bakeOrganelleAtlas, type OrganelleAtlas } from './textures/organelle-atlas';
import { byteDataTexture, textureFromBake } from './textures/pixi-textures';
import type { BakeCanvasFactory } from './textures/texture-bake';

export interface RenderTextures {
  readonly seed: number;
  readonly cosmetic: RandomSource;
  readonly strip: NoiseStrip;
  readonly stripTexture: TextureSource;
  readonly tileTexture: TextureSource;
  readonly paletteTexture: TextureSource;
  readonly glow: GlowAtlas;
  readonly glowTexture: Texture;
  readonly ringTexture: Texture;
  readonly motes: MoteAtlas;
  readonly organelles: OrganelleAtlas;
  readonly dish: DishField;
  readonly vignetteTexture: Texture;
}

export interface RenderTextureOptions {
  readonly seed: number;
  readonly gelPatches: readonly GelPatchView[];
  readonly devicePixelRatio: number;
  readonly factory: BakeCanvasFactory;
}

export function createRenderTextures(options: RenderTextureOptions): RenderTextures {
  const cosmetic = createSeededRandom(options.seed).fork(RANDOM_STREAM.cosmetic);
  const strip = buildNoiseStrip(cosmetic);
  const tile = buildNoiseTile(cosmetic);
  const glow = bakeGlowAtlas(options.factory);
  return {
    seed: options.seed,
    cosmetic,
    strip,
    stripTexture: byteDataTexture(strip.bytes, {
      width: NOISE_STRIP_WIDTH,
      height: NOISE_STRIP_ROWS,
      isFiltered: false,
      isRepeating: false,
    }),
    tileTexture: byteDataTexture(tile.bytes, {
      width: NOISE_TILE_SIZE_PX,
      height: NOISE_TILE_SIZE_PX,
      isFiltered: true,
      isRepeating: true,
    }),
    paletteTexture: byteDataTexture(bakePaletteTextureBytes(), {
      width: PALETTE_SHADE_COUNT,
      height: PLAYER_PALETTE_COUNT,
      isFiltered: false,
      isRepeating: false,
    }),
    glow,
    glowTexture: textureFromBake(glow.glow),
    ringTexture: textureFromBake(glow.ring),
    motes: moteAtlasTextures(bakeMoteAtlas(options.factory)),
    organelles: bakeOrganelleAtlas(options.factory, options.devicePixelRatio),
    dish: bakeDishField(options.factory, options.gelPatches),
    vignetteTexture: textureFromBake(bakeVignette(options.factory)),
  };
}
