// The texture bundle's two halves as staged bakes (ticket #479, docs/rendering/budget.md §7.2): each half is a list
// of steps, one bake or one small group of them each, so the live room's frame loop can run one per animation frame
// instead of freezing the first frame for the whole bundle. `render-textures.ts`'s `create*` run the same steps back
// to back, so a staged bundle and a whole one are the same bakes in the same order, byte for byte.
//
// The steps are cut where the bakes are: the indicator atlas and its fonts, the mote atlas, the glow atlas, each
// radial bake, the dish field, the vent, the noise tile and the organelle atlas are each one step.

import { PLAYER_PALETTE_COUNT, RANDOM_STREAM, createSeededRandom, type RandomSource } from '@evolution/shared';
import type { Texture, TextureSource } from 'pixi.js';
import { NOISE_STRIP_ROWS, NOISE_STRIP_WIDTH, PALETTE_SHADE_COUNT, type OrganelleKind } from './constants';
import { buildNoiseStrip, type NoiseStrip } from './noise/noise-strip';
import { buildNoiseTile } from './noise/noise-tile';
import { bakePaletteTextureBytes } from './palette';
import type {
  OrganelleSpriteTexture,
  RenderTextureOptions,
  SeededRenderTextures,
  SharedRenderTextures,
  TextureBaker,
} from './render-textures';
import { StagedBake, baked } from './staged-bake';
import { bakeDishField, type DishField } from './textures/dish-texture';
import { bakeGlowAtlas, type GlowSpriteKey } from './textures/glow-atlas';
import { createIndicatorTextures, type IndicatorTextures } from './textures/indicator-textures';
import { bakeLightPool } from './textures/light-pool-bake';
import { moteTextures } from './textures/mote-textures';
import { bakeOrganelleAtlas } from './textures/organelle-atlas';
import { byteDataTexture, texturesFromBakes } from './textures/pixi-textures';
import { SOFT_DISC_BAKE, VIGNETTE_BAKE } from './textures/radial-bake';
import { bakeVentSprite, type VentSprite } from './textures/vent-bake';

function organelleTextures(
  baker: TextureBaker,
  devicePixelRatio: number,
  cosmetic: RandomSource,
): SeededRenderTextures['organelles'] {
  const bakes = bakeOrganelleAtlas(baker, devicePixelRatio, cosmetic);
  const textures = {} as Record<OrganelleKind, OrganelleSpriteTexture>;
  for (const kind of Object.keys(bakes) as OrganelleKind[]) {
    textures[kind] = { texture: baker.textureFromBake(bakes[kind].canvas), widthRadii: bakes[kind].widthRadii };
  }
  return textures;
}

function paletteTexture(): TextureSource {
  return byteDataTexture(bakePaletteTextureBytes(), {
    width: PALETTE_SHADE_COUNT,
    height: PLAYER_PALETTE_COUNT,
    isFiltered: false,
    isRepeating: false,
    hasMipmaps: false,
  });
}

/** The seed-independent half, one step per bake; nothing here touches a cosmetic stream. */
export function stageSharedRenderTextures(
  baker: TextureBaker,
  devicePixelRatio: number,
): StagedBake<SharedRenderTextures> {
  let lightPoolTexture: Texture | undefined;
  let glowTexture: Texture | undefined;
  let vignetteTexture: Texture | undefined;
  let palette: TextureSource | undefined;
  let glow: Readonly<Record<GlowSpriteKey, Texture>> | undefined;
  let motes: SharedRenderTextures['motes'] | undefined;
  let indicators: IndicatorTextures | undefined;
  const steps = [
    () => (lightPoolTexture = baker.textureFromBake(bakeLightPool(baker))),
    () => (glowTexture = baker.bakeRadial(SOFT_DISC_BAKE)),
    () => (vignetteTexture = baker.bakeRadial(VIGNETTE_BAKE)),
    () => (palette = paletteTexture()),
    () => (glow = texturesFromBakes(bakeGlowAtlas(baker), (bake) => baker.textureFromBake(bake))),
    () => (motes = moteTextures(baker)),
    () => (indicators = createIndicatorTextures(baker, devicePixelRatio)),
  ];
  return new StagedBake(steps, () => ({
    glowTexture: baked(glowTexture, 'glowTexture'),
    vignetteTexture: baked(vignetteTexture, 'vignetteTexture'),
    paletteTexture: baked(palette, 'paletteTexture'),
    glow: baked(glow, 'glow'),
    motes: baked(motes, 'motes'),
    lightPoolTexture: baked(lightPoolTexture, 'lightPoolTexture'),
    indicators: baked(indicators, 'indicators'),
  }));
}

/**
 * The seeded half. Every bake below takes a **named sub-stream** off `cosmetic` rather than drawing from it
 * (`COSMETIC_SUB_STREAM`, docs/DETERMINISM.md), so none of them can move another's numbers and neither the split
 * (ticket #442) nor the staging could change a byte. What that rests on is that nothing in the shared half touches
 * `cosmetic` at all — a shared bake that drew from it directly would shift every seeded bake after it, which is
 * what `render-textures.spec.ts` compares the dish field's recorded strokes to catch.
 */
export function stageSeededRenderTextures(options: RenderTextureOptions): StagedBake<SeededRenderTextures> {
  const { baker } = options;
  const cosmetic = createSeededRandom(options.seed).fork(RANDOM_STREAM.cosmetic);
  let dishField: DishField | undefined;
  let vent: VentSprite | undefined;
  let strip: NoiseStrip | undefined;
  let stripTexture: TextureSource | undefined;
  let tileTexture: TextureSource | undefined;
  let organelles: SeededRenderTextures['organelles'] | undefined;
  const steps = [
    () => (dishField = bakeDishField(baker, options.gelPatches, cosmetic)),
    () => (vent = bakeVentSprite(baker, cosmetic)),
    () => {
      strip = buildNoiseStrip(cosmetic);
      stripTexture = byteDataTexture(strip.bytes, {
        width: NOISE_STRIP_WIDTH,
        height: NOISE_STRIP_ROWS,
        isFiltered: false,
        isRepeating: false,
        hasMipmaps: false,
      });
    },
    () => {
      const tile = buildNoiseTile(cosmetic, options.noiseTileSizePx);
      tileTexture = byteDataTexture(tile.bytes, {
        width: tile.size,
        height: tile.size,
        isFiltered: true,
        isRepeating: true,
        hasMipmaps: true,
      });
    },
    () => (organelles = organelleTextures(baker, options.devicePixelRatio, cosmetic)),
  ];
  return new StagedBake(steps, () => {
    const field = baked(dishField, 'dishField');
    const ventSprite = baked(vent, 'vent');
    return {
      seed: options.seed,
      cosmetic,
      strip: baked(strip, 'strip'),
      stripTexture: baked(stripTexture, 'stripTexture'),
      tileTexture: baked(tileTexture, 'tileTexture'),
      organelles: baked(organelles, 'organelles'),
      dishField: field,
      dishTexture: baker.textureFromBake(field.canvas),
      vent: ventSprite,
      ventTexture: baker.textureFromBake(ventSprite.canvas),
    };
  });
}
