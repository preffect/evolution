// @vitest-environment node
// The spray beads (docs/rendering/opening-dive.md §4): placed once on the mockup's world-stable grid (`forCells`), half
// the cells, on blade 0 and clear of the drop, in the order the mockup draws them; shown only while a millimetre spans
// a few pixels, above their cut and under the grid's cell cap.

import { describe, expect, it } from 'vitest';
import { KELP_BEAD_FIELD_M, KELP_BEADS, KELP_DROP } from '../../constants/dive-kelp-drop';
import { KELP_BLADE } from '../../constants/dive-kelp';
import { diveCameraAt } from '../dive-camera';
import { coordinateHash } from '../shore/shore-noise';
import { areBeadsShown, cellsInView, gridCell, placeBeads, type KelpBead } from './kelp-beads';
import { kelpBlades } from './kelp-ribbons';

const VIEWPORT = { width: 830, height: 467 };

function placed(): KelpBead[] {
  const steps = placeBeads(kelpBlades()[0]!.samples);
  for (;;) {
    const step = steps.next();
    if (step.done === true) return step.value;
  }
}

describe('gridCell', () => {
  it('is the mockup’s cell: jittered by its hash, its two rolls the next two salts', () => {
    const cell = gridCell(-3, 7, { cellM: 0.5, salt: 51 });
    expect(cell.x).toBe((-3 + coordinateHash(-3, 7, 51)) * 0.5);
    expect(cell.y).toBe((7 + coordinateHash(-3, 7, 52)) * 0.5);
    expect(cell.first).toBe(coordinateHash(-3, 7, 53));
    expect(cell.second).toBe(coordinateHash(-3, 7, 54));
  });
});

describe('cellsInView', () => {
  it('counts the cells over the view and one more on each side, as `forCells` visits them', () => {
    const camera = diveCameraAt(0, { width: 1000, height: 500 });
    // 1 m by 0.5 m at 0.1 m cells: columns −6…6 and rows −4…3 (`floor(±h / cell) ± 1`)
    expect(cellsInView(camera, 0.1)).toBe(13 * 8);
  });
});

describe('placeBeads', () => {
  const beads = placed();

  it('finds beads, every one on blade 0 within its share of the blade’s width and clear of the drop', () => {
    expect(beads.length).toBeGreaterThan(100);
    const blade = kelpBlades()[0]!.samples;
    for (const bead of beads) {
      const nearest = Math.min(...blade.map((sample) => Math.hypot(sample.x - bead.x, sample.y - bead.y)));
      expect(nearest).toBeLessThan(KELP_BLADE.widthM * KELP_BEADS.onBladeShare + 0.02);
      const fromDrop = Math.hypot(bead.x - KELP_DROP.x, bead.y - KELP_DROP.y);
      expect(fromDrop).toBeGreaterThanOrEqual(KELP_DROP.radiusM + bead.radiusM + KELP_BEADS.clearOfDropM);
      expect(bead.radiusM).toBeGreaterThanOrEqual(KELP_BEADS.radiusM.min);
      expect(bead.radiusM).toBeLessThanOrEqual(KELP_BEADS.radiusM.min + KELP_BEADS.radiusM.span);
    }
  });

  it('puts them in the mockup’s drawing order, column by column, then row by row, within the field', () => {
    const cellOf = (value: number): number => Math.floor(value / KELP_BEADS.cellM);
    for (let index = 1; index < beads.length; index += 1) {
      const [before, after] = [beads[index - 1]!, beads[index]!];
      const order = cellOf(after.x) - cellOf(before.x) || cellOf(after.y) - cellOf(before.y);
      expect(order).toBeGreaterThan(0);
    }
    for (const bead of beads)
      expect(Math.max(Math.abs(bead.x), Math.abs(bead.y))).toBeLessThan(KELP_BEAD_FIELD_M + KELP_BEADS.cellM);
  });

  it('places the same beads every time', () => {
    expect(placed()).toEqual(beads);
  });
});

describe('areBeadsShown', () => {
  it('shows them once the grid’s cells fall under the cap and a millimetre spans enough pixels, down to their cut', () => {
    const shownAt = (zoom: number) => areBeadsShown(diveCameraAt(zoom, VIEWPORT));
    expect(shownAt(0.3)).toBe(false);
    expect(shownAt(-0.2)).toBe(true);
    expect(shownAt(-2.4)).toBe(true);
    expect(shownAt(-2.45)).toBe(false);
    expect(cellsInView(diveCameraAt(0.3, VIEWPORT), KELP_BEADS.cellM)).toBeGreaterThan(KELP_BEADS.maxCells);
  });

  it('keeps them hidden until a millimetre spans the mockup’s pixels, whatever the cell count', () => {
    const tall = { width: 300, height: 2000 };
    const camera = diveCameraAt(-0.6, tall);
    expect(cellsInView(camera, KELP_BEADS.cellM)).toBeLessThanOrEqual(KELP_BEADS.maxCells);
    expect(camera.pixelsPerMetre / 1000).toBeLessThan(KELP_BEADS.pxPerMm);
    expect(areBeadsShown(camera)).toBe(false);
  });
});
