// The mote atlas's textures (docs/RENDERING.md §6): the full and small mote sprites, the fragment helices
// and the rod glints packed into one source, the food `ParticleContainer`'s one texture. Split from
// `render-textures.ts`, which assembles the bundle.

import type { DnaTag } from '@evolution/shared';
import type { Texture } from 'pixi.js';
import type { MoteAtlasTextures, TextureBaker } from '../render-textures';
import { bakeMoteAtlas, type MoteSpriteKey, type MoteVariants } from './mote-atlas';
import type { SpriteAtlas } from './pixi-textures';
import type { BakeCanvas } from './texture-bake';

const MOTE_ATLAS_GROUP = { full: 'full', small: 'small', fragment: 'fragment', glint: 'glint' } as const;

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
export function moteTextures(baker: TextureBaker): MoteAtlasTextures {
  const bakes = bakeMoteAtlas(baker);
  const atlas = baker.atlasFromBakes({
    ...prefixed(MOTE_ATLAS_GROUP.full, bakes.full),
    ...prefixed(MOTE_ATLAS_GROUP.small, bakes.small),
    ...prefixed(MOTE_ATLAS_GROUP.fragment, bakes.fragments),
    ...prefixed(MOTE_ATLAS_GROUP.glint, bakes.rodGlint),
  });
  const moteKeys = Object.keys(bakes.full) as MoteSpriteKey[];
  const variantKeys: readonly (keyof MoteVariants<Texture>)[] = ['full', 'small'];
  return {
    source: atlas.source,
    full: unprefixed(MOTE_ATLAS_GROUP.full, moteKeys, atlas),
    small: unprefixed(MOTE_ATLAS_GROUP.small, moteKeys, atlas),
    fragments: unprefixed(MOTE_ATLAS_GROUP.fragment, Object.keys(bakes.fragments) as DnaTag[], atlas),
    rodGlint: unprefixed(MOTE_ATLAS_GROUP.glint, variantKeys, atlas),
    fullPxPerWu: bakes.fullPxPerWu,
    smallPxPerWu: bakes.smallPxPerWu,
  };
}
