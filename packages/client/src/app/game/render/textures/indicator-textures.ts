// The own-cell indicators' textures (docs/rendering/own-cell-indicators.md §10): the indicator atlas's ghosts, pip blocks and
// unlock ring packed into one source (they draw in one sprite batch), the label pill as a texture of its
// own (a nine-slice sprite stretches it), and the two BitmapFonts installed once for the bundle. Built and
// destroyed with the texture bundle (`render-textures.ts`), so a rematch rebakes and reinstalls them.

import type { Texture, TextureSource } from 'pixi.js';
import type { TextureBaker } from '../render-textures';
import { installIndicatorFonts, uninstallIndicatorFonts, type IndicatorFontNames } from './bitmap-fonts';
import { bakeIndicatorAtlas, indicatorBakeScale, type GhostKey, type IndicatorAtlasBakes } from './indicator-atlas';
import type { BakeCanvas, PxBakedSprite } from './texture-bake';

export interface IndicatorSpriteTexture {
  readonly texture: Texture;
  /** The sprite's drawn size in CSS px, its halo margin included: a layer divides by the zoom for world units. */
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface LabelPillTexture extends IndicatorSpriteTexture {
  /** The nine-slice's left and right borders in CSS px (`label-pill-bake.ts`); top and bottom are 0. */
  readonly capWidthPx: number;
  /** The glow margin on every side of the drawn pill. */
  readonly marginPx: number;
}

export interface IndicatorTextures {
  /** Texels per CSS px of every bake here: a nine-slice border in texels is `capWidthPx × bakeScale`. */
  readonly bakeScale: number;
  /** The one source behind every ghost, pip block and the unlock ring. */
  readonly source: TextureSource;
  /** Keyed by `OrbitGhost.key`: the rung ghosts are white (tint them the rim colour), the counters' are coloured. */
  readonly ghosts: Readonly<Partial<Record<GhostKey, IndicatorSpriteTexture>>>;
  /** Keyed by `pipBlockKey(variant, eaten, required)`. */
  readonly pipBlocks: Readonly<Record<string, IndicatorSpriteTexture>>;
  readonly unlockRing: IndicatorSpriteTexture;
  readonly labelPill: LabelPillTexture;
  /** The `fontFamily` a `BitmapText` names for the `value` and `label` roles. */
  readonly fonts: IndicatorFontNames;
  /** Uninstalls the fonts through the installer that installed them. */
  readonly uninstallFonts: () => void;
}

const ATLAS_GROUP = { ghost: 'ghost', pips: 'pips', unlockRing: 'unlock-ring' } as const;

function atlasKey(group: string, key: string): string {
  return `${group}:${key}`;
}

/** Every atlas bake under its group-prefixed key, so the three records share one packed source. */
function atlasCanvases(bakes: IndicatorAtlasBakes): Record<string, BakeCanvas> {
  const canvases: Record<string, BakeCanvas> = { [ATLAS_GROUP.unlockRing]: bakes.unlockRing.canvas };
  for (const [key, sprite] of Object.entries(bakes.ghosts)) {
    if (sprite !== undefined) canvases[atlasKey(ATLAS_GROUP.ghost, key)] = sprite.canvas;
  }
  for (const [key, sprite] of Object.entries(bakes.pipBlocks))
    canvases[atlasKey(ATLAS_GROUP.pips, key)] = sprite.canvas;
  return canvases;
}

export function createIndicatorTextures(baker: TextureBaker, devicePixelRatio: number): IndicatorTextures {
  const bakes = bakeIndicatorAtlas(baker, devicePixelRatio);
  const atlas = baker.atlasFromBakes(atlasCanvases(bakes));
  const frameOf = (key: string, sprite: PxBakedSprite): IndicatorSpriteTexture => ({
    texture: atlas.textures[key]!,
    widthPx: sprite.widthPx,
    heightPx: sprite.heightPx,
  });
  const ghosts: Partial<Record<GhostKey, IndicatorSpriteTexture>> = {};
  for (const [key, sprite] of Object.entries(bakes.ghosts) as [GhostKey, PxBakedSprite | undefined][]) {
    if (sprite !== undefined) ghosts[key] = frameOf(atlasKey(ATLAS_GROUP.ghost, key), sprite);
  }
  const pipBlocks: Record<string, IndicatorSpriteTexture> = {};
  for (const [key, sprite] of Object.entries(bakes.pipBlocks))
    pipBlocks[key] = frameOf(atlasKey(ATLAS_GROUP.pips, key), sprite);
  const { labelPill } = bakes;
  const fonts = installIndicatorFonts(baker, devicePixelRatio);
  return {
    bakeScale: indicatorBakeScale(devicePixelRatio),
    source: atlas.source,
    ghosts,
    pipBlocks,
    unlockRing: frameOf(ATLAS_GROUP.unlockRing, bakes.unlockRing),
    labelPill: { ...labelPill, texture: baker.textureFromBake(labelPill.canvas) },
    fonts,
    uninstallFonts: () => uninstallIndicatorFonts(baker, fonts),
  };
}

export function destroyIndicatorTextures(textures: IndicatorTextures): void {
  // The atlas frames share one source: the frames go first, the source once.
  const frames = [...Object.values(textures.ghosts), ...Object.values(textures.pipBlocks), textures.unlockRing];
  for (const sprite of frames) sprite?.texture.destroy(false);
  textures.source.destroy();
  textures.labelPill.texture.destroy(true);
  textures.uninstallFonts();
}
