// The mote atlas as Pixi textures: bakes become textures once, at startup, in the browser.

import type { DnaTag } from '@evolution/shared';
import type { Texture } from 'pixi.js';
import { type MoteAtlas as MoteBakes, type MoteSpriteKey } from './mote-atlas';
import { textureFromBake } from './pixi-textures';
import type { BakeCanvas } from './texture-bake';

export interface MoteAtlas {
  readonly fullTextures: Readonly<Record<MoteSpriteKey, Texture>>;
  readonly smallTextures: Readonly<Record<MoteSpriteKey, Texture>>;
  readonly fragmentTextures: Readonly<Record<DnaTag, Texture>>;
  readonly fullPxPerWu: number;
  readonly smallPxPerWu: number;
}

function mapTextures<Key extends string>(bakes: Readonly<Record<Key, BakeCanvas>>): Readonly<Record<Key, Texture>> {
  const textures = {} as Record<Key, Texture>;
  for (const key of Object.keys(bakes) as Key[]) textures[key] = textureFromBake(bakes[key]);
  return textures;
}

export function moteAtlasTextures(bakes: MoteBakes): MoteAtlas {
  return {
    fullTextures: mapTextures(bakes.full),
    smallTextures: mapTextures(bakes.small),
    fragmentTextures: mapTextures(bakes.fragments),
    fullPxPerWu: bakes.fullPxPerWu,
    smallPxPerWu: bakes.smallPxPerWu,
  };
}
