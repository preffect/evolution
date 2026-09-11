// docs/RENDERING.md §9: the HSL derivations of sheet 01 and the separability numbers of VISUAL-STYLE §2.

import { describe, expect, it } from 'vitest';
import { DNA_TAGS, PLAYER_PALETTE_COUNT, SEAT_MARK_BEADS } from '@evolution/shared';
import { DEUTAN_MATRIX, PROTAN_MATRIX, contrastRatio, hexDeltaE } from '../../../testing/colour-difference';
import { hexToRgb } from './colour';
import {
  BASE_MIN_CONTRAST,
  BG_FIELD,
  DNA_TAG_COLOR,
  NEW_PALETTE_INDEX,
  NEW_PALETTE_MIN_DELTA_E,
  PALETTE_PAIR_MIN_DELTA_E,
  PALETTE_SHADE,
  PALETTE_SHADE_COUNT,
  PLAYER_PALETTE_TABLE,
  RIM_MIN_CONTRAST,
  TAG_PAIR_MIN_DELTA_E,
} from './constants';
import { PLAYER_PALETTES, bakePaletteTextureBytes, newPaletteAccents, paletteFor, paletteShades } from './palette';

/** Sheet 01's derived shades (edge, cyto light, cyto dark, nucleus dark) for the six drawn palettes. */
const SHEET_01_DERIVED: [string, [string, string, string, string]][] = [
  ['Cyan', ['#124e56', '#1d636c', '#102426', '#167787']],
  ['Magenta', ['#5b194b', '#72255f', '#291424', '#8c176e']],
  ['Amber', ['#5d4312', '#75571d', '#292111', '#88650f']],
  ['Lime', ['#355512', '#456a1c', '#1b2610', '#568314']],
  ['Violet', ['#27127a', '#381f98', '#1b1435', '#2809ad']],
  ['Coral', ['#8a1307', '#ac2113', '#3b1511', '#a91c09']],
];
/** Rounding through HSL and back moves a channel by at most this many of 255. */
const CHANNEL_TOLERANCE = 4 / 255;

function expectClose(actual: string, expected: string): void {
  const actualRgb = hexToRgb(actual);
  const expectedRgb = hexToRgb(expected);
  for (let channel = 0; channel < 3; channel += 1) {
    expect(Math.abs(actualRgb[channel]! - expectedRgb[channel]!)).toBeLessThanOrEqual(CHANNEL_TOLERANCE);
  }
}

function pairs<T>(items: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  items.forEach((first, firstIndex) => {
    items.slice(firstIndex + 1).forEach((second) => out.push([first, second]));
  });
  return out;
}

describe('player palettes', () => {
  it('has one palette per seat and one bead count per palette', () => {
    expect(PLAYER_PALETTES).toHaveLength(PLAYER_PALETTE_COUNT);
    expect(SEAT_MARK_BEADS).toHaveLength(PLAYER_PALETTE_COUNT);
    expect(PLAYER_PALETTES.map((palette) => palette.name)).toEqual([
      'Cyan',
      'Coral',
      'Lime',
      'Violet',
      'Amber',
      'Mint',
      'Magenta',
      'Rose',
    ]);
  });

  it.each(SHEET_01_DERIVED)('derives %s shades by the sheet 01 HSL rule', (name, expected) => {
    const palette = PLAYER_PALETTES.find((row) => row.name === name)!;
    expectClose(palette.edge, expected[0]);
    expectClose(palette.cytoLight, expected[1]);
    expectClose(palette.cytoDark, expected[2]);
    expectClose(palette.nucleusDark, expected[3]);
  });

  it.each(['Mint', 'Rose'])('%s takes rim and nucleus from its base hue (the new-palette rule)', (name) => {
    const palette = PLAYER_PALETTES.find((row) => row.name === name)!;
    const accents = newPaletteAccents(palette.base);
    expectClose(palette.rim, accents.rim);
    expectClose(palette.nucleus, accents.nucleus);
  });

  it('wraps the avatar index into the palette table', () => {
    expect(paletteFor(0).name).toBe('Cyan');
    expect(paletteFor(PLAYER_PALETTE_COUNT + 1).name).toBe('Coral');
    expect(paletteFor(-1).name).toBe('Rose');
  });

  it('bakes an 8 × 8 RGBA texture in shade order with the chloroplast base last', () => {
    const bytes = bakePaletteTextureBytes();
    expect(bytes).toHaveLength(PLAYER_PALETTE_COUNT * PALETTE_SHADE_COUNT * 4);
    const shades = paletteShades(PLAYER_PALETTES[0]!);
    expect(shades[PALETTE_SHADE.base]).toBe(PLAYER_PALETTE_TABLE[0]!.base);
    const [red, green, blue] = hexToRgb(PLAYER_PALETTE_TABLE[1]!.rim);
    const offset = (1 * PALETTE_SHADE_COUNT + PALETTE_SHADE.rim) * 4;
    expect([bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]]).toEqual([
      Math.round(red * 255),
      Math.round(green * 255),
      Math.round(blue * 255),
      255,
    ]);
  });
});

describe('separability (VISUAL-STYLE §2 acceptance)', () => {
  const bases = PLAYER_PALETTE_TABLE.map((row) => row.base);

  it('holds every base pair at or above PALETTE_PAIR_MIN_DELTA_E, with Coral–Rose the nearest at 18', () => {
    const deltas = pairs(PLAYER_PALETTE_TABLE).map(([first, second]) => ({
      names: [first.name, second.name].sort(),
      delta: hexDeltaE(first.base, second.base),
    }));
    const worst = deltas.reduce((low, row) => (row.delta < low.delta ? row : low));
    expect(worst.delta).toBeGreaterThanOrEqual(PALETTE_PAIR_MIN_DELTA_E);
    expect(worst.names).toEqual(['Coral', 'Rose']);
    expect(Math.round(worst.delta)).toBe(18);
  });

  it('holds Rose against every other base under normal, deutan and protan vision', () => {
    const rose = bases[NEW_PALETTE_INDEX]!;
    let minimum = Infinity;
    bases.forEach((base, index) => {
      if (index === NEW_PALETTE_INDEX) return;
      for (const matrix of [null, DEUTAN_MATRIX, PROTAN_MATRIX]) {
        minimum = Math.min(minimum, hexDeltaE(rose, base, matrix));
      }
    });
    expect(minimum).toBeGreaterThanOrEqual(NEW_PALETTE_MIN_DELTA_E);
    expect(Math.round(minimum)).toBe(18);
  });

  it('holds every DNA tag pair at or above TAG_PAIR_MIN_DELTA_E, with motile–armored the nearest at 21', () => {
    const rows = pairs(DNA_TAGS).map(([first, second]) => ({
      names: [first, second].sort(),
      delta: hexDeltaE(DNA_TAG_COLOR[first], DNA_TAG_COLOR[second]),
    }));
    const worst = rows.reduce((low, row) => (row.delta < low.delta ? row : low));
    expect(worst.delta).toBeGreaterThanOrEqual(TAG_PAIR_MIN_DELTA_E);
    expect(worst.names).toEqual(['armored', 'motile']);
    expect(Math.round(worst.delta)).toBe(21);
  });

  it('keeps every rim ≥ 4.5:1 (measured 10.7–16.4) and every base ≥ 4.0 against the field', () => {
    for (const row of PLAYER_PALETTE_TABLE) {
      const rim = contrastRatio(row.rim, BG_FIELD);
      expect(rim).toBeGreaterThanOrEqual(RIM_MIN_CONTRAST);
      expect(rim).toBeGreaterThanOrEqual(10.7 - 0.05);
      expect(rim).toBeLessThanOrEqual(16.4 + 0.05);
      expect(contrastRatio(row.base, BG_FIELD)).toBeGreaterThanOrEqual(BASE_MIN_CONTRAST);
    }
  });
});
