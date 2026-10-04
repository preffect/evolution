// @vitest-environment node
// The slime's scatters (docs/rendering/opening-dive.md §4, ticket #803): each cell of each grid where the mockup's
// `forCells` put it, kept by the mockup's own tests, pinned against the mockup's code verbatim over a view; and each
// scatter made far enough out that no view under its cell cap reaches past it.

import { describe, expect, it } from 'vitest';
import { KELP_DROP } from '../../constants/dive-kelp-drop';
import {
  SLIME_CLOUDS,
  SLIME_FLOOR_DIATOMS,
  SLIME_POCKET_RADIUS_M,
  SLIME_SCATTER_REACH_M,
} from '../../constants/dive-slime';
import { SLIME_MOTES, SLIME_RODS } from '../../constants/dive-slime-bacteria';
import { diveCameraAt } from '../dive-camera';
import { cellsInView } from '../kelp/kelp-beads';
import { runBake } from '../../../../../testing/slime-builder';
import { floorDiatoms, kindOfRoll, scatter, slimeClouds, slimeMotes, slimeRods } from './slime-scatter';

/** The mockup's `hash`, verbatim but for its names. */
function mockupHash(x: number, y: number, key: number): number {
  let mixed = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(key | 0, 2147483647);
  mixed = Math.imul(mixed ^ (mixed >>> 13), 1274126177);
  mixed ^= mixed >>> 16;
  return (mixed >>> 0) / 4294967296;
}

/** The mockup's `forCells` over a view of half-extents `halfX × halfY`, verbatim but for its names and the cap. */
function mockupCells(cell: number, key: number, halfX: number, halfY: number): number[][] {
  const out: number[][] = [];
  const firstColumn = Math.floor(-halfX / cell) - 1;
  const lastColumn = Math.floor(halfX / cell) + 1;
  const firstRow = Math.floor(-halfY / cell) - 1;
  const lastRow = Math.floor(halfY / cell) + 1;
  for (let column = firstColumn; column <= lastColumn; column++)
    for (let row = firstRow; row <= lastRow; row++)
      out.push([
        column,
        row,
        (column + mockupHash(column, row, key)) * cell,
        (row + mockupHash(column, row, key + 1)) * cell,
        mockupHash(column, row, key + 2),
        mockupHash(column, row, key + 3),
      ]);
  return out;
}

describe('scatter', () => {
  it('places every cell and rolls it as the mockup’s forCells did, column by column, a column a step', () => {
    const cell = SLIME_CLOUDS.cellM;
    const half = 4 * cell;
    const box = { left: -half - cell, top: -half - cell, right: half + cell, bottom: half + cell };
    const { result, steps } = runBake(scatter(SLIME_CLOUDS, box, (one) => one));
    const expected = mockupCells(cell, SLIME_CLOUDS.salt, half, half);
    expect(result.map((one) => [one.column, one.row, one.x, one.y, one.first, one.second])).toEqual(expected);
    expect(steps).toBe(new Set(result.map((one) => one.column)).size);
  });
});

describe('the slime’s clouds', () => {
  const clouds = runBake(slimeClouds()).result;

  it('keeps every cloud clear of the dish, sized and faded by its rolls', () => {
    for (const cloud of clouds) {
      expect(Math.hypot(cloud.x, cloud.y)).toBeGreaterThanOrEqual(SLIME_POCKET_RADIUS_M * SLIME_CLOUDS.clearRadii);
      expect(cloud.radiusM).toBeGreaterThanOrEqual(SLIME_CLOUDS.radiusM.min);
      expect(cloud.radiusM).toBeLessThanOrEqual(SLIME_CLOUDS.radiusM.min + SLIME_CLOUDS.radiusM.span);
    }
  });

  it('holds every cloud the mockup drew over a view under its cap, inside the drop', () => {
    const camera = diveCameraAt(-2.6, { width: 830, height: 467 });
    expect(cellsInView(camera, SLIME_CLOUDS.cellM)).toBeLessThanOrEqual(SLIME_CLOUDS.maxCells);
    const drawn = mockupCells(SLIME_CLOUDS.cellM, SLIME_CLOUDS.salt, camera.halfWidthM, camera.halfHeightM).filter(
      ([, , x = 0, y = 0]) =>
        Math.hypot(x, y) >= SLIME_POCKET_RADIUS_M * SLIME_CLOUDS.clearRadii &&
        Math.hypot(x - KELP_DROP.x, y - KELP_DROP.y) < KELP_DROP.radiusM,
    );
    const made = new Set(clouds.map((cloud) => `${cloud.x},${cloud.y}`));
    expect(drawn.length).toBeGreaterThan(0);
    for (const [, , x, y] of drawn) expect(made.has(`${x},${y}`)).toBe(true);
  });

  it('reaches past the widest view a stage up to 4:1 has under the clouds’ cell cap', () => {
    const { stageAspect } = SLIME_SCATTER_REACH_M;
    let widest = 0;
    for (let zoom = -1.95; zoom > -3.5; zoom -= 0.01) {
      const camera = diveCameraAt(zoom, { width: 1000 * stageAspect, height: 1000 });
      if (cellsInView(camera, SLIME_CLOUDS.cellM) <= SLIME_CLOUDS.maxCells)
        widest = Math.max(widest, camera.halfWidthM);
    }
    const reach = widest + SLIME_CLOUDS.radiusM.min + SLIME_CLOUDS.radiusM.span + SLIME_CLOUDS.cellM;
    expect(reach).toBeLessThanOrEqual(SLIME_SCATTER_REACH_M.clouds);
  });
});

describe('the floor’s diatoms', () => {
  const diatoms = runBake(floorDiatoms()).result;

  it('keeps those the mockup kept: inside the drop, clear of the dish, rolled to be kept, kinds by their rolls', () => {
    expect(diatoms.length).toBeGreaterThan(100);
    for (const diatom of diatoms) {
      expect(Math.hypot(diatom.x - KELP_DROP.x, diatom.y - KELP_DROP.y)).toBeLessThanOrEqual(KELP_DROP.radiusM);
      expect(Math.hypot(diatom.x, diatom.y)).toBeGreaterThanOrEqual(SLIME_FLOOR_DIATOMS.clearOfFocusM);
      expect([0, 1, 2]).toContain(diatom.kind);
    }
    const cells = mockupCells(SLIME_FLOOR_DIATOMS.cellM, SLIME_FLOOR_DIATOMS.salt, 6e-4, 6e-4);
    const kept = cells.filter(
      ([column = 0, row = 0, x = 0, y = 0]) =>
        Math.hypot(x, y) >= SLIME_FLOOR_DIATOMS.clearOfFocusM &&
        mockupHash(column, row, SLIME_FLOOR_DIATOMS.keepSalt) <= 0.7 &&
        Math.hypot(x - KELP_DROP.x, y - KELP_DROP.y) <= KELP_DROP.radiusM,
    );
    const made = new Map(diatoms.map((diatom) => [`${diatom.x},${diatom.y}`, diatom]));
    for (const [column = 0, row = 0, x, y, first = 0] of kept) {
      const diatom = made.get(`${x},${y}`);
      expect(diatom?.lengthM).toBeCloseTo(30e-6 + first * 55e-6, 12);
      const roll = mockupHash(column, row, SLIME_FLOOR_DIATOMS.kindSalt);
      expect(diatom?.kind).toBe(roll < 0.45 ? 0 : roll < 0.8 ? 1 : 2);
    }
  });

  it('picks a kind by the first bound its roll is under, else the last', () => {
    expect(kindOfRoll(0.1, [0.45, 0.8])).toBe(0);
    expect(kindOfRoll(0.5, [0.45, 0.8])).toBe(1);
    expect(kindOfRoll(0.9, [0.45, 0.8])).toBe(2);
  });
});

describe('the bacteria and the food specks', () => {
  it('keeps the rods the mockup kept, in the dish and in the slime but not against the wall', () => {
    const rods = runBake(slimeRods()).result;
    const radius = SLIME_POCKET_RADIUS_M;
    for (const rod of rods) {
      const distance = Math.hypot(rod.x, rod.y);
      expect(rod.isInDish).toBe(distance < radius * SLIME_RODS.inDishRadii);
      if (!rod.isInDish) expect(distance).toBeGreaterThanOrEqual(radius * SLIME_RODS.clearOfWallRadii);
    }
    expect(rods.some((rod) => rod.isInDish)).toBe(true);
    expect(rods.some((rod) => !rod.isInDish)).toBe(true);
  });

  it('reaches past the widest view a stage up to 4:1 has under the rods’ cell cap', () => {
    let widest = 0;
    for (let zoom = -2.5; zoom > -4.6; zoom -= 0.01) {
      const camera = diveCameraAt(zoom, { width: 1000 * SLIME_SCATTER_REACH_M.stageAspect, height: 1000 });
      if (cellsInView(camera, SLIME_RODS.cellM) <= SLIME_RODS.maxCells) widest = Math.max(widest, camera.halfWidthM);
    }
    expect(widest + SLIME_RODS.cellM).toBeLessThanOrEqual(SLIME_SCATTER_REACH_M.rods);
  });

  it('keeps the specks round the dish, more of them in it, a few of them lipids', () => {
    const motes = runBake(slimeMotes()).result;
    for (const mote of motes) {
      expect(Math.hypot(mote.x, mote.y)).toBeLessThanOrEqual(SLIME_POCKET_RADIUS_M * SLIME_MOTES.reachRadii);
    }
    expect(motes.some((mote) => mote.isLipid)).toBe(true);
    expect(motes.some((mote) => !mote.isLipid)).toBe(true);
  });
});
