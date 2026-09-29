// @vitest-environment node
// The diatom's valve (#195, sheet 04 diatom): 36 striae alternating a bold rib and a fine stria from the central area to
// the margin, five pores along every fine one and none on the ribs.

import { RADIANS_PER_FULL_TURN } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import {
  DIATOM_PORE_FIRST_RADII,
  DIATOM_PORE_ROWS,
  DIATOM_PORE_SPACING_RADII,
  DIATOM_STRIA_COUNT,
  DIATOM_STRIA_INNER_RADII,
  DIATOM_STRIA_OUTER_RADII,
} from '../../constants';
import { DIATOM_PORE_LAST_RADII, nearestPore, valveMarkAt, type ValveMark } from './diatom-pattern';

/** A cell 60 px in radius: the size a diatom is drawn at near zoom 1.0. */
const RADIUS_PX = 60;
const SAMPLES = 3600;
/** The walk starts midway between a fine stria and a rib, so no mark straddles its start. */
const START = RADIANS_PER_FULL_TURN / (2 * DIATOM_STRIA_COUNT);

/** The marks met walking once round the valve `rho` out, each run of one mark counted once. */
function marksRound(rho: number): ValveMark[] {
  const runs: ValveMark[] = [];
  let previous: ValveMark | null = null;
  for (let index = 0; index < SAMPLES; index += 1) {
    const angle = START + (index / SAMPLES) * RADIANS_PER_FULL_TURN;
    const mark = valveMarkAt({ x: rho * Math.cos(angle), y: rho * Math.sin(angle) }, RADIUS_PX);
    if (mark !== null && mark !== previous) runs.push(mark);
    previous = mark;
  }
  return runs;
}

describe('the diatom’s valve', () => {
  it('draws 36 striae, alternating a rib and a fine stria, between the central area and the margin', () => {
    const between = marksRound(DIATOM_PORE_FIRST_RADII + DIATOM_PORE_SPACING_RADII * 0.5);
    expect(between).toHaveLength(DIATOM_STRIA_COUNT);
    expect(between.filter((mark) => mark === 'rib')).toHaveLength(DIATOM_STRIA_COUNT / 2);
    for (let index = 1; index < between.length; index += 1) expect(between[index]).not.toBe(between[index - 1]);
    expect(marksRound(DIATOM_STRIA_INNER_RADII * 0.9)).toEqual([]);
    expect(marksRound(DIATOM_STRIA_OUTER_RADII * 1.02)).toEqual([]);
  });

  it('pierces five pores along every fine stria and none on the ribs', () => {
    for (let row = 0; row < DIATOM_PORE_ROWS; row += 1) {
      const onRow = marksRound(DIATOM_PORE_FIRST_RADII + row * DIATOM_PORE_SPACING_RADII);
      expect(onRow.filter((mark) => mark === 'pore')).toHaveLength(DIATOM_STRIA_COUNT / 2);
      expect(onRow).not.toContain('fine');
    }
    expect(DIATOM_PORE_LAST_RADII).toBeLessThan(DIATOM_STRIA_OUTER_RADII);
  });

  it('places each pore on a fine stria, half a rib spacing round from the ribs', () => {
    const pore = nearestPore({ x: 0.5, y: 0.01 });
    expect(Math.hypot(pore.x, pore.y)).toBeCloseTo(0.48, 12);
    expect(valveMarkAt({ x: 0.54 * Math.cos(0.01), y: 0.54 * Math.sin(0.01) }, RADIUS_PX)).toBe('fine');
    expect(Math.atan2(pore.y, pore.x)).toBeCloseTo(0, 12);
  });
});
