// @vitest-environment node
// The readout and the scale bar (docs/rendering/opening-dive.md §5): the mockup's `fmtLen`, `sup`, `LADDER` lookup
// and `drawScaleBar`, as pure functions of the zoom and the camera.

import { describe, expect, it } from 'vitest';
import { diveCameraAt } from './dive-camera';
import { diveReadout, diveScaleBar, formatDiveLength, nearestLadderPower, superscript } from './dive-readout';

describe('formatDiveLength', () => {
  it.each([
    [25_118_864, '25,119 km'],
    [1_000_000, '1,000 km'],
    [50_000, '50 km'],
    [2_000, '2 km'],
    [999.6, '1 km'],
    [316, '316 m'],
    [4, '4 m'],
    [0.5, '50 cm'],
    [0.063, '6.3 cm'],
    [0.01, '1 cm'],
    [0.0016, '1.6 mm'],
    [251e-6, '251 µm'],
    [50e-6, '50 µm'],
    [3.2e-6, '3.2 µm'],
    [631e-9, '631 nm'],
  ])('writes %s m as %s', (metres, text) => {
    expect(formatDiveLength(metres)).toBe(text);
  });

  it('falls back to exponent notation below a nanometre', () => {
    expect(formatDiveLength(2e-10)).toBe('2.0e-10 m');
  });
});

describe('superscript', () => {
  it('writes a power of ten as superscript digits', () => {
    expect(superscript(7)).toBe('⁷');
    expect(superscript(-4)).toBe('⁻⁴');
    expect(superscript(10)).toBe('¹⁰');
    expect(superscript(0)).toBe('⁰');
  });
});

describe('diveReadout', () => {
  it('names the field of view, its nearest power of ten and what fills the screen', () => {
    expect(diveReadout(-4.3)).toEqual({
      fieldOfView: '50 µm',
      powerOfTen: 'field of view ≈ 10⁻⁴ m',
      whatYouSee: 'The slime on the kelp’s cells. A pocket of clear water 40 µm across: the dish.',
    });
  });

  it('keeps to the ladder past its ends: the top reads the planet, the bottom reads you', () => {
    expect(nearestLadderPower(7.4)).toBe(7);
    expect(nearestLadderPower(-6.2)).toBe(-6);
    expect(diveReadout(-6.2).whatYouSee).toBe('One bacterium: you, at the start of the game.');
    expect(diveReadout(7.4).powerOfTen).toBe('field of view ≈ 10⁷ m');
  });
});

describe('diveScaleBar', () => {
  it('is the longest 5, 2 or 1 × 10ⁿ inside 18 % of the view', () => {
    const camera = diveCameraAt(3, { width: 1000, height: 500 });
    expect(diveScaleBar(camera)).toEqual({ lengthM: 100, widthPx: 100, text: '100 m' });
  });

  it('picks 5 × 10ⁿ and 2 × 10ⁿ when they fit', () => {
    expect(diveScaleBar(diveCameraAt(-4.3, { width: 1200, height: 675 })).text).toBe('5 µm');
    expect(diveScaleBar(diveCameraAt(4, { width: 1200, height: 675 })).text).toBe('1 km');
    expect(diveScaleBar(diveCameraAt(4.1, { width: 1200, height: 675 })).text).toBe('2 km');
  });
});
