import { describe, expect, it } from 'vitest';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED } from '../colour';
import { VIGNETTE_ALPHA, VIGNETTE_RADIUS_FRACTION, VIGNETTE_TEXTURE_PX, WHITE } from '../constants';
import { RADIAL_BAKE_SHAPE, SOFT_DISC_BAKE, VIGNETTE_BAKE } from '../render-textures';
import { bakeRadialBytes, radialPixelOffset, sampleRadialAlpha } from './radial-bake';

const alphaAt = (bytes: Uint8Array, sizePx: number, x: number, y: number): number =>
  bytes[radialPixelOffset(sizePx, x, y) + ALPHA]!;
const BYTE_TOLERANCE = 1;

describe('sampleRadialAlpha', () => {
  const stops = [
    { offset: 0, alpha: 0 },
    { offset: 0.5, alpha: 0 },
    { offset: 1, alpha: 0.8 },
  ];

  it('holds the first stop before it, interpolates between stops and holds the last stop past it', () => {
    expect(sampleRadialAlpha(stops, -0.2)).toBe(0);
    expect(sampleRadialAlpha(stops, 0.25)).toBe(0);
    expect(sampleRadialAlpha(stops, 0.75)).toBeCloseTo(0.4, 10);
    expect(sampleRadialAlpha(stops, 1)).toBe(0.8);
    expect(sampleRadialAlpha(stops, 1.5)).toBe(0.8);
  });

  it('is clear with no stops and takes the alpha of a stop it lands on exactly', () => {
    expect(sampleRadialAlpha([], 0.5)).toBe(0);
    expect(sampleRadialAlpha(stops, 0.5)).toBe(0);
    expect(sampleRadialAlpha(stops, 0)).toBe(0);
  });
});

describe('bakeRadialBytes of the vignette (#229)', () => {
  const size = VIGNETTE_TEXTURE_PX;
  const bytes = bakeRadialBytes(VIGNETTE_BAKE);
  const middle = size / 2;
  const cornerAlpha = Math.round(VIGNETTE_ALPHA * CHANNEL_MAX);

  it('leaves the centre untouched: alpha 0 at the middle and along the edge middles, inside the clear radius', () => {
    expect(VIGNETTE_RADIUS_FRACTION).toBeGreaterThan(1 / Math.SQRT2);
    expect(alphaAt(bytes, size, middle, middle)).toBe(0);
    expect(alphaAt(bytes, size, size - 1, middle)).toBe(0);
    expect(alphaAt(bytes, size, middle, 0)).toBe(0);
  });

  it('reaches VIGNETTE_ALPHA at the four corners and part of it on the way there', () => {
    for (const [x, y] of [
      [0, 0],
      [size - 1, 0],
      [0, size - 1],
      [size - 1, size - 1],
    ] as const) {
      expect(Math.abs(alphaAt(bytes, size, x, y) - cornerAlpha)).toBeLessThanOrEqual(BYTE_TOLERANCE);
    }
    const partWayOffset = (VIGNETTE_RADIUS_FRACTION + 1) / 2;
    const partWay = Math.round(middle + partWayOffset * middle);
    const partWayAlpha = alphaAt(bytes, size, partWay, partWay);
    expect(partWayAlpha).toBeGreaterThan(0);
    expect(partWayAlpha).toBeLessThan(cornerAlpha);
  });

  it('is black in every channel (premultiplied black stays black)', () => {
    const corner = radialPixelOffset(size, 0, 0);
    expect([bytes[corner + RED], bytes[corner + GREEN], bytes[corner + BLUE]]).toEqual([0, 0, 0]);
  });
});

describe('bakeRadialBytes of the soft disc', () => {
  const size = 32;
  const middle = size / 2;
  const bytes = bakeRadialBytes({ ...SOFT_DISC_BAKE, sizePx: size });
  const nearOpaque = Math.round(CHANNEL_MAX * 0.95);
  const nearClear = Math.round(CHANNEL_MAX * 0.05);

  it('is near-opaque white at the centre pixels, near-clear at the rim and clear outside the inscribed disc', () => {
    expect(alphaAt(bytes, size, middle, middle)).toBeGreaterThanOrEqual(nearOpaque);
    expect(alphaAt(bytes, size, size - 1, middle)).toBeLessThan(nearClear);
    expect(alphaAt(bytes, size, 0, 0)).toBe(0);
    expect(alphaAt(bytes, size, 2, 2)).toBe(0);
  });

  it('premultiplies the colour by the alpha', () => {
    const quarter = radialPixelOffset(size, size / 4, middle);
    const alpha = bytes[quarter + ALPHA]!;
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(CHANNEL_MAX);
    expect(bytes[quarter + RED]).toBe(alpha);
    expect(bytes[quarter + GREEN]).toBe(alpha);
    expect(bytes[quarter + BLUE]).toBe(alpha);
  });

  it('shades a square bake out to its corners where a disc is clipped', () => {
    const ramp = [
      { offset: 0, alpha: 0 },
      { offset: 1, alpha: 1 },
    ];
    const square = bakeRadialBytes({ sizePx: size, shape: RADIAL_BAKE_SHAPE.square, colour: WHITE, stops: ramp });
    const disc = bakeRadialBytes({ sizePx: size, shape: RADIAL_BAKE_SHAPE.disc, colour: WHITE, stops: ramp });
    expect(alphaAt(square, size, 0, 0)).toBeGreaterThanOrEqual(nearOpaque);
    expect(alphaAt(disc, size, 0, 0)).toBe(0);
    expect(alphaAt(square, size, size - 1, middle)).toBe(alphaAt(disc, size, size - 1, middle));
  });
});
