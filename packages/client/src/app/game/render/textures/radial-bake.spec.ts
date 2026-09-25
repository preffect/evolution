// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bytesChecksum } from '../../../../testing/bytes';
import { ALPHA, BLUE, CHANNEL_MAX, GREEN, RED, hexToRgb } from '../colour';
import {
  BAND_EDGE_FADE,
  BAND_EDGE_FADE_ALPHA,
  BAND_EDGE_FADE_EDGE_STOP,
  BAND_EDGE_FADE_MID,
  BAND_EDGE_FADE_TEXTURE_PX,
  GLOW_TEXTURE_PX,
  VIGNETTE_ALPHA,
  VIGNETTE_RADIUS_FRACTION,
  VIGNETTE_TEXTURE_PX,
  WHITE,
} from '../constants';
import {
  BAND_EDGE_FADE_BAKE,
  RADIAL_BAKE_SHAPE,
  SOFT_DISC_BAKE,
  VIGNETTE_BAKE,
  bakeRadialBytes,
  radialPixelOffset,
  sampleRadialAlpha,
} from './radial-bake';

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

  // Taken from the sampler that allocated a `stops.slice(1)` per pixel (ticket #442): the two production bakes
  // must come out byte for byte as they did, or the dish is lit differently than every screenshot shows it.
  it('bakes the bytes the pre-#442 sampler did, for both production specs', () => {
    expect(bytesChecksum(bytes)).toBe('762f85a5');
    expect(bytesChecksum(bakeRadialBytes(SOFT_DISC_BAKE))).toBe('19264e25');
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

describe('bakeRadialBytes of the band edge ramp (#684)', () => {
  const size = BAND_EDGE_FADE_TEXTURE_PX;
  /** A pixel centre sits half a texel past its column's offset: at the ramp's steepest, about this many alpha bytes. */
  const halfTexelBytes = 12;
  const bytes = bakeRadialBytes(BAND_EDGE_FADE_BAKE);
  const columnAlphas = (y: number): number[] =>
    Array.from({ length: size }, (_unused, x) => alphaAt(bytes, size, x, y));

  it('rises from near clear at its left column to BAND_EDGE_FADE_ALPHA at the edge stop, then feathers back out', () => {
    const alphas = columnAlphas(0);
    const edgeColumn = Math.round(BAND_EDGE_FADE_EDGE_STOP * size);
    expect(alphas[0]).toBeLessThanOrEqual(halfTexelBytes);
    expect(Math.abs(alphas[edgeColumn]! - BAND_EDGE_FADE_ALPHA * CHANNEL_MAX)).toBeLessThanOrEqual(halfTexelBytes);
    for (let x = 1; x < edgeColumn; x += 1) expect(alphas[x]).toBeGreaterThanOrEqual(alphas[x - 1]!);
    for (let x = edgeColumn + 1; x < size; x += 1) expect(alphas[x]).toBeLessThanOrEqual(alphas[x - 1]!);
    expect(alphas.at(-1)).toBeLessThanOrEqual(halfTexelBytes);
  });

  it('eases in: at the middle stop column it is at that stop alpha, well under half the edge alpha', () => {
    const middleAlpha = alphaAt(bytes, size, Math.round(BAND_EDGE_FADE_MID.stop * size), 0);
    expect(Math.abs(middleAlpha - BAND_EDGE_FADE_MID.alpha * CHANNEL_MAX)).toBeLessThanOrEqual(halfTexelBytes);
    expect(BAND_EDGE_FADE_MID.alpha).toBeLessThan(BAND_EDGE_FADE_ALPHA / 2);
  });

  it('shades every row alike, in the field colour premultiplied', () => {
    expect(columnAlphas(size - 1)).toEqual(columnAlphas(0));
    const edge = radialPixelOffset(size, Math.round(BAND_EDGE_FADE_EDGE_STOP * size), size / 2);
    const alpha = bytes[edge + ALPHA]! / CHANNEL_MAX;
    const field = hexToRgb(BAND_EDGE_FADE);
    expect(bytes[edge + RED]).toBe(Math.round(field[RED] * alpha * CHANNEL_MAX));
    expect(bytes[edge + BLUE]).toBe(Math.round(field[BLUE] * alpha * CHANNEL_MAX));
  });
});

describe('the radial bake specs', () => {
  it('describe a glow-sized disc fading to clear and a vignette square clear inside the radius fraction', () => {
    expect(SOFT_DISC_BAKE.sizePx).toBe(GLOW_TEXTURE_PX);
    expect(SOFT_DISC_BAKE.shape).toBe(RADIAL_BAKE_SHAPE.disc);
    expect(SOFT_DISC_BAKE.stops[0]?.alpha).toBe(1);
    expect(SOFT_DISC_BAKE.stops.at(-1)?.alpha).toBe(0);
    expect(VIGNETTE_BAKE.sizePx).toBe(VIGNETTE_TEXTURE_PX);
    expect(VIGNETTE_BAKE.shape).toBe(RADIAL_BAKE_SHAPE.square);
    expect(VIGNETTE_BAKE.stops.map((stop) => stop.offset)).toEqual([0, VIGNETTE_RADIUS_FRACTION, 1]);
    expect(VIGNETTE_BAKE.stops.at(-1)?.alpha).toBe(VIGNETTE_ALPHA);
  });
});
