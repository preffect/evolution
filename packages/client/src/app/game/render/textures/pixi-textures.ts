// The one place a baked canvas or a byte buffer becomes a Pixi texture (docs/RENDERING.md §6):
// sprite textures from bakes, the RGBA8 data textures the cell shader reads with `texelFetch`
// (the noise strip, the palette) or samples (the noise tile), and the RGBA32F instance texture
// the cell mesh re-uploads every frame.

import { BufferImageSource, Texture, type TextureSource } from 'pixi.js';
import type { BakeCanvas } from './texture-bake';

/** A sprite texture from a bake; the bake's element must be a real canvas (the DOM factory's). */
export function textureFromBake(bake: BakeCanvas): Texture {
  if (bake.element === null) throw new Error('A texture needs a DOM canvas behind the bake.');
  return Texture.from(bake.element);
}

/** Every bake of a record as a texture, under the same keys. */
export function texturesFromBakes<Key extends string>(
  bakes: Readonly<Record<Key, BakeCanvas>>,
  toTexture: (bake: BakeCanvas) => Texture,
): Readonly<Record<Key, Texture>> {
  const textures = {} as Record<Key, Texture>;
  for (const key of Object.keys(bakes) as Key[]) textures[key] = toTexture(bakes[key]);
  return textures;
}

export interface DataTextureOptions {
  readonly width: number;
  readonly height: number;
  /** `nearest` for tables read with texelFetch, `linear` for the sampled noise tile. */
  readonly isFiltered: boolean;
  readonly isRepeating: boolean;
  /** Mip levels with trilinear filtering, for a sampled texture drawn minified (the noise tile); never for a table. */
  readonly hasMipmaps: boolean;
}

/** An RGBA8 table texture from bytes: data, never colour, so the upload leaves every channel untouched. */
export function byteDataTexture(bytes: Uint8Array, options: DataTextureOptions): TextureSource {
  return new BufferImageSource({
    resource: bytes,
    width: options.width,
    height: options.height,
    format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: options.isFiltered ? 'linear' : 'nearest',
    mipmapFilter: options.hasMipmaps ? 'linear' : 'nearest',
    addressMode: options.isRepeating ? 'repeat' : 'clamp-to-edge',
    autoGenerateMipmaps: options.hasMipmaps,
  });
}

/** An RGBA32F table texture over `values` (`width × height × 4` floats), read with `texelFetch`; `update()` re-uploads. */
export function floatDataTexture(values: Float32Array, width: number, height: number): TextureSource {
  return new BufferImageSource({
    resource: values,
    width,
    height,
    format: 'rgba32float',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: 'nearest',
    addressMode: 'clamp-to-edge',
    autoGenerateMipmaps: false,
  });
}
