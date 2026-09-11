import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import {
  BACTERIUM_BAKE,
  BACTERIUM_BANDS,
  BACTERIUM_HALO_ALPHA,
  CHLORO_LIGHT,
  MITO_BASE,
  PROTO_FILM,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { bakeBacteriumRod } from './bacterium-bake';

const RADIUS_PX = 32;

describe('bakeBacteriumRod', () => {
  const rod = (variant: (typeof BACTERIUM_VARIANT)[keyof typeof BACTERIUM_VARIANT]) =>
    bakeBacteriumRod(createFakeBakeCanvasFactory(), variant, RADIUS_PX);

  it('sizes the canvas to the halo reach around the collision radius', () => {
    expect(rod(BACTERIUM_VARIANT.plain).width).toBe(Math.ceil(RADIUS_PX * BACTERIUM_BAKE.haloReach * 2));
  });

  it('layers halo, body, sheen, rim and glint on every rod; the photosynthetic one adds its bands', () => {
    const plainLayers = 5;
    expect(fakeContextOf(rod(BACTERIUM_VARIANT.plain)).paintCount).toBe(plainLayers);
    expect(fakeContextOf(rod(BACTERIUM_VARIANT.aerobic)).paintCount).toBe(plainLayers);
    expect(fakeContextOf(rod(BACTERIUM_VARIANT.photosynthetic)).paintCount).toBe(plainLayers + BACTERIUM_BANDS);
  });

  it('draws the rod as two caps joined by straight sides, twice (fill, then rim)', () => {
    const context = fakeContextOf(rod(BACTERIUM_VARIANT.plain));
    expect(context.count('arc')).toBe(1 + 4);
    expect(context.count('closePath')).toBe(2);
    expect(context.lineWidth).toBeCloseTo(RADIUS_PX * BACTERIUM_BAKE.rimWidthShare, 9);
  });

  it('colours each variant from the food table: film, mitochondrion, chloroplast', () => {
    const halo = (variant: (typeof BACTERIUM_VARIANT)[keyof typeof BACTERIUM_VARIANT]) =>
      fakeContextOf(rod(variant)).gradients[0]!.stops[0]!.colour;
    expect(halo(BACTERIUM_VARIANT.plain)).toBe(hexWithAlpha(PROTO_FILM, BACTERIUM_BAKE.plainHaloAlpha));
    expect(halo(BACTERIUM_VARIANT.aerobic)).toBe(hexWithAlpha(MITO_BASE, BACTERIUM_HALO_ALPHA));
    expect(halo(BACTERIUM_VARIANT.photosynthetic)).toBe(hexWithAlpha(CHLORO_LIGHT, BACTERIUM_HALO_ALPHA));
  });
});
