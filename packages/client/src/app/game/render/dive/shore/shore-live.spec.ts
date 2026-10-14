// @vitest-environment node
// The live sea (docs/rendering/opening-dive.md §4): the mockup's moving parts of `drawShore` worked out from the zoom
// and the clock — the breakers' march, the swell's and the ripples' fades, the glints' breathing.

import { describe, expect, it } from 'vitest';
import { SHORE_SEABED } from '../../constants/dive-shore';
import { SHORE_RIPPLES, SHORE_SURF, SHORE_SWELL } from '../../constants/dive-shore-live';
import { breakerReach, shoreLiveFrame, surfBreakers } from './shore-live';

describe('surfBreakers', () => {
  it('rolls four breakers in a quarter period apart, as the mockup’s `W` at T = 0', () => {
    const breakers = surfBreakers({ zoom: 1.5, pixelsPerMetre: 26, timeSeconds: 0 });
    expect(breakers).toHaveLength(SHORE_SURF.breakers);
    // ph = 0.75: d = 1.2 + 30 × 0.25^1.25, w = 0.16 + 0.75 × 0.5625, a = sin(0.75π)^0.8 × (0.25 + 0.6 × 0.75)
    const last = breakers[3]!;
    expect(last.distanceM).toBeCloseTo(1.2 + 30 * 0.25 ** 1.25, 9);
    expect(last.widthM).toBeCloseTo(0.16 + 0.75 * 0.5625, 9);
    expect(last.alpha).toBeCloseTo(Math.sin(0.75 * Math.PI) ** 0.8 * (0.25 + 0.6 * 0.75), 9);
    // ph = 0: far out and invisible
    expect(breakers[0]!.alpha).toBe(0);
  });

  it('drops a breaker narrower than half a pixel', () => {
    const far = surfBreakers({ zoom: 3.5, pixelsPerMetre: 0.2, timeSeconds: 4 });
    expect(far.every((breaker) => breaker.alpha === 0)).toBe(true);
  });

  it('brings each breaker in toward the shore as the clock runs', () => {
    const now = surfBreakers({ zoom: 1.5, pixelsPerMetre: 26, timeSeconds: 1 })[1]!;
    const later = surfBreakers({ zoom: 1.5, pixelsPerMetre: 26, timeSeconds: 2 })[1]!;
    expect(later.distanceM).toBeLessThan(now.distanceM);
  });
});

describe('breakerReach', () => {
  it('is the farthest a visible breaker paints, its widest wander and half its widest stroke', () => {
    const breakers = surfBreakers({ zoom: 1.5, pixelsPerMetre: 26, timeSeconds: 0 });
    const reach = breakerReach(breakers);
    for (const breaker of breakers.filter((candidate) => candidate.alpha > 0)) {
      expect(reach).toBeGreaterThanOrEqual(breaker.distanceM * (1 + SHORE_SURF.wander));
    }
    expect(breakerReach([])).toBe(0);
  });
});

describe('shoreLiveFrame', () => {
  it('fades the floor in under 2.9 and the swell between 3.4 and 2.9, out again near the blade', () => {
    expect(shoreLiveFrame({ zoom: 3.5, pixelsPerMetre: 0.3, timeSeconds: 0 }).floor.alpha).toBe(0);
    expect(shoreLiveFrame({ zoom: 2, pixelsPerMetre: 8, timeSeconds: 0 }).floor.alpha).toBeCloseTo(
      SHORE_SEABED.alpha,
      9,
    );
    expect(shoreLiveFrame({ zoom: 3.5, pixelsPerMetre: 0.3, timeSeconds: 0 }).swell.alpha).toBe(0);
    expect(shoreLiveFrame({ zoom: 2, pixelsPerMetre: 8, timeSeconds: 0 }).swell.alpha).toBeCloseTo(
      SHORE_SWELL.alpha,
      9,
    );
    expect(shoreLiveFrame({ zoom: -0.5, pixelsPerMetre: 2600, timeSeconds: 0 }).swell.alpha).toBe(0);
  });

  it('brings the ripples up as their tile grows past 70 px, and breathes the two glints against each other', () => {
    expect(shoreLiveFrame({ zoom: 3, pixelsPerMetre: 0.8, timeSeconds: 0 }).ripples[0]!.alpha).toBe(0);
    const close = shoreLiveFrame({ zoom: 0.5, pixelsPerMetre: 260, timeSeconds: 0.7 });
    expect(close.ripples[0]!.alpha).toBeCloseTo(SHORE_RIPPLES.sheets[0].alpha, 9);
    const [first, second] = close.glints;
    expect((first!.alpha + second!.alpha) / SHORE_RIPPLES.glints[0].alpha).toBeCloseTo(1, 9);
  });

  it('switches the close surf on at 3.6 and below', () => {
    expect(shoreLiveFrame({ zoom: 3.7, pixelsPerMetre: 0.2, timeSeconds: 0 }).isSurfOn).toBe(false);
    expect(shoreLiveFrame({ zoom: 3.6, pixelsPerMetre: 0.2, timeSeconds: 0 }).isSurfOn).toBe(true);
  });

  it('breathes the swash in and out about 0.45 m from the waterline', () => {
    const quarter = shoreLiveFrame({ zoom: 1, pixelsPerMetre: 80, timeSeconds: SHORE_SURF.periodSeconds / 4 });
    expect(quarter.swash.distanceM).toBeCloseTo(SHORE_SURF.swash.distanceM + SHORE_SURF.swash.breathM, 9);
  });
});
