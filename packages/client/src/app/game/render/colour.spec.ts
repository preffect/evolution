import { describe, expect, it } from 'vitest';
import {
  hexToNumber,
  hexToRgb,
  hexWithAlpha,
  hslToRgb,
  linearToSrgb,
  rgbToHex,
  rgbToHsl,
  srgbToLinear,
} from './colour';

describe('colour conversions', () => {
  it('round-trips hex through rgb and hsl', () => {
    for (const hex of ['#22c1d6', '#ff6b5c', '#000000', '#ffffff', '#7b5cf0', '#808080']) {
      expect(rgbToHex(hexToRgb(hex))).toBe(hex);
      expect(rgbToHex(hslToRgb(rgbToHsl(hexToRgb(hex))))).toBe(hex);
    }
  });

  it('folds a negative or over-turn hue before placing it', () => {
    expect(hslToRgb({ hue: -120, saturation: 1, lightness: 0.5 })).toEqual(
      hslToRgb({ hue: 240, saturation: 1, lightness: 0.5 }),
    );
    expect(hslToRgb({ hue: 480, saturation: 1, lightness: 0.5 })).toEqual(
      hslToRgb({ hue: 120, saturation: 1, lightness: 0.5 }),
    );
  });

  it('reads hue sectors for red-, green- and blue-dominant colours', () => {
    expect(rgbToHsl([1, 0, 0]).hue).toBe(0);
    expect(rgbToHsl([0, 1, 0]).hue).toBe(120);
    expect(rgbToHsl([0, 0, 1]).hue).toBe(240);
    expect(rgbToHsl([0.5, 0.5, 0.5]).saturation).toBe(0);
  });

  it('formats Pixi tints and css rgba strings', () => {
    expect(hexToNumber('#ff5470')).toBe(0xff5470);
    expect(hexWithAlpha('#ff5470', 0.5)).toBe('rgba(255, 84, 112, 0.5)');
  });

  it('round-trips the sRGB transfer function', () => {
    for (const value of [0, 0.002, 0.2, 0.5, 1]) expect(linearToSrgb(srgbToLinear(value))).toBeCloseTo(value, 6);
    expect(linearToSrgb(2)).toBeCloseTo(1, 9);
  });
});
