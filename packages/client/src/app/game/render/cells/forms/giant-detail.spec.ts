// @vitest-environment node
// The detail a form gains at giant size (#828; docs/ecology/giants.md §3.5.11): the oral groove's arc runs from the
// outline's notch to the mouth and bows toward the notch's side, the contractile vacuoles fill slowly and empty at
// once with their canals full only while emptied, and the diatom's rings carry a pore every spacing.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  DIATOM_PORE_FIRST_RADII,
  DIATOM_PORE_ROWS,
  DIATOM_PORE_SPACING_RADII,
  GIANT_DIATOM_RING_PORE_RADIUS_RADII,
  GIANT_DIATOM_RING_PORE_SPACING_RADII,
  GIANT_ORAL_GROOVE_BOW_RADII,
  GIANT_ORAL_GROOVE_END,
  GIANT_ORAL_GROOVE_START_RADII,
  GIANT_VACUOLE_CYCLE_SECONDS,
  GIANT_VACUOLE_EMPTY_SCALE,
  GIANT_VACUOLE_FILL_SHARE,
  SLIPPER_ORAL_GROOVE_DEG,
} from '../../constants';
import { HALF, degreesToRadians } from '../../geometry';
import {
  ORAL_GROOVE_START,
  canalFullness,
  grooveShare,
  oralGrooveArc,
  ringPoreCount,
  vacuoleScale,
} from './giant-detail';

const PRECISION = 9;

describe('oralGrooveArc', () => {
  const arc = oralGrooveArc();
  const onArc = (angle: number) => ({
    x: arc.centre.x + arc.radius * Math.cos(angle),
    y: arc.centre.y + arc.radius * Math.sin(angle),
  });

  it('leaves the outline at the slipper’s notch, just inside the membrane', () => {
    expect(Math.hypot(ORAL_GROOVE_START.x, ORAL_GROOVE_START.y)).toBeCloseTo(GIANT_ORAL_GROOVE_START_RADII, PRECISION);
    expect(Math.atan2(ORAL_GROOVE_START.y, ORAL_GROOVE_START.x)).toBeCloseTo(
      degreesToRadians(SLIPPER_ORAL_GROOVE_DEG),
      PRECISION,
    );
  });

  it('runs from the notch end to the mouth', () => {
    const start = onArc(arc.notchAngle);
    const end = onArc(arc.notchAngle + arc.sweep);
    expect(start.x).toBeCloseTo(ORAL_GROOVE_START.x, PRECISION);
    expect(start.y).toBeCloseTo(ORAL_GROOVE_START.y, PRECISION);
    expect(end.x).toBeCloseTo(GIANT_ORAL_GROOVE_END.x, PRECISION);
    expect(end.y).toBeCloseTo(GIANT_ORAL_GROOVE_END.y, PRECISION);
  });

  it('bows its bow off the chord, toward the notch’s (ventral, +y) side', () => {
    const middle = onArc(arc.notchAngle + arc.sweep * HALF);
    const chordMiddle = {
      x: (ORAL_GROOVE_START.x + GIANT_ORAL_GROOVE_END.x) * HALF,
      y: (ORAL_GROOVE_START.y + GIANT_ORAL_GROOVE_END.y) * HALF,
    };
    expect(Math.hypot(middle.x - chordMiddle.x, middle.y - chordMiddle.y)).toBeCloseTo(
      GIANT_ORAL_GROOVE_BOW_RADII,
      PRECISION,
    );
    expect(middle.y).toBeGreaterThan(chordMiddle.y);
  });

  it('measures the share along it: 0 at the notch, ½ midway, 1 at the mouth, outside [0, 1] off the ends', () => {
    expect(grooveShare(arc, ORAL_GROOVE_START)).toBeCloseTo(0, PRECISION);
    expect(grooveShare(arc, onArc(arc.notchAngle + arc.sweep * HALF))).toBeCloseTo(HALF, PRECISION);
    expect(grooveShare(arc, GIANT_ORAL_GROOVE_END)).toBeCloseTo(1, PRECISION);
    expect(grooveShare(arc, onArc(arc.notchAngle - arc.sweep * HALF))).toBeLessThan(0);
    expect(grooveShare(arc, onArc(arc.notchAngle + arc.sweep * 2))).toBeGreaterThan(1);
  });
});

describe('vacuoleScale and canalFullness', () => {
  const fullAt = GIANT_VACUOLE_FILL_SHARE * GIANT_VACUOLE_CYCLE_SECONDS;

  it('swells from emptied to full over the fill share, then empties over the rest of the cycle', () => {
    expect(vacuoleScale(0, 0)).toBeCloseTo(GIANT_VACUOLE_EMPTY_SCALE, PRECISION);
    expect(vacuoleScale(fullAt, 0)).toBeCloseTo(1, PRECISION);
    expect(vacuoleScale(fullAt * HALF, 0)).toBeCloseTo((GIANT_VACUOLE_EMPTY_SCALE + 1) * HALF, PRECISION);
    expect(vacuoleScale(GIANT_VACUOLE_CYCLE_SECONDS, 0)).toBeCloseTo(GIANT_VACUOLE_EMPTY_SCALE, PRECISION);
    const emptyingSeconds = GIANT_VACUOLE_CYCLE_SECONDS - fullAt;
    expect(emptyingSeconds).toBeLessThan(fullAt / 4);
  });

  it('runs on a phase, so two pumps half a cycle apart are never both full', () => {
    expect(vacuoleScale(fullAt, HALF)).toBeLessThan(1);
    expect(vacuoleScale(0, HALF)).toBeCloseTo(vacuoleScale(GIANT_VACUOLE_CYCLE_SECONDS * HALF, 0), PRECISION);
  });

  it('fills the canals while the pump is emptied and drains them as it swells', () => {
    expect(canalFullness(GIANT_VACUOLE_EMPTY_SCALE)).toBeCloseTo(1, PRECISION);
    expect(canalFullness(1)).toBeCloseTo(0, PRECISION);
  });
});

describe('ringPoreCount', () => {
  it('spaces each ring’s pores one spacing apart, more on the outer rings', () => {
    const rings = Array.from(
      { length: DIATOM_PORE_ROWS },
      (_unused, row) => DIATOM_PORE_FIRST_RADII + row * DIATOM_PORE_SPACING_RADII,
    );
    const counts = rings.map(ringPoreCount);
    expect(counts).toEqual([...counts].sort((left, right) => left - right));
    rings.forEach((ring, row) => {
      const spacing = (RADIANS_PER_FULL_TURN * ring) / (counts[row] ?? 1);
      expect(spacing).toBeGreaterThanOrEqual(GIANT_DIATOM_RING_PORE_SPACING_RADII);
      expect(spacing).toBeGreaterThan(2 * GIANT_DIATOM_RING_PORE_RADIUS_RADII);
    });
  });
});
