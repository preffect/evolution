import { describe, expect, it } from 'vitest';
import { formatQuantity } from './format-quantity';
import {
  QUANTITY_PRESENTATION,
  QUANTITY_UNIT,
  QUANTITY_UNIT_FORMAT,
  type QuantityPresentation,
  type QuantityUnit,
} from './quantity-unit';

const { plain, signedChange, changeFromOne, rateFromDuration, countdown } = QUANTITY_PRESENTATION;

/** Every unit at 2.5 (0.025 for the shares), plain / signed / countdown. */
const EXPECTED_BY_UNIT: Readonly<
  Record<QuantityUnit, readonly [value: number, plain: string, signed: string, countdown: string]>
> = {
  [QUANTITY_UNIT.mass]: [2.5, '2.5 mass', '+2.5 mass', '2.5 mass'],
  [QUANTITY_UNIT.dna]: [2.5, '2.5 DNA', '+2.5 DNA', '2.5 DNA'],
  [QUANTITY_UNIT.worldUnits]: [2.5, '2.5 u', '+2.5 u', '2.5 u'],
  [QUANTITY_UNIT.worldUnitsPerSecond]: [2.5, '2.5 u/s', '+2.5 u/s', '2.5 u/s'],
  [QUANTITY_UNIT.seconds]: [2.5, '2.5 s', '+2.5 s', '2.5 s'],
  [QUANTITY_UNIT.massPerSecond]: [2.5, '2.5 mass / s', '+2.5 mass / s', '2.5 mass / s'],
  [QUANTITY_UNIT.share]: [0.025, '3 %', '+3 %', '2.5 %'],
  [QUANTITY_UNIT.sharePerSecond]: [0.025, '3 % / s', '+3 % / s', '2.5 % / s'],
  [QUANTITY_UNIT.multiplier]: [2.5, '2.5×', '+2.5×', '2.5×'],
  [QUANTITY_UNIT.radii]: [2.5, '2.5 radii', '+2.5 radii', '2.5 radii'],
  [QUANTITY_UNIT.count]: [2.5, '3', '+3', '2.5'],
  [QUANTITY_UNIT.points]: [2.5, '3 points', '+3 points', '2.5 points'],
  [QUANTITY_UNIT.level]: [2.5, 'Level 3', '+Level 3', 'Level 2.5'],
};

const UNITS = Object.values(QUANTITY_UNIT);

describe('QUANTITY_UNIT_FORMAT', () => {
  it('has a format for exactly the units, so a new unit without one fails here', () => {
    expect(Object.keys(QUANTITY_UNIT_FORMAT).sort()).toEqual([...UNITS].sort());
  });
});

describe('formatQuantity', () => {
  it.each(UNITS)('formats %s plain, as a signed change and as a countdown', (unit) => {
    const [value, plainText, signedText, countdownText] = EXPECTED_BY_UNIT[unit];
    expect(formatQuantity(value, unit)).toBe(plainText);
    expect(formatQuantity(value, unit, plain)).toBe(plainText);
    expect(formatQuantity(value, unit, signedChange)).toBe(signedText);
    expect(formatQuantity(value, unit, countdown)).toBe(countdownText);
  });

  it.each(UNITS)('reads a multiplier change on %s as a signed share, whatever the unit', (unit) => {
    expect(formatQuantity(1.15, unit, changeFromOne)).toBe('+15 %');
    expect(formatQuantity(0.85, unit, changeFromOne)).toBe('−15 %');
    expect(formatQuantity(0.61, unit, rateFromDuration)).toBe('+64 %');
    expect(formatQuantity(1.25, unit, rateFromDuration)).toBe('−20 %');
  });

  it('writes the typographic minus for a negative figure in every presentation', () => {
    expect(formatQuantity(-0.5, QUANTITY_UNIT.seconds, signedChange)).toBe('−0.5 s');
    expect(formatQuantity(-0.5, QUANTITY_UNIT.seconds, plain)).toBe('−0.5 s');
    expect(formatQuantity(-0.1, QUANTITY_UNIT.share, plain)).toBe('−10 %');
    expect(formatQuantity(-3.25, QUANTITY_UNIT.seconds, countdown)).toBe('−3.3 s');
  });

  it('signs zero as a gain in a change and not at all in a plain figure', () => {
    expect(formatQuantity(0, QUANTITY_UNIT.mass, signedChange)).toBe('+0 mass');
    expect(formatQuantity(0, QUANTITY_UNIT.mass, plain)).toBe('0 mass');
  });

  it('rounds to the unit’s decimals and drops trailing zeros, except a countdown, which keeps its one decimal', () => {
    expect(formatQuantity(0.5, QUANTITY_UNIT.mass)).toBe('0.5 mass');
    expect(formatQuantity(1.0, QUANTITY_UNIT.seconds)).toBe('1 s');
    expect(formatQuantity(0.3333, QUANTITY_UNIT.massPerSecond)).toBe('0.33 mass / s');
    expect(formatQuantity(40, QUANTITY_UNIT.worldUnitsPerSecond)).toBe('40 u/s');
    expect(formatQuantity(0.0749, QUANTITY_UNIT.share)).toBe('7 %');
    expect(formatQuantity(6.5, QUANTITY_UNIT.seconds, countdown)).toBe('6.5 s');
    expect(formatQuantity(0, QUANTITY_UNIT.seconds, countdown)).toBe('0.0 s');
    expect(formatQuantity(15, QUANTITY_UNIT.seconds, countdown)).toBe('15.0 s');
  });

  it('reads a shown magnitude of exactly one in the singular, and every other one in the plural', () => {
    expect(formatQuantity(1, QUANTITY_UNIT.radii)).toBe('1 radius');
    expect(formatQuantity(-1, QUANTITY_UNIT.radii, signedChange)).toBe('−1 radius');
    expect(formatQuantity(1.001, QUANTITY_UNIT.radii)).toBe('1 radius');
    expect(formatQuantity(1.5, QUANTITY_UNIT.radii)).toBe('1.5 radii');
    expect(formatQuantity(0, QUANTITY_UNIT.radii)).toBe('0 radii');
    expect(formatQuantity(1, QUANTITY_UNIT.points)).toBe('1 point');
    expect(formatQuantity(2, QUANTITY_UNIT.points)).toBe('2 points');
    expect(formatQuantity(1, QUANTITY_UNIT.mass)).toBe('1 mass');
  });

  it('never writes undefined or NaN for any unit and presentation', () => {
    const presentations = Object.values(QUANTITY_PRESENTATION) as QuantityPresentation[];
    for (const unit of UNITS) {
      for (const presentation of presentations) {
        expect(formatQuantity(0.75, unit, presentation), `${unit} ${presentation}`).not.toMatch(/undefined|NaN/);
      }
    }
  });
});
