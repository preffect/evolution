// The sprint ring's coordinate and the escape rule (docs/UI.md §3.1.2, docs/RENDERING.md §10). The
// turn is the one a wrong sign or a wrong zero would silently move, so it is pinned at the clock
// positions a player reads, in the renderer's y-down world frame.

import { describe, expect, it } from 'vitest';
import { entityId } from '@evolution/shared';
import { SELF_RING_ALPHA } from '../constants';
import { FULL_SELF_RING, REST_OWN_CELL_RING, isWarningRingHidden, selfRingTurnsFromTwelve } from './self-ring';

/** Clock positions around the centre in world units, y down the screen. */
const CLOCK = {
  twelve: { x: 0, y: -1 },
  three: { x: 1, y: 0 },
  six: { x: 0, y: 1 },
  nine: { x: -1, y: 0 },
} as const;

describe('selfRingTurnsFromTwelve', () => {
  it('is 0 at 12 o’clock and runs clockwise: a quarter at 3, a half at 6, three quarters at 9', () => {
    expect(selfRingTurnsFromTwelve(CLOCK.twelve.x, CLOCK.twelve.y)).toBeCloseTo(0, 12);
    expect(selfRingTurnsFromTwelve(CLOCK.three.x, CLOCK.three.y)).toBeCloseTo(0.25, 12);
    expect(selfRingTurnsFromTwelve(CLOCK.six.x, CLOCK.six.y)).toBeCloseTo(0.5, 12);
    expect(selfRingTurnsFromTwelve(CLOCK.nine.x, CLOCK.nine.y)).toBeCloseTo(0.75, 12);
  });

  it('puts a 40 % fill’s arc over the right-hand side: 1 o’clock is lit, 11 o’clock is track', () => {
    const fill = 0.4;
    const oneOClock = selfRingTurnsFromTwelve(Math.sin(Math.PI / 6), -Math.cos(Math.PI / 6));
    const elevenOClock = selfRingTurnsFromTwelve(-Math.sin(Math.PI / 6), -Math.cos(Math.PI / 6));
    expect(oneOClock).toBeCloseTo(1 / 12, 12);
    expect(oneOClock).toBeLessThan(fill);
    expect(elevenOClock).toBeCloseTo(11 / 12, 12);
    expect(elevenOClock).toBeGreaterThan(fill);
  });

  it('stays in [0, 1) all the way round', () => {
    for (let step = 0; step < 72; step += 1) {
      const angle = (step / 72) * 2 * Math.PI;
      const turns = selfRingTurnsFromTwelve(Math.cos(angle), Math.sin(angle));
      expect(turns).toBeGreaterThanOrEqual(0);
      expect(turns).toBeLessThan(1);
    }
  });
});

describe('the own-cell ring', () => {
  it('rests as a full ring at the self ring’s own alpha, hiding no warning ring', () => {
    expect(REST_OWN_CELL_RING).toEqual({
      fill: FULL_SELF_RING,
      brightness: SELF_RING_ALPHA,
      escapePredatorCellId: null,
      shouldHidePredatorRing: false,
    });
    expect(isWarningRingHidden(entityId('anyone'), REST_OWN_CELL_RING)).toBe(false);
  });

  it('with the switch on, hides the warning ring of the escape’s predator only', () => {
    const escaping = {
      ...REST_OWN_CELL_RING,
      escapePredatorCellId: entityId('predator'),
      shouldHidePredatorRing: true,
    };
    expect(isWarningRingHidden(entityId('predator'), escaping)).toBe(true);
    expect(isWarningRingHidden(entityId('bystander'), escaping)).toBe(false);
  });

  it('with the switch off (until the escape arc draws, #187), hides no ring, the predator’s included', () => {
    const escaping = {
      ...REST_OWN_CELL_RING,
      escapePredatorCellId: entityId('predator'),
      shouldHidePredatorRing: false,
    };
    expect(isWarningRingHidden(entityId('predator'), escaping)).toBe(false);
    expect(isWarningRingHidden(entityId('bystander'), escaping)).toBe(false);
  });
});
