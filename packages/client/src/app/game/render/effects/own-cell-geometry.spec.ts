// Pins docs/ui/hud.md §3.1.3 — the geometry table at the Z1 camera's 24 / 32 / 47.4 / 64 / 94.8 / 128 px and its
// seat-mark and DNA keep-out inequalities (the picker band's is `hud/format/picker-band.spec.ts`) —
// and the one turn from the record's angles to the screen. The table and the HUD numbers are read
// from the doc rather than copied, so the doc and these functions cannot drift apart without this
// file going red. Two of the table's columns (one counter's span, the gap between the two backings)
// are the layout's, so this spec deliberately calls `orbitLayout` for them: the table is one pin.

import { describe, expect, it } from 'vitest';
import { markdownSection, readRepoDocument, tableCells } from '../../../../testing/repo-document';
import { createTestAerobicCounter, createTestPhotosyntheticCounter } from '../../../../testing/ladder-builders';
import {
  DNA_RING_KEEP_OUT_FRACTION,
  DNA_RING_KEEP_OUT_PAD_PX,
  DNA_RING_STROKE_PX,
  LADDER_BACKING_PX,
  LADDER_GHOST_PX,
  LADDER_ORBIT_ANGLES_PAIR_DEG,
  LADDER_ORBIT_ANGLE_SINGLE_DEG,
  LADDER_SEAT_MARK_CLEARANCE_PX,
  LADDER_UNLOCK_RING_PAD_PX,
} from '../constants';
import { HALF } from '../geometry';
import type { Ladder } from '../../state/own-cell-indicators';
import { orbitLayout, type OrbitArc } from './orbit-layout';
import {
  dnaRingRadiusPx,
  ladderOrbitExtentPx,
  ladderOrbitRadiusPx,
  orbitPointPx,
  screenRadiansOf,
  seatMarkHaloPx,
  selfRingRadiusPx,
  unlockRingRadiusPx,
  type OrbitPoint,
} from './own-cell-geometry';

const UI_DOCUMENT = readRepoDocument('docs/ui/hud.md');
/** Any radius will do for the angle turn; a round one keeps the expected points readable. */
const PROBE_RADIUS_PX = 10;
const FLOAT_SLACK = 1e-9;
/** The sweep the inequalities are checked over, in px of `r_px`. */
const SWEEP_STEP_PX = 0.25;
const BOTH_COUNTERS: Ladder = {
  ghost: null,
  counters: [createTestAerobicCounter(), createTestPhotosyntheticCounter()],
};

// ---- reading the doc ----

interface PrintedNumber {
  readonly value: number;
  /** Half the last digit the doc prints: 17 is ±0.5, 19.8 is ±0.05. */
  readonly tolerance: number;
}

type PrintedRow = readonly (readonly PrintedNumber[])[];

/** §3.1.3's table columns: `r_px`, when, DNA ring, keep-out vs ring edge, self ring, orbit, span, between, extent, seat gap. */
const COLUMN = {
  size: 0,
  dnaRing: 2,
  keepOut: 3,
  selfRing: 4,
  orbit: 5,
  counterSpan: 6,
  betweenBackings: 7,
  orbitExtent: 8,
  seatMarkGap: 9,
} as const;

function printedNumbersIn(cell: string): PrintedNumber[] {
  return [...cell.matchAll(/\d+(?:\.(\d+))?/g)].map((match) => ({
    value: Number(match[0]),
    tolerance: HALF * 10 ** -(match[1]?.length ?? 0),
  }));
}

function printedAt(row: PrintedRow | undefined, column: number, index = 0): PrintedNumber {
  const printed = row?.[column]?.[index];
  if (printed === undefined) throw new Error(`ui/hud.md §3.1.3 table: nothing printed in column ${column}`);
  return printed;
}

function expectAsPrinted(actual: number, printed: PrintedNumber, label: string): void {
  expect(Math.abs(actual - printed.value), label).toBeLessThanOrEqual(printed.tolerance + FLOAT_SLACK);
}

/** §3.1.3's geometry table: one row of printed numbers per cell, per own-cell size. */
function geometryTable(): PrintedRow[] {
  const section = markdownSection(UI_DOCUMENT, '3. ');
  const table = section.slice(section.indexOf('#### 3.1.3'), section.indexOf('#### 3.1.4'));
  return table
    .split('\n')
    .filter((line) => /^\|\s*\d+(?:\.\d+)?\s*\|/.test(line))
    .map((line) => tableCells(line).map(printedNumbersIn));
}

function arcDegrees(arc: OrbitArc | undefined): number {
  if (arc === undefined) throw new Error('expected an orbit arc');
  return arc.endDeg - arc.startDeg;
}

function degreesBetween(first: OrbitArc | undefined, second: OrbitArc | undefined): number {
  if (first === undefined || second === undefined) throw new Error('expected two orbit arcs');
  return second.startDeg - first.endDeg;
}

function sweep(fromPx: number, toPx: number): number[] {
  const sizes: number[] = [];
  for (let rPx = fromPx; rPx <= toPx; rPx += SWEEP_STEP_PX) sizes.push(rPx);
  return sizes;
}

function expectPoint(point: OrbitPoint, x: number, y: number): void {
  expect(point.x).toBeCloseTo(x);
  expect(point.y).toBeCloseTo(y);
}

const TABLE = geometryTable();
const CAP_R_PX = printedAt(TABLE[TABLE.length - 1], COLUMN.size).value;

// ---- the turn from the record's angles to the screen ----

describe('the angle turn from clockwise-from-12 degrees to the screen', () => {
  it('puts 12, 3, 6 and 9 o’clock where a clock face has them on a y-down screen', () => {
    expectPoint(orbitPointPx(PROBE_RADIUS_PX, 0), 0, -PROBE_RADIUS_PX);
    expectPoint(orbitPointPx(PROBE_RADIUS_PX, 90), PROBE_RADIUS_PX, 0);
    expectPoint(orbitPointPx(PROBE_RADIUS_PX, 180), 0, PROBE_RADIUS_PX);
    expectPoint(orbitPointPx(PROBE_RADIUS_PX, 270), -PROBE_RADIUS_PX, 0);
  });

  it('puts the §9 angles where §3.1.2 says: the lone ghost at 6, aerobic lower-left, photosynthetic lower-right', () => {
    const diagonal = PROBE_RADIUS_PX * Math.SQRT1_2;
    expectPoint(orbitPointPx(PROBE_RADIUS_PX, LADDER_ORBIT_ANGLE_SINGLE_DEG), 0, PROBE_RADIUS_PX);
    expectPoint(orbitPointPx(PROBE_RADIUS_PX, LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic), -diagonal, diagonal);
    expectPoint(orbitPointPx(PROBE_RADIUS_PX, LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic), diagonal, diagonal);
  });

  it('measures screen radians from 3 o’clock, clockwise on screen', () => {
    expect(screenRadiansOf(0)).toBeCloseTo(-Math.PI * HALF);
    expect(screenRadiansOf(90)).toBeCloseTo(0);
    expect(screenRadiansOf(180)).toBeCloseTo(Math.PI * HALF);
  });

  it.each([
    0,
    90,
    LADDER_ORBIT_ANGLES_PAIR_DEG.photosynthetic,
    LADDER_ORBIT_ANGLE_SINGLE_DEG,
    LADDER_ORBIT_ANGLES_PAIR_DEG.aerobic,
  ])('lays a sprite at %s° along the orbit, pointing clockwise', (angleDeg) => {
    // The tangent is the direction a point moves as its angle grows: taken from the points
    // themselves, so it cannot agree with a rotation that turns the wrong way.
    const ahead = orbitPointPx(PROBE_RADIUS_PX, angleDeg + 1);
    const behind = orbitPointPx(PROBE_RADIUS_PX, angleDeg - 1);
    const heading = Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
    const { rotation } = orbitPointPx(PROBE_RADIUS_PX, angleDeg);
    expect(Math.cos(rotation)).toBeCloseTo(Math.cos(heading));
    expect(Math.sin(rotation)).toBeCloseTo(Math.sin(heading));
  });
});

// ---- ui/hud.md §3.1.3 ----

describe('docs/ui/hud.md §3.1.3 geometry table', () => {
  it('has the six sizes that matter under the Z1 camera', () => {
    expect(TABLE.map((row) => printedAt(row, COLUMN.size).value)).toEqual([24, 32, 47.4, 64, 94.8, 128]);
  });

  it.each(TABLE.map((row) => [printedAt(row, COLUMN.size).value, row] as const))('%s px', (rPx, row) => {
    const ringRadiusPx = dnaRingRadiusPx(rPx);
    expectAsPrinted(ringRadiusPx, printedAt(row, COLUMN.dnaRing), 'DNA ring');
    expectAsPrinted(ringRadiusPx / rPx, printedAt(row, COLUMN.dnaRing, 1), 'DNA ring as a fraction of r');
    expectAsPrinted(DNA_RING_KEEP_OUT_FRACTION * rPx, printedAt(row, COLUMN.keepOut), 'keep-out');
    const ringEdgePx = ringRadiusPx + DNA_RING_STROKE_PX * HALF + DNA_RING_KEEP_OUT_PAD_PX;
    expectAsPrinted(ringEdgePx, printedAt(row, COLUMN.keepOut, 1), 'ring edge + pad');
    expectAsPrinted(selfRingRadiusPx(rPx), printedAt(row, COLUMN.selfRing), 'self ring');
    expectAsPrinted(ladderOrbitRadiusPx(rPx), printedAt(row, COLUMN.orbit), 'ladder orbit');
    const layout = orbitLayout(BOTH_COUNTERS, rPx);
    expectAsPrinted(arcDegrees(layout.spans[0]), printedAt(row, COLUMN.counterSpan), 'one counter spans');
    const betweenDeg = degreesBetween(layout.backings[0], layout.backings[1]);
    expectAsPrinted(betweenDeg, printedAt(row, COLUMN.betweenBackings), 'between the two backings');
    expectAsPrinted(ladderOrbitExtentPx(rPx), printedAt(row, COLUMN.orbitExtent), 'orbit extent');
    const innerEdgePx = ladderOrbitRadiusPx(rPx) - LADDER_BACKING_PX * HALF;
    const seatGapPx = innerEdgePx - (rPx + seatMarkHaloPx(rPx));
    expectAsPrinted(seatGapPx, printedAt(row, COLUMN.seatMarkGap), 'backing to seat-mark halo');
  });
});

describe('docs/ui/hud.md §3.1.3 inequalities', () => {
  it('clears the seat mark’s halo with the backing from 12 px up, and not below', () => {
    const clearance = (rPx: number): number =>
      ladderOrbitRadiusPx(rPx) - LADDER_BACKING_PX * HALF - (rPx + seatMarkHaloPx(rPx) + LADDER_SEAT_MARK_CLEARANCE_PX);
    for (const rPx of sweep(12, CAP_R_PX)) expect(clearance(rPx), `${rPx} px`).toBeGreaterThanOrEqual(0);
    expect(clearance(11)).toBeLessThan(0);
  });

  it('keeps organelle slots outside the DNA ring from 31 px up, and not at the 24 px spawn §3.1.3 accepts', () => {
    const margin = (rPx: number): number =>
      DNA_RING_KEEP_OUT_FRACTION * rPx - (dnaRingRadiusPx(rPx) + DNA_RING_STROKE_PX * HALF + DNA_RING_KEEP_OUT_PAD_PX);
    for (const rPx of sweep(31, CAP_R_PX)) expect(margin(rPx), `${rPx} px`).toBeGreaterThanOrEqual(0);
    expect(margin(30)).toBeLessThan(0);
    expect(margin(24)).toBeLessThan(0);
  });
});

describe('unlockRingRadiusPx', () => {
  it('rings the ghost square LADDER_UNLOCK_RING_PAD_PX out: 9 px at the §9 values', () => {
    expect(unlockRingRadiusPx()).toBe(LADDER_GHOST_PX / 2 + LADDER_UNLOCK_RING_PAD_PX);
    expect(unlockRingRadiusPx()).toBe(9);
  });
});
