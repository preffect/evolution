// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { formatQuantity } from './format-quantity';
import {
  COMPACT_FROM,
  QUANTITY_PRESENTATION,
  QUANTITY_ROUNDING,
  QUANTITY_UNIT,
  QUANTITY_UNIT_FORMAT,
  type QuantityPresentation,
  type QuantityRounding,
  type QuantityUnit,
} from './quantity-unit';

const { plain, signedChange, changeFromOne, rateFromDuration, numeral, countdown } = QUANTITY_PRESENTATION;
const { nearest, floor } = QUANTITY_ROUNDING;

type Expected = readonly [plain: string, signed: string, numeral: string, countdown: string];

/** Every unit at `VALUE_BY_UNIT`, in the four presentations that keep the unit (the multiplier changes are below). */
const VALUE_BY_UNIT: Readonly<Record<QuantityUnit, number>> = {
  [QUANTITY_UNIT.mass]: 2.5,
  [QUANTITY_UNIT.dna]: 2.5,
  [QUANTITY_UNIT.worldUnits]: 2.5,
  [QUANTITY_UNIT.worldUnitsPerSecond]: 2.5,
  [QUANTITY_UNIT.seconds]: 2.5,
  [QUANTITY_UNIT.clock]: 62.5,
  [QUANTITY_UNIT.massPerSecond]: 2.5,
  [QUANTITY_UNIT.share]: 0.025,
  [QUANTITY_UNIT.sharePerSecond]: 0.025,
  [QUANTITY_UNIT.multiplier]: 2.5,
  [QUANTITY_UNIT.radii]: 2.5,
  [QUANTITY_UNIT.count]: 2.5,
  [QUANTITY_UNIT.points]: 2.5,
  [QUANTITY_UNIT.level]: 2.5,
  [QUANTITY_UNIT.tier]: 2,
};

const EXPECTED_BY_UNIT: Readonly<Record<QuantityUnit, Expected>> = {
  [QUANTITY_UNIT.mass]: ['3 mass', '+3 mass', '3', '2.5 mass'],
  [QUANTITY_UNIT.dna]: ['2.5 DNA', '+2.5 DNA', '2.5', '2.5 DNA'],
  [QUANTITY_UNIT.worldUnits]: ['2.5 u', '+2.5 u', '2.5', '2.5 u'],
  [QUANTITY_UNIT.worldUnitsPerSecond]: ['2.5 u/s', '+2.5 u/s', '2.5', '2.5 u/s'],
  [QUANTITY_UNIT.seconds]: ['2.5 s', '+2.5 s', '2.5', '2.5 s'],
  [QUANTITY_UNIT.clock]: ['1:02', '+1:02', '1:02', '1:02'],
  [QUANTITY_UNIT.massPerSecond]: ['2.5 mass / s', '+2.5 mass / s', '2.5', '2.5 mass / s'],
  [QUANTITY_UNIT.share]: ['3 %', '+3 %', '3', '2.5 %'],
  [QUANTITY_UNIT.sharePerSecond]: ['3 % / s', '+3 % / s', '3', '2.5 % / s'],
  [QUANTITY_UNIT.multiplier]: ['2.5×', '+2.5×', '2.5', '2.5×'],
  [QUANTITY_UNIT.radii]: ['2.5 radii', '+2.5 radii', '2.5', '2.5 radii'],
  [QUANTITY_UNIT.count]: ['3', '+3', '3', '2.5'],
  [QUANTITY_UNIT.points]: ['3 points', '+3 points', '3', '2.5 points'],
  [QUANTITY_UNIT.level]: ['Level 3', '+Level 3', '3', 'Level 2.5'],
  [QUANTITY_UNIT.tier]: ['Tier II', '+Tier II', 'II', 'Tier II'],
};

const UNITS = Object.values(QUANTITY_UNIT);
const PRESENTATIONS: readonly QuantityPresentation[] = Object.values(QUANTITY_PRESENTATION);
const ROUNDINGS: readonly QuantityRounding[] = Object.values(QUANTITY_ROUNDING);

describe('QUANTITY_UNIT_FORMAT', () => {
  it('has a format for exactly the units, so a new unit without one fails here', () => {
    expect(Object.keys(QUANTITY_UNIT_FORMAT).sort()).toEqual([...UNITS].sort());
  });
});

describe('formatQuantity', () => {
  it.each(UNITS)('formats %s plain, as a signed change, as a numeral and as a countdown', (unit) => {
    const value = VALUE_BY_UNIT[unit];
    const [plainText, signedText, numeralText, countdownText] = EXPECTED_BY_UNIT[unit];
    expect(formatQuantity(value, unit)).toBe(plainText);
    expect(formatQuantity(value, unit, { presentation: plain })).toBe(plainText);
    expect(formatQuantity(value, unit, { presentation: signedChange })).toBe(signedText);
    expect(formatQuantity(value, unit, { presentation: numeral })).toBe(numeralText);
    expect(formatQuantity(value, unit, { presentation: countdown })).toBe(countdownText);
  });

  it.each(UNITS)('reads a multiplier change on %s as a signed share, whatever the unit', (unit) => {
    expect(formatQuantity(1.15, unit, { presentation: changeFromOne })).toBe('+15 %');
    expect(formatQuantity(0.85, unit, { presentation: changeFromOne })).toBe('−15 %');
    expect(formatQuantity(0.61, unit, { presentation: rateFromDuration })).toBe('+64 %');
    expect(formatQuantity(1.25, unit, { presentation: rateFromDuration })).toBe('−20 %');
    expect(formatQuantity(1.159, unit, { presentation: changeFromOne, rounding: floor })).toBe('+15 %');
  });

  it('writes the typographic minus for a negative figure, and no sign at all on a numeral', () => {
    expect(formatQuantity(-0.5, QUANTITY_UNIT.seconds, { presentation: signedChange })).toBe('−0.5 s');
    expect(formatQuantity(-0.5, QUANTITY_UNIT.seconds)).toBe('−0.5 s');
    expect(formatQuantity(-0.1, QUANTITY_UNIT.share)).toBe('−10 %');
    expect(formatQuantity(-3.25, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe('−3.3 s');
    expect(formatQuantity(-40, QUANTITY_UNIT.mass, { presentation: numeral })).toBe('40');
  });

  it('signs zero as a gain in a change and not at all in a plain figure', () => {
    expect(formatQuantity(0, QUANTITY_UNIT.mass, { presentation: signedChange })).toBe('+0 mass');
    expect(formatQuantity(0, QUANTITY_UNIT.mass)).toBe('0 mass');
  });

  it('rounds to the unit’s decimals and drops trailing zeros, except a countdown, which keeps its one decimal', () => {
    expect(formatQuantity(0.5, QUANTITY_UNIT.dna)).toBe('0.5 DNA');
    expect(formatQuantity(1.0, QUANTITY_UNIT.seconds)).toBe('1 s');
    expect(formatQuantity(0.3333, QUANTITY_UNIT.massPerSecond)).toBe('0.33 mass / s');
    expect(formatQuantity(40, QUANTITY_UNIT.worldUnitsPerSecond)).toBe('40 u/s');
    expect(formatQuantity(0.0749, QUANTITY_UNIT.share)).toBe('7 %');
    expect(formatQuantity(123.6, QUANTITY_UNIT.points, { presentation: numeral })).toBe('124');
    expect(formatQuantity(6.5, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe('6.5 s');
    expect(formatQuantity(0, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe('0.0 s');
    expect(formatQuantity(15, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe('15.0 s');
  });

  it('rounds down where asked, and to the nearest otherwise, in every form', () => {
    expect(formatQuantity(0.629, QUANTITY_UNIT.share, { rounding: floor })).toBe('62 %');
    expect(formatQuantity(0.629, QUANTITY_UNIT.share, { rounding: nearest })).toBe('63 %');
    expect(formatQuantity(0.339, QUANTITY_UNIT.massPerSecond, { rounding: floor })).toBe('0.33 mass / s');
    expect(formatQuantity(6.59, QUANTITY_UNIT.seconds, { presentation: countdown, rounding: floor })).toBe('6.5 s');
    expect(formatQuantity(59.99, QUANTITY_UNIT.clock)).toBe('0:59');
    expect(formatQuantity(59.99, QUANTITY_UNIT.clock, { rounding: nearest })).toBe('1:00');
    expect(formatQuantity(2.9, QUANTITY_UNIT.tier, { rounding: floor })).toBe('Tier II');
  });

  it('writes the clock as m:ss, minutes unpadded and seconds always two digits', () => {
    expect(formatQuantity(0, QUANTITY_UNIT.clock)).toBe('0:00');
    expect(formatQuantity(9, QUANTITY_UNIT.clock)).toBe('0:09');
    expect(formatQuantity(60, QUANTITY_UNIT.clock)).toBe('1:00');
    expect(formatQuantity(462, QUANTITY_UNIT.clock)).toBe('7:42');
  });

  it('names every tier by its numeral and refuses a tier past them', () => {
    expect([1, 2, 3].map((tier) => formatQuantity(tier, QUANTITY_UNIT.tier, { presentation: numeral }))).toEqual([
      'I',
      'II',
      'III',
    ]);
    expect(formatQuantity(1, QUANTITY_UNIT.tier)).toBe('Tier I');
    expect(() => formatQuantity(4, QUANTITY_UNIT.tier)).toThrow(/tier 4/);
    expect(() => formatQuantity(0, QUANTITY_UNIT.tier)).toThrow(/tier 0/);
  });

  it('reads a shown magnitude of exactly one in the singular, and every other one in the plural', () => {
    expect(formatQuantity(1, QUANTITY_UNIT.radii)).toBe('1 radius');
    expect(formatQuantity(-1, QUANTITY_UNIT.radii, { presentation: signedChange })).toBe('−1 radius');
    expect(formatQuantity(1.001, QUANTITY_UNIT.radii)).toBe('1 radius');
    expect(formatQuantity(1.5, QUANTITY_UNIT.radii)).toBe('1.5 radii');
    expect(formatQuantity(0, QUANTITY_UNIT.radii)).toBe('0 radii');
    expect(formatQuantity(1, QUANTITY_UNIT.points)).toBe('1 point');
    expect(formatQuantity(2, QUANTITY_UNIT.points)).toBe('2 points');
    expect(formatQuantity(1, QUANTITY_UNIT.mass)).toBe('1 mass');
  });

  it('never writes undefined or NaN for any unit, presentation and rounding', () => {
    for (const unit of UNITS) {
      for (const presentation of PRESENTATIONS) {
        for (const rounding of ROUNDINGS) {
          const text = formatQuantity(VALUE_BY_UNIT[unit], unit, { presentation, rounding });
          expect(text, `${unit} ${presentation} ${rounding}`).not.toMatch(/undefined|NaN/);
        }
      }
    }
  });
});

/** The leaderboard's score column holds five characters (docs/ui/hud.md §3.1.1). */
const SCORE_COLUMN_CHARACTERS = 5;

describe('formatQuantity, compact', () => {
  const compact = (value: number): string =>
    formatQuantity(value, QUANTITY_UNIT.points, { presentation: QUANTITY_PRESENTATION.compact });

  it(`keeps every figure below ${COMPACT_FROM} whole, and shortens from there, rounding the short form down`, () => {
    expect(compact(99_999)).toBe('99999');
    expect(compact(123.6)).toBe('124');
    expect(compact(COMPACT_FROM)).toBe('100k');
    expect(compact(123_456)).toBe('123k');
    expect(compact(999_999)).toBe('999k');
    expect(compact(1_000_000)).toBe('1M');
    expect(compact(1_299_999)).toBe('1.2M');
    expect(compact(12_345_678)).toBe('12.3M');
  });

  it('never writes wider than the score column below 100 million, far past any reachable score', () => {
    for (const score of [99_999, 100_000, 999_999, 1_000_000, 9_999_999, 99_999_999]) {
      expect(compact(score).length).toBeLessThanOrEqual(SCORE_COLUMN_CHARACTERS);
    }
  });
});
