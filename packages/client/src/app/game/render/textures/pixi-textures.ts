// The one place a baked canvas or a byte buffer becomes a Pixi texture (docs/RENDERING.md §6):
// sprites from bakes, and the data textures the cell shader reads with `texelFetch`.

import { BufferImageSource, Texture, type TextureSource } from 'pixi.js';
import type { BakeCanvas } from './texture-bake';

/** A sprite texture from a bake; the bake's element must be a real canvas in the browser. */
export function textureFromBake(bake: BakeCanvas): Texture {
  return Texture.from(bake.element as HTMLCanvasElement);
}

export interface DataTextureOptions {
  readonly width: number;
  readonly height: number;
  /** `nearest` for tables read with texelFetch, `linear` for the sampled noise tile. */
  readonly isFiltered: boolean;
  readonly isRepeating: boolean;
}

/** An RGBA8 table texture from bytes. */
export function byteDataTexture(bytes: Uint8Array, options: DataTextureOptions): TextureSource {
  return new BufferImageSource({
    resource: bytes,
    width: options.width,
    height: options.height,
    format: 'rgba8unorm',
    scaleMode: options.isFiltered ? 'linear' : 'nearest',
    addressMode: options.isRepeating ? 'repeat' : 'clamp-to-edge',
    autoGenerateMipmaps: false,
  });
}

/** An RGBA32F table texture the instance rows live in; `update()` re-uploads after a write. */
export function floatDataTexture(values: Float32Array, width: number, height: number): TextureSource {
  return new BufferImageSource({
    resource: values,
    width,
    height,
    format: 'rgba32float',
    scaleMode: 'nearest',
    addressMode: 'clamp-to-edge',
    autoGenerateMipmaps: false,
  });
}
