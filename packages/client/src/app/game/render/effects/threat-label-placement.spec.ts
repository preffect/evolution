import { describe, expect, it } from 'vitest';
import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import {
  ENGULF_WARNING_RING_MIN_PX,
  ENGULF_WARNING_RING_RADII,
  LABEL_PILL_HEIGHT_PX,
  THREAT_LABEL_GAP_PX,
} from '../constants';
import { HALF } from '../geometry';
import { ladderOrbitExtentPx } from './own-cell-geometry';
import { UPRIGHT, threatLabelPlacement, type ThreatLabelInput } from './threat-label-placement';

/** docs/RENDERING.md §10's case: a 30 px predator, the own cell at the 1080p spawn size. */
const PREDATOR_RADIUS_PX = 30;
const OWN_RADIUS_PX = 32;
const WARNING_RING_PX = Math.max(ENGULF_WARNING_RING_RADII * PREDATOR_RADIUS_PX, ENGULF_WARNING_RING_MIN_PX);
/** About `AMOEBOID CAN ENGULF YOU` in the `label` role with its pads; the drawing measures the real text. */
const PILL_WIDTH_PX = 190;
const OFFSET_PX = WARNING_RING_PX + THREAT_LABEL_GAP_PX + LABEL_PILL_HEIGHT_PX * HALF;
const ORIGIN = { x: 0, y: 0 };
const DIRECTIONS = 16;

function placeWithThreatAt(x: number, y: number): ReturnType<typeof threatLabelPlacement> {
  const input: ThreatLabelInput = {
    threatCentre: { x, y },
    warningRingPx: WARNING_RING_PX,
    ownCentre: ORIGIN,
    ownRadiusPx: OWN_RADIUS_PX,
    pillWidthPx: PILL_WIDTH_PX,
  };
  return threatLabelPlacement(input);
}

describe('threatLabelPlacement', () => {
  it('sits on the side of the ring facing the own cell when the threat is 200 px away', () => {
    const placement = placeWithThreatAt(0, -200);
    expect(placement.isFarSide).toBe(false);
    expect(placement.x).toBeCloseTo(0);
    expect(placement.y).toBeCloseTo(-200 + OFFSET_PX);
  });

  it('moves to the far side of the ring at 100 px, where the near side would cover the orbit', () => {
    const placement = placeWithThreatAt(0, -100);
    expect(placement.isFarSide).toBe(true);
    expect(placement.y).toBeCloseTo(-100 - OFFSET_PX);
  });

  it('tests the pill’s whole box, not its centre: a wide pill beside the cell flips where one above does not', () => {
    // At 200 px straight across, the pill's centre is well clear of the orbit but its near end is not.
    const across = placeWithThreatAt(200, 0);
    expect(Math.abs(200 - OFFSET_PX) - PILL_WIDTH_PX * HALF).toBeLessThan(ladderOrbitExtentPx(OWN_RADIUS_PX));
    expect(across.isFarSide).toBe(true);
    expect(across.x).toBeCloseTo(200 + OFFSET_PX);
  });

  it.each([200, 100])('is upright and on the ring’s label radius at every angle at %s px', (distancePx) => {
    for (let step = 0; step < DIRECTIONS; step += 1) {
      const angle = (step / DIRECTIONS) * RADIANS_PER_FULL_TURN;
      const threat = { x: Math.cos(angle) * distancePx, y: Math.sin(angle) * distancePx };
      const placement = placeWithThreatAt(threat.x, threat.y);
      expect(placement.rotation).toBe(UPRIGHT);
      expect(Math.hypot(placement.x - threat.x, placement.y - threat.y)).toBeCloseTo(OFFSET_PX);
    }
  });

  it('still places a label when the threat’s centre is exactly on the own cell’s', () => {
    const placement = placeWithThreatAt(0, 0);
    expect(Number.isFinite(placement.x) && Number.isFinite(placement.y)).toBe(true);
    expect(Math.hypot(placement.x, placement.y)).toBeCloseTo(OFFSET_PX);
  });
});
