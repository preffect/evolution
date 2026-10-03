// The kelp band's textures (docs/rendering/opening-dive.md §4, ticket #802): its own bakes (the blade's grain tile, the
// rock's and the sea's signed distances) and the shore's tiles it draws the rock's surface and foam with, each its own
// GPU copy, repeating and mipmapped where it tiles. Made once the bakes have landed and given back with the band.

import type { TextureSource } from 'pixi.js';
import { byteDataTexture } from '../../textures/pixi-textures';
import type { ShoreTileName, ShoreTileSource } from '../shore/shore-tiles';
import { canvasSource } from '../shore/shore-textures';
import type { KelpBaked } from './kelp-bakes';
import type { KelpDistanceBake } from './kelp-outline';

/** The shore's tiles the rock draws from. */
export const KELP_SHORE_TILES = [
  'rock',
  'grain',
  'barnacle',
  'barnacleFar',
  'rockweed',
  'rockweedFar',
  'foam',
  'caustic',
] as const satisfies readonly ShoreTileName[];
export type KelpShoreTileName = (typeof KELP_SHORE_TILES)[number];

/** A colour's mean, 0–1 channels and its coverage. */
export type KelpMean = readonly [number, number, number, number];

export interface KelpTextures {
  readonly bladeTile: TextureSource;
  readonly rockDistance: TextureSource;
  readonly seaDistance: TextureSource;
  readonly tiles: Readonly<Record<KelpShoreTileName, TextureSource>>;
  /** The far tiles' and the foam's mean colours: what stands in for each once it shrinks below a few pixels. */
  readonly means: { readonly barnacleFar: KelpMean; readonly rockweedFar: KelpMean; readonly foam: KelpMean };
}

function distanceTexture(bake: KelpDistanceBake): TextureSource {
  return byteDataTexture(bake.data, {
    width: bake.width,
    height: bake.height,
    isFiltered: true,
    isRepeating: false,
    hasMipmaps: false,
  });
}

/** The band's textures, or `null` while one of the shore's tiles is still baking. */
export function kelpTextures(baked: KelpBaked, tiles: ShoreTileSource): KelpTextures | null {
  const shoreTiles = KELP_SHORE_TILES.map((name) => tiles.get(name));
  if (shoreTiles.some((tile) => tile === null)) return null;
  const sources = {} as Record<KelpShoreTileName, TextureSource>;
  KELP_SHORE_TILES.forEach((name, index) => {
    const tile = shoreTiles[index];
    if (tile !== null && tile !== undefined) sources[name] = canvasSource(tile.canvas, true);
  });
  const mean = (name: KelpShoreTileName): KelpMean => tiles.get(name)?.averageRgba ?? [0, 0, 0, 0];
  return {
    bladeTile: canvasSource(baked.bladeTile, true),
    rockDistance: distanceTexture(baked.rock),
    seaDistance: distanceTexture(baked.sea),
    tiles: sources,
    means: { barnacleFar: mean('barnacleFar'), rockweedFar: mean('rockweedFar'), foam: mean('foam') },
  };
}

/** Gives every texture back. */
export function releaseKelpTextures(textures: KelpTextures): void {
  for (const source of [
    textures.bladeTile,
    textures.rockDistance,
    textures.seaDistance,
    ...Object.values(textures.tiles),
  ]) {
    source.destroy();
  }
}
