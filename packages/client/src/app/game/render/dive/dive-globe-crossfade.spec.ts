// @vitest-environment node
// The planet's crossfade over the fallback globe (docs/rendering/opening-dive.md §4, ticket #805).

import { describe, expect, it } from 'vitest';
import { DiveGlobeCrossfade } from './dive-globe-crossfade';

const DIGITS = 9;

describe('DiveGlobeCrossfade', () => {
  const alphaOf = (subject: DiveGlobeCrossfade, nowMs: number, isPlanetReady: boolean, isMotionReduced = false) =>
    subject.alphaAt({ nowMs, isPlanetReady, isMotionReduced });

  it('shows the fallback while the planet bakes, then brings the planet up over 300 ms from its first frame', () => {
    const subject = new DiveGlobeCrossfade();
    expect(alphaOf(subject, 0, false)).toBe(0);
    expect(alphaOf(subject, 1000, false)).toBe(0);
    expect(alphaOf(subject, 1500, true)).toBe(0);
    expect(alphaOf(subject, 1575, true)).toBeCloseTo(0.25, DIGITS);
    expect(alphaOf(subject, 1650, true)).toBeCloseTo(0.5, DIGITS);
    expect(alphaOf(subject, 1800, true)).toBe(1);
    expect(alphaOf(subject, 5000, true)).toBe(1);
  });

  it('never fades back once the planet is up', () => {
    const subject = new DiveGlobeCrossfade();
    alphaOf(subject, 0, false);
    alphaOf(subject, 100, true);
    alphaOf(subject, 400, true);
    expect(alphaOf(subject, 401, true)).toBe(1);
    expect(alphaOf(subject, 10_000, true)).toBe(1);
  });

  it('shows a planet ready from the first frame at once: its bake was kept from an earlier open', () => {
    expect(alphaOf(new DiveGlobeCrossfade(), 0, true)).toBe(1);
  });

  it('brings the planet up at once under reduced motion', () => {
    const subject = new DiveGlobeCrossfade();
    alphaOf(subject, 0, false, true);
    expect(alphaOf(subject, 10, true, true)).toBe(1);
  });
});
