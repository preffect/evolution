// docs/RENDERING.md §9: lag 0.20 r at k = 1; the mapping equals the profile on the rim.
import { describe, expect, it } from 'vitest';
import { NUCLEUS_LAG } from '../constants';
import { degreesToRadians } from '../geometry';
import { laggedSlot, mapSlot } from './organelle-mapper';
import { evaluateProfile, type RadialProfileTerms } from './radial-profile';

const terms: RadialProfileTerms = {
  radius: 40,
  pulse: 1,
  heading: 0,
  breathing: 0,
  wobble: { amplitude: 0, mode: 0, phase: 0 },
  strip: null,
  stretch: { k: 1, along: 1.22, taper: 0.72, acrossPerAlong: 0.6, axialAlong: 1, axialAcross: 1 },
  bumps: [{ amplitude: 0.62, centre: degreesToRadians(30), sigma: degreesToRadians(16) }],
};

describe('laggedSlot', () => {
  it('lags 0.20 r against the heading at full speed and not at rest', () => {
    const moving = laggedSlot(0, 0, { speedRatio: 1, heading: 0, driftX: 0, driftY: 0 });
    expect(moving.x).toBeCloseTo(-NUCLEUS_LAG, 9);
    expect(moving.y).toBeCloseTo(0, 9);
    const resting = laggedSlot(0.1, 0.2, { speedRatio: 0, heading: 1, driftX: 0.01, driftY: -0.01 });
    expect(resting.x).toBeCloseTo(0.11, 9);
    expect(resting.y).toBeCloseTo(0.19, 9);
  });
});

describe('mapSlot', () => {
  it('equals the profile on the rim and scales linearly inside', () => {
    const theta = degreesToRadians(30);
    const rim = mapSlot(Math.cos(theta), Math.sin(theta), terms);
    const profile = evaluateProfile(terms, theta).r;
    expect(Math.hypot(rim.x, rim.y)).toBeCloseTo(profile, 9);
    expect(rim.localRadius).toBeCloseTo(profile, 9);
    const half = mapSlot(Math.cos(theta) / 2, Math.sin(theta) / 2, terms);
    expect(Math.hypot(half.x, half.y)).toBeCloseTo(profile / 2, 9);
  });

  it('maps the centre to the centre', () => {
    expect(mapSlot(0, 0, terms)).toMatchObject({ x: 0, y: 0 });
  });
});
