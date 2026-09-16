// The own-cell indicators' textures (docs/rendering/own-cell-indicators.md §10): the indicator atlas's ghosts, pip blocks
// and the cues' two glyphs packed into one source (they draw in one sprite batch), each pill as a texture of its
// own (a nine-slice sprite stretches it), and the two BitmapFonts installed once for the bundle. Built and
// destroyed with the texture bundle (`render-textures.ts`), so a rematch rebakes and reinstalls them.

import type { Texture, TextureSource } from 'pixi.js';
import type { CueRim } from '../../hud/format/mass-cues';
import type { TextureBaker } from '../render-textures';
import { installIndicatorFonts, uninstallIndicatorFonts, type IndicatorFontNames } from './bitmap-fonts';
import { bakeIndicatorAtlas, indicatorBakeScale, type GhostKey, type IndicatorAtlasBakes } from './indicator-atlas';
import type { LabelPillBake } from './label-pill-bake';
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
  /** The one source behind every ghost, pip block and cue glyph. */
  readonly source: TextureSource;
  /** Keyed by `OrbitGhost.key`: the rung ghosts are white (tint them the rim colour), the counters' are coloured. */
  readonly ghosts: Readonly<Partial<Record<GhostKey, IndicatorSpriteTexture>>>;
  /** Keyed by `pipBlockKey(variant, eaten, required)`. */
  readonly pipBlocks: Readonly<Record<string, IndicatorSpriteTexture>>;
  readonly labelPill: LabelPillTexture;
  /** The mass chip's trend triangle, white and pointing up (docs/ui/hud.md §3.1.5). */
  readonly trendGlyph: IndicatorSpriteTexture;
  /** The zone pill's dot, white. */
  readonly zoneDot: IndicatorSpriteTexture;
  /** One cue pill per rim role. */
  readonly cuePills: Readonly<Record<CueRim, LabelPillTexture>>;
  /** The label pill's size without the danger rim. */
  readonly zonePill: LabelPillTexture;
  /** The `fontFamily` a `BitmapText` names for the `value` and `label` roles. */
  readonly fonts: IndicatorFontNames;
  /** Uninstalls the fonts through the installer that installed them. */
  readonly uninstallFonts: () => void;
}

const ATLAS_GROUP = { ghost: 'ghost', pips: 'pips', cue: 'cue' } as const;
const CUE_GLYPH = { trend: 'trend', zoneDot: 'zone-dot' } as const;

function atlasKey(group: string, key: string): string {
  return `${group}:${key}`;
}

/** Every atlas bake under its group-prefixed key, so the records share one packed source. */
function atlasCanvases(bakes: IndicatorAtlasBakes): Record<string, BakeCanvas> {
  const canvases: Record<string, BakeCanvas> = {};
  for (const [key, sprite] of Object.entries(bakes.ghosts)) {
    if (sprite !== undefined) canvases[atlasKey(ATLAS_GROUP.ghost, key)] = sprite.canvas;
  }
  for (const [key, sprite] of Object.entries(bakes.pipBlocks))
    canvases[atlasKey(ATLAS_GROUP.pips, key)] = sprite.canvas;
  canvases[atlasKey(ATLAS_GROUP.cue, CUE_GLYPH.trend)] = bakes.trendGlyph.canvas;
  canvases[atlasKey(ATLAS_GROUP.cue, CUE_GLYPH.zoneDot)] = bakes.zoneDot.canvas;
  return canvases;
}

function pillTexture(baker: TextureBaker, bake: LabelPillBake): LabelPillTexture {
  return { ...bake, texture: baker.textureFromBake(bake.canvas) };
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
  const cuePills = Object.fromEntries(
    Object.entries(bakes.cuePills).map(([rim, bake]) => [rim, pillTexture(baker, bake)]),
  ) as Record<CueRim, LabelPillTexture>;
  const fonts = installIndicatorFonts(baker, devicePixelRatio);
  return {
    bakeScale: indicatorBakeScale(devicePixelRatio),
    source: atlas.source,
    ghosts,
    pipBlocks,
    labelPill: pillTexture(baker, bakes.labelPill),
    trendGlyph: frameOf(atlasKey(ATLAS_GROUP.cue, CUE_GLYPH.trend), bakes.trendGlyph),
    zoneDot: frameOf(atlasKey(ATLAS_GROUP.cue, CUE_GLYPH.zoneDot), bakes.zoneDot),
    cuePills,
    zonePill: pillTexture(baker, bakes.zonePill),
    fonts,
    uninstallFonts: () => uninstallIndicatorFonts(baker, fonts),
  };
}

export function destroyIndicatorTextures(textures: IndicatorTextures): void {
  // The atlas frames share one source: the frames go first, the source once.
  const frames = [
    ...Object.values(textures.ghosts),
    ...Object.values(textures.pipBlocks),
    textures.trendGlyph,
    textures.zoneDot,
  ];
  for (const sprite of frames) sprite?.texture.destroy(false);
  textures.source.destroy();
  for (const pill of [textures.labelPill, textures.zonePill, ...Object.values(textures.cuePills)]) {
    pill.texture.destroy(true);
  }
  textures.uninstallFonts();
}
