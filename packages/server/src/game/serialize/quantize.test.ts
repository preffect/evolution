// docs/architecture/wire-contract.md §4 "Wire precision" (#341): the wire rounding helpers.
import { describe, expect, it } from 'vitest';
import { EXACT_SNAPSHOT_VALUES, WIRE_SNAPSHOT_VALUES, quantizeToDecimals, snapshotValue } from './quantize.js';

const DECIMAL_BASE = 10;
/** Values a snapshot really carries: a starting radius, a grown mass, a score with float residue, a velocity. */
const SAMPLES = [17.88854381999832, 689.1834400023941, 1877.2600000000025, -154.60933274, 0.049, 5000, 0];
/** Decimals past the precomputed scales still round, through the power. */
const BEYOND_PRECOMPUTED_DECIMALS = 6;

describe('quantizeToDecimals', () => {
  it('rounds to the given number of decimals', () => {
    expect(quantizeToDecimals(1234.56789, 0)).toBe(1235);
    expect(quantizeToDecimals(1234.56789, 1)).toBe(1234.6);
    expect(quantizeToDecimals(1234.56789, 2)).toBe(1234.57);
    expect(quantizeToDecimals(-12.34, 1)).toBe(-12.3);
    expect(quantizeToDecimals(1.23456789, BEYOND_PRECOMPUTED_DECIMALS)).toBe(1.234568);
  });

  it('writes no more digits after the point than it was given', () => {
    for (const decimals of [0, 1, 2]) {
      for (const value of SAMPLES) {
        const fraction = JSON.stringify(quantizeToDecimals(value, decimals)).split('.')[1] ?? '';
        expect(fraction.length).toBeLessThanOrEqual(decimals);
      }
    }
  });

  it('is never further from the value than half a step, and rounding twice changes nothing', () => {
    for (const decimals of [0, 1, 2]) {
      const halfStep = DECIMAL_BASE ** -decimals / 2;
      for (const value of SAMPLES) {
        const rounded = quantizeToDecimals(value, decimals);
        expect(Math.abs(rounded - value)).toBeLessThanOrEqual(halfStep + Number.EPSILON * Math.abs(value));
        expect(quantizeToDecimals(rounded, decimals)).toBe(rounded);
      }
    }
  });

  it('writes a value that rounds to zero from below as 0 on the wire', () => {
    expect(JSON.stringify(quantizeToDecimals(-0.04, 1))).toBe('0');
  });
});

describe('snapshotValue', () => {
  it('rounds on the wire and returns every value unchanged when exact, whatever the decimals', () => {
    for (const value of SAMPLES) {
      expect(snapshotValue(value, 1, WIRE_SNAPSHOT_VALUES)).toBe(quantizeToDecimals(value, 1));
      expect(snapshotValue(value, 0, EXACT_SNAPSHOT_VALUES)).toBe(value);
    }
  });
});
