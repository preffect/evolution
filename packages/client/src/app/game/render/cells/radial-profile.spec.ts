// docs/RENDERING.md §9: r(θ) pinned per state against literal tables, r′ against a central
// difference, d(p) on a bump flank, the seeded rest profile's lobes, and same seed ⇒ same profile.

import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@evolution/shared';
import { degreesToRadians } from '../geometry';
import { buildNoiseStrip } from '../noise/noise-strip';
import {
  evaluateProfile,
  perpendicularDistance,
  sampleProfileRing,
  type RadialProfileTerms,
  type ShapeBump,
} from './radial-profile';

const RADIUS = 40;
const RAYS = 36;
const TEST_SEED = 42;

function restTerms(overrides: Partial<RadialProfileTerms> = {}): RadialProfileTerms {
  return {
    radius: RADIUS,
    pulse: 1,
    heading: 0,
    form: null,
    breathing: 0,
    wobble: { amplitude: 0, mode: 0, phase: 0 },
    strip: null,
    stretch: { k: 0, along: 1.22, taper: 0.72, acrossPerAlong: 0.6, axialAlong: 1, axialAcross: 1 },
    bumps: [],
    ...overrides,
  };
}

function bump(amplitude: number, centreDeg: number, sigmaDeg: number): ShapeBump {
  return { amplitude, centre: degreesToRadians(centreDeg), sigma: degreesToRadians(sigmaDeg) };
}

/** Sheet 03's engulf wrap frame: two arms at ±30° and the notch between them (#207 plays it). */
const ENGULF_WRAP: ShapeBump[] = [bump(0.62, 30, 16), bump(0.62, -30, 16), bump(-0.1, 0, 12)];

function stripTerms(row: number, phase = 0): RadialProfileTerms {
  const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
  return restTerms({ strip: { strip, row, phase, jitterAmplitude: 0.008, lobesScale: 1 } });
}

function ringAt(terms: RadialProfileTerms, degrees: number): number {
  return evaluateProfile(terms, degreesToRadians(degrees)).r / RADIUS;
}

describe('radial profile r(θ)', () => {
  it('is the unit circle at rest with lobes and jitter zeroed', () => {
    const ring = sampleProfileRing(restTerms(), RAYS);
    expect(ring).toHaveLength(RAYS);
    for (const value of ring) expect(value).toBeCloseTo(1, 9);
  });

  it.each([
    [1, 0, 1.22],
    [1, 90, 0.868],
    [1, 180, 0.72],
    [0.45, 0, 1.1],
    [0.45, 90, 0.94],
    [0.45, 180, 0.87],
  ])('stretches at k = %f to the sheet 01 values (Δ %d° → %f)', (speedRatio, delta, expected) => {
    const terms = restTerms({ stretch: { ...restTerms().stretch, k: speedRatio } });
    expect(ringAt(terms, delta)).toBeCloseTo(expected, 2);
  });

  it('measures the stretch from the heading, not from θ = 0', () => {
    const terms = restTerms({ heading: degreesToRadians(90), stretch: { ...restTerms().stretch, k: 1 } });
    expect(ringAt(terms, 90)).toBeCloseTo(1.22, 6);
    expect(ringAt(terms, -90)).toBeCloseTo(0.72, 6);
  });

  it('gives 1.616 at ±30° and 1.114 at 0° on the engulf wrap frame (§4)', () => {
    const terms = restTerms({ bumps: ENGULF_WRAP });
    expect(ringAt(terms, 30)).toBeCloseTo(1.616, 3);
    expect(ringAt(terms, -30)).toBeCloseTo(1.616, 3);
    expect(ringAt(terms, 0)).toBeCloseTo(1.114, 3);
  });

  it('dents −12 % at a contact angle and returns to 1 away from it', () => {
    const terms = restTerms({ bumps: [bump(-0.12, 90, 22)] });
    expect(ringAt(terms, 90)).toBeCloseTo(0.88, 6);
    expect(ringAt(terms, -90)).toBeCloseTo(1, 6);
  });

  it('scales the whole profile by the pulse and the axial stretch', () => {
    const terms = restTerms({ pulse: 1.09, stretch: { ...restTerms().stretch, axialAlong: 1.07, axialAcross: 0.95 } });
    expect(ringAt(terms, 0)).toBeCloseTo(1.09 * 1.07, 9);
    expect(ringAt(terms, 90)).toBeCloseTo(1.09 * 0.95, 9);
  });

  it('breathes and wobbles: mode m puts m crests around the ring', () => {
    const terms = restTerms({ breathing: 0.02, wobble: { amplitude: 0.08, mode: 2, phase: 0 } });
    expect(ringAt(terms, 45)).toBeCloseTo(1.1, 9);
    expect(ringAt(terms, 135)).toBeCloseTo(0.94, 9);
    expect(ringAt(terms, 225)).toBeCloseTo(1.1, 9);
  });

  it('pins r′(θ) against a central difference within 1e-4 r per rad on every state', () => {
    const states = [
      restTerms({ bumps: ENGULF_WRAP, stretch: { ...restTerms().stretch, k: 1 } }),
      restTerms({ wobble: { amplitude: 0.08, mode: 2, phase: 0.3 }, breathing: 0.02 }),
      stripTerms(3, 0.1),
    ];
    // The strip is piecewise linear between texel centres, so the rays sit a hair off them.
    const step = 1e-6;
    for (const terms of states) {
      for (let ray = 0; ray < RAYS; ray += 1) {
        const theta = (ray / RAYS) * 2 * Math.PI + 1e-3;
        const numeric = (evaluateProfile(terms, theta + step).r - evaluateProfile(terms, theta - step).r) / (2 * step);
        expect(Math.abs(evaluateProfile(terms, theta).derivative - numeric)).toBeLessThan(1e-4 * RADIUS);
      }
    }
  });

  it('reads a perpendicular distance shorter than the radial probe offset on a bump flank', () => {
    const terms = restTerms({ bumps: ENGULF_WRAP });
    const flank = degreesToRadians(30 + 18);
    const sample = evaluateProfile(terms, flank);
    expect(Math.abs(sample.derivative)).toBeGreaterThan(1);
    const offset = 4;
    const probeRadius = sample.r + offset;
    const distance = perpendicularDistance(terms, probeRadius * Math.cos(flank), probeRadius * Math.sin(flank));
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(offset);
  });

  it('places the membrane at d = 0 on a circle', () => {
    const terms = restTerms();
    expect(perpendicularDistance(terms, RADIUS, 0)).toBeCloseTo(0, 9);
    expect(perpendicularDistance(terms, 0, RADIUS + 2)).toBeCloseTo(2, 9);
  });

  it('gives a seeded rest profile 5–7 lobes within ±2.5–5 % of r', () => {
    const strip = buildNoiseStrip(createSeededRandom(TEST_SEED));
    for (let row = 0; row < strip.rows; row += 1) {
      const ring = sampleProfileRing(stripTerms(row), 360);
      const deviation = Math.max(...ring.map((value) => Math.abs(value - 1)));
      expect(strip.lobeCounts[row]).toBeGreaterThanOrEqual(5);
      expect(strip.lobeCounts[row]).toBeLessThanOrEqual(7);
      expect(deviation).toBeGreaterThanOrEqual(0.025);
      expect(deviation).toBeLessThanOrEqual(0.05);
    }
  });

  it('reproduces the same profile for the same seed and tick (DETERMINISM §7)', () => {
    const build = () => sampleProfileRing(stripTerms(5, 0.25), RAYS);
    expect(build()).toEqual(build());
    const other = buildNoiseStrip(createSeededRandom(TEST_SEED + 1));
    const otherRing = sampleProfileRing(
      restTerms({ strip: { strip: other, row: 5, phase: 0.25, jitterAmplitude: 0.008, lobesScale: 1 } }),
      RAYS,
    );
    expect(otherRing).not.toEqual(build());
  });
});
