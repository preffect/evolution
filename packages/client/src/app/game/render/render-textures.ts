// The texture bundle every layer draws from (docs/rendering/cells.md §1, docs/rendering/budget.md §6, §7.2,
// docs/rendering/files-and-tests.md §8): the round seed's cosmetic stream plus every texture baked at startup.
// It comes in two halves (ticket #442): `SharedRenderTextures`, which no seed reaches and which
// `renderer-slot.ts` bakes once per Pixi app and keeps, and `SeededRenderTextures`, which a rematch re-bakes.
// Two bake paths, one `TextureBaker` seam (`pixi-texture-baker.ts` in the app, a fake in tests,
// since jsdom has no canvas): the radial bakes sampled into bytes (the soft disc, the vignette;
// textures/radial-bake.ts) and the Canvas-2D bakes (the glow, mote and organelle atlases, the dish
// field, the vent sprite, the view-anchored light pool).
// The noise strip, the noise tile and the palette are bytes, uploaded as data textures for the
// cell shader (cells/cell-mesh.ts).

import type { DnaTag, GelPatchView, RandomSource } from '@evolution/shared';
import type { Texture, TextureSource } from 'pixi.js';
import type { OrganelleKind } from './constants';
import type { NoiseStrip } from './noise/noise-strip';
import { stageSeededRenderTextures, stageSharedRenderTextures } from './render-texture-stages';
import type { DishField } from './textures/dish-texture';
import type { GlowSpriteKey } from './textures/glow-atlas';
import type { RadialBakeSpec } from './textures/radial-bake';
import type { BitmapFontInstaller } from './textures/bitmap-fonts';
import { destroyIndicatorTextures, type IndicatorTextures } from './textures/indicator-textures';
import type { MoteSpriteKey, MoteVariants } from './textures/mote-atlas';
import type { SpriteAtlas } from './textures/pixi-textures';
import type { BakeCanvas, BakeCanvasFactory } from './textures/texture-bake';
import type { VentSprite } from './textures/vent-bake';

/** What turns a bake into a texture and installs the BitmapFonts: `pixi-texture-baker.ts` in the app, a stub in tests. */
export interface TextureBaker extends BakeCanvasFactory, BitmapFontInstaller {
  bakeRadial(spec: RadialBakeSpec): Texture;
  /** A sprite texture from a Canvas-2D bake made by `create`. */
  textureFromBake(bake: BakeCanvas): Texture;
  /** One frame texture per bake over a single packed source (`textures/atlas-layout.ts`): what a `ParticleContainer` draws from. */
  atlasFromBakes<Key extends string>(bakes: Readonly<Record<Key, BakeCanvas>>): SpriteAtlas<Key>;
}

export interface OrganelleSpriteTexture {
  readonly texture: Texture;
  /** The sprite's full width in cell radii, halo included (organelle-atlas.ts). */
  readonly widthRadii: number;
}

export interface MoteAtlasTextures {
  /** The one source every mote and fragment texture below is a frame of (the food `ParticleContainer`'s texture). */
  readonly source: TextureSource;
  readonly full: Readonly<Record<MoteSpriteKey, Texture>>;
  readonly small: Readonly<Record<MoteSpriteKey, Texture>>;
  readonly fragments: Readonly<Record<DnaTag, Texture>>;
  /** The unrotated glint particle drawn over every rod (textures/bacterium-bake.ts). */
  readonly rodGlint: MoteVariants<Texture>;
  readonly fullPxPerWu: number;
  readonly smallPxPerWu: number;
}

/**
 * The half of the bundle no seed reaches: the fonts, the atlases, the radial bakes and the light pool
 * are the same bytes in every round. It is baked once per Pixi app and **kept across rebuilds**
 * (`renderer-slot.ts`), so a rematch re-bakes only `SeededRenderTextures` (ticket #442): re-running these
 * is what froze the frame for a third of a second at every round change.
 */
export interface SharedRenderTextures {
  /** A white soft disc the depth particles (and later the effects) tint at use. */
  readonly glowTexture: Texture;
  /** The screen-space vignette: clear inside `VIGNETTE_RADIUS_FRACTION`, the vignette colour at the corners. */
  readonly vignetteTexture: Texture;
  /** The 8 × 8 palette shades (palette.ts), one row per palette, read with `texelFetch`. */
  readonly paletteTexture: TextureSource;
  readonly glow: Readonly<Record<GlowSpriteKey, Texture>>;
  readonly motes: MoteAtlasTextures;
  /** The condenser light pool, one sprite the dish layer keeps anchored to the view over the field (rendering/budget.md §6.1). */
  readonly lightPoolTexture: Texture;
  /** The own-cell indicators' ghosts, pip blocks, unlock ring, label pill and fonts (rendering/own-cell-indicators.md §10). */
  readonly indicators: IndicatorTextures;
}

/** The half the round seed decides: re-baked whenever the seed changes, and only then. */
export interface SeededRenderTextures {
  readonly seed: number;
  /** `fork(RANDOM_STREAM.cosmetic)` of the round seed: every cosmetic phase derives from it (rendering/cells.md §1). */
  readonly cosmetic: RandomSource;
  /** The jitter / lobes strip (noise-strip.ts) and its `texelFetch` table. */
  readonly strip: NoiseStrip;
  readonly stripTexture: TextureSource;
  /** The cytoplasm mottle, sampled trilinear with repeat: mipmapped, since it is drawn minified at every zoom under the bake scale. */
  readonly tileTexture: TextureSource;
  readonly organelles: Readonly<Record<OrganelleKind, OrganelleSpriteTexture>>;
  /** The dish field bake and its sprite texture (dish-layer.ts scales it to `halfExtentWu`). */
  readonly dishField: DishField;
  readonly dishTexture: Texture;
  /** The vent sprite bake and its texture, drawn over the field at the vent zone (dish-layer.ts). */
  readonly vent: VentSprite;
  readonly ventTexture: Texture;
}

/** What every layer draws from: the two halves together, as one flat bundle. */
export type RenderTextures = SharedRenderTextures & SeededRenderTextures;

export interface RenderTextureOptions {
  readonly seed: number;
  readonly baker: TextureBaker;
  /** The round's gel patches (a `game_state` or rematch snapshot): drawn into the dish field. */
  readonly gelPatches: readonly GelPatchView[];
  readonly devicePixelRatio: number;
  /**
   * The cytoplasm tile's edge in texels: `buildNoiseTile`'s default (`NOISE_TILE_SIZE_PX`) when
   * absent. A test shrinks it (the bake is the one CPU-heavy step of the bundle and its bytes are
   * never sampled without WebGL).
   */
  readonly noiseTileSizePx?: number;
}

/** The seed-independent half, baked once per Pixi app (`renderer-slot.ts` keeps it across rebuilds). */
export function createSharedRenderTextures(baker: TextureBaker, devicePixelRatio: number): SharedRenderTextures {
  return stageSharedRenderTextures(baker, devicePixelRatio).runAll();
}

/** The seeded half (`render-texture-stages.ts` for how each bake takes its own sub-stream). */
export function createSeededRenderTextures(options: RenderTextureOptions): SeededRenderTextures {
  return stageSeededRenderTextures(options).runAll();
}

/** Both halves at once: what a first build (and every test) asks for. */
export function createRenderTextures(options: RenderTextureOptions): RenderTextures {
  return {
    ...createSharedRenderTextures(options.baker, options.devicePixelRatio),
    ...createSeededRenderTextures(options),
  };
}

export function destroySharedRenderTextures(textures: SharedRenderTextures): void {
  const sprites: Texture[] = [
    textures.glowTexture,
    textures.vignetteTexture,
    textures.lightPoolTexture,
    ...Object.values(textures.glow),
  ];
  for (const texture of sprites) texture.destroy(true);
  // The mote frames share one source: the frames go first, the source once.
  const moteFrames = [
    ...Object.values(textures.motes.full),
    ...Object.values(textures.motes.small),
    ...Object.values(textures.motes.fragments),
    ...Object.values(textures.motes.rodGlint),
  ];
  for (const texture of moteFrames) texture.destroy(false);
  textures.motes.source.destroy();
  textures.paletteTexture.destroy();
  destroyIndicatorTextures(textures.indicators);
}

export function destroySeededRenderTextures(textures: SeededRenderTextures): void {
  const sprites: Texture[] = [
    textures.dishTexture,
    textures.ventTexture,
    ...Object.values(textures.organelles).map((sprite) => sprite.texture),
  ];
  for (const texture of sprites) texture.destroy(true);
  textures.stripTexture.destroy();
  textures.tileTexture.destroy();
}

export function destroyRenderTextures(textures: RenderTextures): void {
  destroySeededRenderTextures(textures);
  destroySharedRenderTextures(textures);
}
