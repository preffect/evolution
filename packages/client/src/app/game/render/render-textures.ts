// The texture bundle every layer draws from (docs/RENDERING.md §1, §6, §8): the round seed's
// cosmetic stream plus every texture baked at startup, rebuilt when the seed changes (a rematch).
// Two bake paths, one `TextureBaker` seam (`pixi-texture-baker.ts` in the app, a fake in tests,
// since jsdom has no canvas): the radial bakes sampled into bytes (the soft disc, the vignette;
// textures/radial-bake.ts) and the Canvas-2D bakes (the glow, mote and organelle atlases, the dish field, the vent sprite).
// The noise strip, the noise tile and the palette are bytes, uploaded as data textures for the
// cell shader (cells/cell-mesh.ts).

import {
  PLAYER_PALETTE_COUNT,
  RANDOM_STREAM,
  createSeededRandom,
  type DnaTag,
  type GelPatchView,
  type RandomSource,
} from '@evolution/shared';
import type { Texture, TextureSource } from 'pixi.js';
import {
  GLOW_TEXTURE_PX,
  NOISE_STRIP_ROWS,
  NOISE_STRIP_WIDTH,
  PALETTE_SHADE_COUNT,
  VIGNETTE,
  VIGNETTE_ALPHA,
  VIGNETTE_RADIUS_FRACTION,
  VIGNETTE_TEXTURE_PX,
  WHITE,
  type OrganelleKind,
} from './constants';
import { buildNoiseStrip, type NoiseStrip } from './noise/noise-strip';
import { buildNoiseTile } from './noise/noise-tile';
import { bakePaletteTextureBytes } from './palette';
import { bakeDishField, type DishField } from './textures/dish-texture';
import { bakeGlowAtlas, type GlowSpriteKey } from './textures/glow-atlas';
import { bakeMoteAtlas, type MoteSpriteKey } from './textures/mote-atlas';
import { bakeOrganelleAtlas } from './textures/organelle-atlas';
import { byteDataTexture, texturesFromBakes, type SpriteAtlas } from './textures/pixi-textures';
import type { BakeCanvas, BakeCanvasFactory } from './textures/texture-bake';
import { bakeVentSprite, type VentSprite } from './textures/vent-bake';

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

/** What turns a bake into a texture: `pixi-texture-baker.ts` in the app, a stub in tests. */
export interface TextureBaker extends BakeCanvasFactory {
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
  readonly fullPxPerWu: number;
  readonly smallPxPerWu: number;
}

export interface RenderTextures {
  readonly seed: number;
  /** `fork(RANDOM_STREAM.cosmetic)` of the round seed: every cosmetic phase derives from it (RENDERING §1). */
  readonly cosmetic: RandomSource;
  /** A white soft disc the depth particles (and later the effects) tint at use. */
  readonly glowTexture: Texture;
  /** The screen-space vignette: clear inside `VIGNETTE_RADIUS_FRACTION`, the vignette colour at the corners. */
  readonly vignetteTexture: Texture;
  /** The jitter / lobes strip (noise-strip.ts) and its `texelFetch` table. */
  readonly strip: NoiseStrip;
  readonly stripTexture: TextureSource;
  /** The cytoplasm mottle, sampled trilinear with repeat: mipmapped, since it is drawn minified at every zoom under the bake scale. */
  readonly tileTexture: TextureSource;
  /** The 8 × 8 palette shades (palette.ts), one row per palette, read with `texelFetch`. */
  readonly paletteTexture: TextureSource;
  readonly glow: Readonly<Record<GlowSpriteKey, Texture>>;
  readonly motes: MoteAtlasTextures;
  readonly organelles: Readonly<Record<OrganelleKind, OrganelleSpriteTexture>>;
  /** The dish field bake and its sprite texture (dish-layer.ts scales it to `halfExtentWu`). */
  readonly dishField: DishField;
  readonly dishTexture: Texture;
  /** The vent sprite bake and its texture, drawn over the field at the vent zone (dish-layer.ts). */
  readonly vent: VentSprite;
  readonly ventTexture: Texture;
}

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

function organelleTextures(
  baker: TextureBaker,
  devicePixelRatio: number,
  cosmetic: RandomSource,
): RenderTextures['organelles'] {
  const bakes = bakeOrganelleAtlas(baker, devicePixelRatio, cosmetic);
  const textures = {} as Record<OrganelleKind, OrganelleSpriteTexture>;
  for (const kind of Object.keys(bakes) as OrganelleKind[]) {
    textures[kind] = { texture: baker.textureFromBake(bakes[kind].canvas), widthRadii: bakes[kind].widthRadii };
  }
  return textures;
}

const MOTE_ATLAS_GROUP = { full: 'full', small: 'small', fragment: 'fragment' } as const;

/** `group:key` for every bake of a record, so three records share one atlas. */
function prefixed<Key extends string>(
  group: string,
  bakes: Readonly<Record<Key, BakeCanvas>>,
): Record<string, BakeCanvas> {
  const result: Record<string, BakeCanvas> = {};
  for (const key of Object.keys(bakes) as Key[]) result[`${group}:${key}`] = bakes[key];
  return result;
}

/** The textures of one group back under their own keys. */
function unprefixed<Key extends string>(
  group: string,
  keys: readonly Key[],
  atlas: SpriteAtlas<string>,
): Readonly<Record<Key, Texture>> {
  const result = {} as Record<Key, Texture>;
  for (const key of keys) result[key] = atlas.textures[`${group}:${key}`]!;
  return result;
}

/** The full and small mote sprites and the fragment helices packed into one atlas (docs/RENDERING.md §6). */
function moteTextures(baker: TextureBaker): MoteAtlasTextures {
  const bakes = bakeMoteAtlas(baker);
  const atlas = baker.atlasFromBakes({
    ...prefixed(MOTE_ATLAS_GROUP.full, bakes.full),
    ...prefixed(MOTE_ATLAS_GROUP.small, bakes.small),
    ...prefixed(MOTE_ATLAS_GROUP.fragment, bakes.fragments),
  });
  const moteKeys = Object.keys(bakes.full) as MoteSpriteKey[];
  return {
    source: atlas.source,
    full: unprefixed(MOTE_ATLAS_GROUP.full, moteKeys, atlas),
    small: unprefixed(MOTE_ATLAS_GROUP.small, moteKeys, atlas),
    fragments: unprefixed(MOTE_ATLAS_GROUP.fragment, Object.keys(bakes.fragments) as DnaTag[], atlas),
    fullPxPerWu: bakes.fullPxPerWu,
    smallPxPerWu: bakes.smallPxPerWu,
  };
}

/** The cell shader's data textures: the strip and the palette as `texelFetch` tables, the tile sampled trilinear. */
function cellDataTextures(
  cosmetic: RandomSource,
  noiseTileSizePx: number | undefined,
): Pick<RenderTextures, 'strip' | 'stripTexture' | 'tileTexture' | 'paletteTexture'> {
  const strip = buildNoiseStrip(cosmetic);
  const tile = buildNoiseTile(cosmetic, noiseTileSizePx);
  return {
    strip,
    stripTexture: byteDataTexture(strip.bytes, {
      width: NOISE_STRIP_WIDTH,
      height: NOISE_STRIP_ROWS,
      isFiltered: false,
      isRepeating: false,
      hasMipmaps: false,
    }),
    tileTexture: byteDataTexture(tile.bytes, {
      width: tile.size,
      height: tile.size,
      isFiltered: true,
      isRepeating: true,
      hasMipmaps: true,
    }),
    paletteTexture: byteDataTexture(bakePaletteTextureBytes(), {
      width: PALETTE_SHADE_COUNT,
      height: PLAYER_PALETTE_COUNT,
      isFiltered: false,
      isRepeating: false,
      hasMipmaps: false,
    }),
  };
}

export function createRenderTextures(options: RenderTextureOptions): RenderTextures {
  const { baker } = options;
  const cosmetic = createSeededRandom(options.seed).fork(RANDOM_STREAM.cosmetic);
  const dishField = bakeDishField(baker, options.gelPatches, cosmetic);
  const vent = bakeVentSprite(baker, cosmetic);
  return {
    seed: options.seed,
    cosmetic,
    glowTexture: baker.bakeRadial(SOFT_DISC_BAKE),
    vignetteTexture: baker.bakeRadial(VIGNETTE_BAKE),
    ...cellDataTextures(cosmetic, options.noiseTileSizePx),
    glow: texturesFromBakes(bakeGlowAtlas(baker), (bake) => baker.textureFromBake(bake)),
    motes: moteTextures(baker),
    organelles: organelleTextures(baker, options.devicePixelRatio, cosmetic),
    dishField,
    dishTexture: baker.textureFromBake(dishField.canvas),
    vent,
    ventTexture: baker.textureFromBake(vent.canvas),
  };
}

export function destroyRenderTextures(textures: RenderTextures): void {
  const sprites: Texture[] = [
    textures.glowTexture,
    textures.vignetteTexture,
    textures.dishTexture,
    textures.ventTexture,
    ...Object.values(textures.glow),
    ...Object.values(textures.organelles).map((sprite) => sprite.texture),
  ];
  for (const texture of sprites) texture.destroy(true);
  // The mote frames share one source: the frames go first, the source once.
  const moteFrames = [
    ...Object.values(textures.motes.full),
    ...Object.values(textures.motes.small),
    ...Object.values(textures.motes.fragments),
  ];
  for (const texture of moteFrames) texture.destroy(false);
  textures.motes.source.destroy();
  textures.stripTexture.destroy();
  textures.tileTexture.destroy();
  textures.paletteTexture.destroy();
}
