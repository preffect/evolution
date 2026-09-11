import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory } from '../../../../testing/fake-bake-canvas';
import { createOnePixelTexture } from '../../../../testing/fake-pixi-app';
import { byteDataTexture, floatDataTexture, textureFromBake, texturesFromBakes } from './pixi-textures';

describe('pixi textures', () => {
  it('refuses a bake with no DOM canvas behind it', () => {
    const bake = createFakeBakeCanvasFactory().create(4, 4);
    expect(() => textureFromBake(bake)).toThrow(/DOM canvas/);
  });

  it('maps every bake of a record to a texture under the same key', () => {
    const factory = createFakeBakeCanvasFactory();
    const bakes = { a: factory.create(1, 1), b: factory.create(2, 2) };
    const converted: unknown[] = [];
    const textures = texturesFromBakes(bakes, (bake) => {
      converted.push(bake);
      return createOnePixelTexture();
    });
    expect(Object.keys(textures)).toEqual(['a', 'b']);
    expect(converted).toEqual([bakes.a, bakes.b]);
    expect(textures.a).not.toBe(textures.b);
  });

  it('uploads bytes as an RGBA8 source with the filtering and wrap the caller asked for', () => {
    const table = byteDataTexture(new Uint8Array(4 * 2), {
      width: 2,
      height: 1,
      isFiltered: false,
      isRepeating: false,
      hasMipmaps: false,
    });
    expect([table.width, table.height, table.format]).toEqual([2, 1, 'rgba8unorm']);
    expect(table.autoGenerateMipmaps).toBe(false);
    expect(table.style.scaleMode).toBe('nearest');
    expect(table.style.addressMode).toBe('clamp-to-edge');
    expect(table.alphaMode).toBe('no-premultiply-alpha');
    const tile = byteDataTexture(new Uint8Array(4), {
      width: 1,
      height: 1,
      isFiltered: true,
      isRepeating: true,
      hasMipmaps: true,
    });
    expect(tile.style.scaleMode).toBe('linear');
    expect(tile.style.addressMode).toBe('repeat');
    expect(tile.autoGenerateMipmaps).toBe(true);
    expect(tile.style.mipmapFilter).toBe('linear');
    expect(tile.alphaMode).toBe('no-premultiply-alpha');
    table.destroy();
    tile.destroy();
  });

  it('uploads floats as an RGBA32F table read with texelFetch, re-uploadable in place', () => {
    const values = new Float32Array(4 * 3 * 2);
    const table = floatDataTexture(values, 3, 2);
    expect([table.width, table.height, table.format]).toEqual([3, 2, 'rgba32float']);
    expect(table.style.scaleMode).toBe('nearest');
    expect(table.style.addressMode).toBe('clamp-to-edge');
    expect(table.alphaMode).toBe('no-premultiply-alpha');
    expect(table.resource).toBe(values);
    table.destroy();
  });
});
