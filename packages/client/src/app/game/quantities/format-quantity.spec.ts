// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { unbroken } from '../../../testing/unbroken-quantity';
import { formatQuantity, formatQuantityParts } from './format-quantity';
import {
  COMPACT_FROM,
  NO_BREAK_SPACE,
  QUANTITY_PRESENTATION,
  QUANTITY_ROUNDING,
  QUANTITY_UNIT,
  QUANTITY_UNIT_FORMAT,
  type QuantityPresentation,
  type QuantityRounding,
  type QuantityUnit,
} from './quantity-unit';

const { plain, signedChange, changeFromOne, rateFromDuration, numeral, countdown } = QUANTITY_PRESENTATION;
const { nearest, floor, ceil } = QUANTITY_ROUNDING;

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
  [QUANTITY_UNIT.shareOfItsMass]: 0.025,
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
  [QUANTITY_UNIT.shareOfItsMass]: ['3 % of its mass', '+3 % of its mass', '3', '2.5 % of its mass'],
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
    const [plainText, signedText, numeralText, countdownText] = EXPECTED_BY_UNIT[unit].map(unbroken);
    expect(formatQuantity(value, unit)).toBe(plainText);
    expect(formatQuantity(value, unit, { presentation: plain })).toBe(plainText);
    expect(formatQuantity(value, unit, { presentation: signedChange })).toBe(signedText);
    expect(formatQuantity(value, unit, { presentation: numeral })).toBe(numeralText);
    expect(formatQuantity(value, unit, { presentation: countdown })).toBe(countdownText);
  });

  it.each(UNITS)('reads a multiplier change on %s as a signed share, whatever the unit', (unit) => {
    expect(formatQuantity(1.15, unit, { presentation: changeFromOne })).toBe(unbroken('+15 %'));
    expect(formatQuantity(0.85, unit, { presentation: changeFromOne })).toBe(unbroken('−15 %'));
    expect(formatQuantity(0.61, unit, { presentation: rateFromDuration })).toBe(unbroken('+64 %'));
    expect(formatQuantity(1.25, unit, { presentation: rateFromDuration })).toBe(unbroken('−20 %'));
    expect(formatQuantity(1.159, unit, { presentation: changeFromOne, rounding: floor })).toBe(unbroken('+15 %'));
  });

  it('writes the typographic minus for a negative figure, and no sign at all on a numeral', () => {
    expect(formatQuantity(-0.5, QUANTITY_UNIT.seconds, { presentation: signedChange })).toBe(unbroken('−0.5 s'));
    expect(formatQuantity(-0.5, QUANTITY_UNIT.seconds)).toBe(unbroken('−0.5 s'));
    expect(formatQuantity(-0.1, QUANTITY_UNIT.share)).toBe(unbroken('−10 %'));
    expect(formatQuantity(-3.25, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe(unbroken('−3.3 s'));
    expect(formatQuantity(-40, QUANTITY_UNIT.mass, { presentation: numeral })).toBe('40');
  });

  it('signs zero as a gain in a change and not at all in a plain figure', () => {
    expect(formatQuantity(0, QUANTITY_UNIT.mass, { presentation: signedChange })).toBe(unbroken('+0 mass'));
    expect(formatQuantity(0, QUANTITY_UNIT.mass)).toBe(unbroken('0 mass'));
  });

  it('rounds to the unit’s decimals and drops trailing zeros, except a countdown, which keeps its one decimal', () => {
    expect(formatQuantity(0.5, QUANTITY_UNIT.dna)).toBe(unbroken('0.5 DNA'));
    expect(formatQuantity(1.0, QUANTITY_UNIT.seconds)).toBe(unbroken('1 s'));
    expect(formatQuantity(0.3333, QUANTITY_UNIT.massPerSecond)).toBe(unbroken('0.33 mass / s'));
    expect(formatQuantity(40, QUANTITY_UNIT.worldUnitsPerSecond)).toBe(unbroken('40 u/s'));
    expect(formatQuantity(0.0749, QUANTITY_UNIT.share)).toBe(unbroken('7 %'));
    expect(formatQuantity(123.6, QUANTITY_UNIT.points, { presentation: numeral })).toBe('124');
    expect(formatQuantity(6.5, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe(unbroken('6.5 s'));
    expect(formatQuantity(0, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe(unbroken('0.0 s'));
    expect(formatQuantity(15, QUANTITY_UNIT.seconds, { presentation: countdown })).toBe(unbroken('15.0 s'));
  });

  it('rounds down where asked, and to the nearest otherwise, in every form', () => {
    expect(formatQuantity(0.629, QUANTITY_UNIT.share, { rounding: floor })).toBe(unbroken('62 %'));
    expect(formatQuantity(0.629, QUANTITY_UNIT.share, { rounding: nearest })).toBe(unbroken('63 %'));
    expect(formatQuantity(0.339, QUANTITY_UNIT.massPerSecond, { rounding: floor })).toBe(unbroken('0.33 mass / s'));
    expect(formatQuantity(6.59, QUANTITY_UNIT.seconds, { presentation: countdown, rounding: floor })).toBe(
      unbroken('6.5 s'),
    );
    expect(formatQuantity(59.99, QUANTITY_UNIT.clock)).toBe('0:59');
    expect(formatQuantity(59.99, QUANTITY_UNIT.clock, { rounding: nearest })).toBe('1:00');
    expect(formatQuantity(2.9, QUANTITY_UNIT.tier, { rounding: floor })).toBe(unbroken('Tier II'));
  });

  it('rounds up where asked, never past a figure that is whole but for float noise', () => {
    expect(formatQuantity(1126.25, QUANTITY_UNIT.mass, { rounding: ceil })).toBe(unbroken('1127 mass'));
    expect(formatQuantity(1126.25, QUANTITY_UNIT.mass)).toBe(unbroken('1126 mass'));
    expect(formatQuantity(0.621, QUANTITY_UNIT.share, { rounding: ceil })).toBe(unbroken('63 %'));
    expect(formatQuantity(1.1 * 3, QUANTITY_UNIT.dna, { rounding: ceil })).toBe(unbroken('3.3 DNA'));
    expect(formatQuantity(0.1 + 0.2, QUANTITY_UNIT.share, { rounding: ceil })).toBe(unbroken('30 %'));
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
    expect(formatQuantity(1, QUANTITY_UNIT.tier)).toBe(unbroken('Tier I'));
    expect(() => formatQuantity(4, QUANTITY_UNIT.tier)).toThrow(/tier 4/);
    expect(() => formatQuantity(0, QUANTITY_UNIT.tier)).toThrow(/tier 0/);
  });

  it('reads a shown magnitude of exactly one in the singular, and every other one in the plural', () => {
    expect(formatQuantity(1, QUANTITY_UNIT.radii)).toBe(unbroken('1 radius'));
    expect(formatQuantity(-1, QUANTITY_UNIT.radii, { presentation: signedChange })).toBe(unbroken('−1 radius'));
    expect(formatQuantity(1.001, QUANTITY_UNIT.radii)).toBe(unbroken('1 radius'));
    expect(formatQuantity(1.5, QUANTITY_UNIT.radii)).toBe(unbroken('1.5 radii'));
    expect(formatQuantity(0, QUANTITY_UNIT.radii)).toBe(unbroken('0 radii'));
    expect(formatQuantity(1, QUANTITY_UNIT.points)).toBe(unbroken('1 point'));
    expect(formatQuantity(2, QUANTITY_UNIT.points)).toBe(unbroken('2 points'));
    expect(formatQuantity(1, QUANTITY_UNIT.mass)).toBe(unbroken('1 mass'));
  });

  it('never writes a breaking space, so a line never breaks between a number and its unit', () => {
    for (const unit of UNITS) {
      for (const presentation of PRESENTATIONS) {
        for (const rounding of ROUNDINGS) {
          const text = formatQuantity(VALUE_BY_UNIT[unit], unit, { presentation, rounding });
          expect(text, `${unit} ${presentation} ${rounding}`).not.toContain(' ');
        }
      }
    }
    expect(formatQuantity(0.3, QUANTITY_UNIT.massPerSecond, { presentation: signedChange })).toBe(
      `+0.3${NO_BREAK_SPACE}mass${NO_BREAK_SPACE}/${NO_BREAK_SPACE}s`,
    );
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

/** Every unit's header form, as a tier table's row name carries it (#858): unitless units carry none. */
const EXPECTED_HEADER_BY_UNIT: Readonly<Record<QuantityUnit, string>> = {
  [QUANTITY_UNIT.mass]: 'mass',
  [QUANTITY_UNIT.dna]: 'DNA',
  [QUANTITY_UNIT.worldUnits]: 'u',
  [QUANTITY_UNIT.worldUnitsPerSecond]: 'u/s',
  [QUANTITY_UNIT.seconds]: 's',
  [QUANTITY_UNIT.clock]: '',
  [QUANTITY_UNIT.massPerSecond]: 'mass / s',
  [QUANTITY_UNIT.share]: '%',
  [QUANTITY_UNIT.shareOfItsMass]: '% of its mass',
  [QUANTITY_UNIT.sharePerSecond]: '% / s',
  [QUANTITY_UNIT.multiplier]: '×',
  [QUANTITY_UNIT.radii]: 'radii',
  [QUANTITY_UNIT.count]: '',
  [QUANTITY_UNIT.points]: 'points',
  [QUANTITY_UNIT.level]: 'Level',
  [QUANTITY_UNIT.tier]: 'Tier',
};

describe('formatQuantityParts', () => {
  it.each(UNITS)('heads %s with its plural unit, whatever the value', (unit) => {
    for (const value of [1, VALUE_BY_UNIT[unit]]) {
      expect(formatQuantityParts(value, unit).unit, `${unit} ${value}`).toBe(unbroken(EXPECTED_HEADER_BY_UNIT[unit]));
    }
  });

  it('keeps the sign on the figure and leaves the unit off it', () => {
    expect(formatQuantityParts(0.3, QUANTITY_UNIT.massPerSecond, { presentation: signedChange })).toEqual({
      figure: '+0.3',
      unit: unbroken('mass / s'),
    });
    expect(formatQuantityParts(-0.5, QUANTITY_UNIT.seconds)).toEqual({ figure: '−0.5', unit: 's' });
    expect(formatQuantityParts(1, QUANTITY_UNIT.radii)).toEqual({ figure: '1', unit: 'radii' });
    expect(formatQuantityParts(0.62, QUANTITY_UNIT.share)).toEqual({ figure: '62', unit: '%' });
  });

  it('reads a multiplier change as a signed share, as formatQuantity does', () => {
    expect(formatQuantityParts(0.85, QUANTITY_UNIT.multiplier, { presentation: changeFromOne })).toEqual({
      figure: '−15',
      unit: '%',
    });
    expect(formatQuantityParts(0.61, QUANTITY_UNIT.multiplier, { presentation: rateFromDuration })).toEqual({
      figure: '+64',
      unit: '%',
    });
  });

  it('writes the figure formatQuantity writes, in every suffixed unit, presentation and rounding', () => {
    // A prefixed unit writes its sign before the prefix (`−Level 3`), so its figure is not one run of that text.
    for (const unit of UNITS.filter((candidate) => QUANTITY_UNIT_FORMAT[candidate].prefix === '')) {
      for (const presentation of PRESENTATIONS) {
        for (const rounding of ROUNDINGS) {
          const options = { presentation, rounding };
          const { figure } = formatQuantityParts(-VALUE_BY_UNIT[unit], unit, options);
          expect(formatQuantity(-VALUE_BY_UNIT[unit], unit, options), `${unit} ${presentation} ${rounding}`).toContain(
            figure,
          );
        }
      }
    }
    expect(formatQuantityParts(-2, QUANTITY_UNIT.tier, { presentation: numeral })).toEqual({
      figure: 'II',
      unit: 'Tier',
    });
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
