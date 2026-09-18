import { BitmapFont } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { createFakeBakeCanvasFactory } from '../../../testing/fake-bake-canvas';
import { ALPHA, CHANNEL_MAX } from './colour';
import { VIGNETTE_ALPHA, VIGNETTE_TEXTURE_PX } from './constants';
import { createPixiTextureBaker } from './pixi-texture-baker';
import { VIGNETTE_BAKE } from './textures/radial-bake';
import { indicatorFontInstalls, indicatorFontNamesFor } from './textures/bitmap-fonts';
import { radialPixelOffset } from './textures/radial-bake';

const BYTE_TOLERANCE = 1;

describe('createPixiTextureBaker', () => {
  it('bakes the vignette as a texture that is clear at the centre and VIGNETTE_ALPHA at the corner (#229)', () => {
    const texture = createPixiTextureBaker(createFakeBakeCanvasFactory()).bakeRadial(VIGNETTE_BAKE);
    const size = VIGNETTE_TEXTURE_PX;
    expect(texture.width).toBe(size);
    expect(texture.height).toBe(size);
    const bytes = texture.source.resource as Uint8Array;
    const middle = size / 2;
    expect(bytes[radialPixelOffset(size, middle, middle) + ALPHA]).toBe(0);
    const corner = bytes[radialPixelOffset(size, size - 1, size - 1) + ALPHA]!;
    expect(Math.abs(corner - Math.round(VIGNETTE_ALPHA * CHANNEL_MAX))).toBeLessThanOrEqual(BYTE_TOLERANCE);
    expect(texture.source.alphaMode).toBe('premultiplied-alpha');
    texture.destroy(true);
  });

  it('hands out the wrapped factory canvases', () => {
    const canvases = createFakeBakeCanvasFactory();
    const baker = createPixiTextureBaker(canvases);
    const bake = baker.create(3, 2);
    expect(canvases.canvases).toEqual([bake]);
    expect(bake.width).toBe(3);
  });

  it("installs and uninstalls the indicator fonts through Pixi's BitmapFont, with the spec's fields", () => {
    const install = vi.spyOn(BitmapFont, 'install').mockReturnValue(undefined as never);
    const uninstall = vi.spyOn(BitmapFont, 'uninstall').mockReturnValue(undefined);
    const baker = createPixiTextureBaker(createFakeBakeCanvasFactory());
    const [value] = indicatorFontInstalls(2, indicatorFontNamesFor(1));
    baker.installBitmapFont(value!);
    expect(install).toHaveBeenCalledWith({
      name: value!.name,
      style: value!.style,
      chars: value!.chars,
      resolution: value!.resolution,
      padding: value!.padding,
    });
    baker.uninstallBitmapFont(value!.name);
    expect(uninstall).toHaveBeenCalledWith(value!.name);
    install.mockRestore();
    uninstall.mockRestore();
  });
});
