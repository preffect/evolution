import { describe, expect, it } from 'vitest';
import { BACTERIUM_VARIANT, CELL_STAGE, STAGE_GATE_TRAITS } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { hexWithAlpha } from '../colour';
import {
  INDICATOR_VARIANT_RAMP,
  LADDER_GHOST_PX,
  LADDER_ORBIT_ANGLES_PAIR_DEG,
  LADDER_PIP_LIT_ALPHA,
  LADDER_PIP_PX,
  LADDER_PIP_ROW_MAX,
  LADDER_PIP_STROKE_PX,
  LADDER_UNLOCK_RING_PAD_PX,
  LADDER_UNLOCK_RING_STROKE_PX,
  PIP_BAKE,
  UNLOCK_RING_BAKE,
} from '../constants';
import { pipBlockSizePx } from '../effects/orbit-layout';
import { orbitPointPx } from '../effects/own-cell-geometry';
import {
  bakePipBlock,
  bakeUnlockRing,
  endosymbiontTallies,
  pipBlockKey,
  pipCentrePx,
  unlockRingRadiusPx,
} from './pip-block-bake';

const TALLIES = endosymbiontTallies();
const AEROBIC = TALLIES.find((tally) => tally.variant === BACTERIUM_VARIANT.aerobic)!;
const REQUIRED = AEROBIC.required;
const FULL_TURN_DEG = 360;

describe('endosymbiontTallies', () => {
  it('reads each endosymbiont of the gate from the catalog: its variant, its tally and its organelle colour', () => {
    expect(TALLIES.map((tally) => tally.traitId)).toEqual([...STAGE_GATE_TRAITS[CELL_STAGE.endosymbiosis]]);
    expect(TALLIES.map((tally) => [tally.traitId, tally.variant])).toEqual([
      ['mitochondrion', BACTERIUM_VARIANT.aerobic],
      ['chloroplast', BACTERIUM_VARIANT.photosynthetic],
    ]);
    for (const tally of TALLIES) {
      expect(tally.required).toBeGreaterThan(0);
      expect(tally.ramp).toBe(INDICATOR_VARIANT_RAMP[tally.variant as keyof typeof INDICATOR_VARIANT_RAMP]);
    }
  });
});

describe('pipBlockKey', () => {
  it('clamps the tally into the atlas: past required reads the full block, below zero the empty one', () => {
    // The record clamps too, but a raw tally keeps climbing until the trait is picked (UI.md §3.1.4).
    expect(pipBlockKey(BACTERIUM_VARIANT.aerobic, REQUIRED + 2, REQUIRED)).toBe(`aerobic:${REQUIRED}`);
    expect(pipBlockKey(BACTERIUM_VARIANT.aerobic, -1, REQUIRED)).toBe('aerobic:0');
    expect(pipBlockKey(BACTERIUM_VARIANT.photosynthetic, 3, REQUIRED)).toBe('photosynthetic:3');
  });
});

describe('pipCentrePx', () => {
  const block = pipBlockSizePx(REQUIRED);
  const radius = LADDER_PIP_PX / 2;

  it('lays the pips in rows of five along +x, the first row on the bottom edge, inside the block', () => {
    expect(pipCentrePx(0, REQUIRED)).toEqual({ x: radius, y: block.height - radius });
    expect(pipCentrePx(LADDER_PIP_ROW_MAX - 1, REQUIRED)).toEqual({
      x: block.width - radius,
      y: block.height - radius,
    });
    expect(pipCentrePx(LADDER_PIP_ROW_MAX, REQUIRED)).toEqual({ x: radius, y: radius });
    for (let index = 0; index < REQUIRED; index += 1) {
      const centre = pipCentrePx(index, REQUIRED);
      expect(centre.x - radius).toBeGreaterThanOrEqual(0);
      expect(centre.x + radius).toBeLessThanOrEqual(block.width);
      expect(centre.y - radius).toBeGreaterThanOrEqual(0);
      expect(centre.y + radius).toBeLessThanOrEqual(block.height);
    }
  });

  it('puts the first row nearest the cell and lights clockwise once the sprite takes the orbit tangent', () => {
    // A sprite rotated by `OrbitPoint.rotation` maps its local axes onto the screen; +y must face the cell
    // centre (the bottom row is the row nearest the cell) and +x must run clockwise along the orbit.
    for (const angleDeg of Object.values(LADDER_ORBIT_ANGLES_PAIR_DEG)) {
      const point = orbitPointPx(100, angleDeg);
      const localY = { x: -Math.sin(point.rotation), y: Math.cos(point.rotation) };
      const towardCentre = { x: -point.x / 100, y: -point.y / 100 };
      expect(localY.x * towardCentre.x + localY.y * towardCentre.y).toBeCloseTo(1, 9);
      const next = orbitPointPx(100, angleDeg + 1 / FULL_TURN_DEG);
      const clockwise = { x: next.x - point.x, y: next.y - point.y };
      expect(Math.cos(point.rotation) * clockwise.x + Math.sin(point.rotation) * clockwise.y).toBeGreaterThan(0);
    }
  });
});

describe('bakePipBlock', () => {
  it('sizes the canvas to the block plus its halo margin and centres the block on it', () => {
    const sprite = bakePipBlock(createFakeBakeCanvasFactory(), 2, AEROBIC, 0);
    const block = pipBlockSizePx(REQUIRED);
    expect(sprite.widthPx).toBe(block.width + PIP_BAKE.haloPx * 2);
    expect(sprite.heightPx).toBe(block.height + PIP_BAKE.haloPx * 2);
    expect(sprite.canvas.width).toBe(sprite.widthPx * 2);
    expect(fakeContextOf(sprite.canvas).argumentsOf('translate')[0]).toEqual([PIP_BAKE.haloPx, PIP_BAKE.haloPx]);
  });

  it('lights exactly `eaten` pips (halo and body ramp each) and outlines the rest', () => {
    for (const eaten of [0, 1, LADDER_PIP_ROW_MAX, REQUIRED]) {
      const context = fakeContextOf(bakePipBlock(createFakeBakeCanvasFactory(), 1, AEROBIC, eaten).canvas);
      expect(context.count('radialGradient'), `eaten ${eaten}`).toBe(eaten * 2);
      expect(context.argumentsOf('stroke'), `eaten ${eaten}`).toEqual(
        Array.from({ length: REQUIRED - eaten }, () => [LADDER_PIP_STROKE_PX]),
      );
    }
  });

  it('shades a lit pip in its organelle ramp, lit from the top-left', () => {
    const context = fakeContextOf(bakePipBlock(createFakeBakeCanvasFactory(), 1, AEROBIC, 1).canvas);
    const body = context.gradients[1]!;
    expect(body.stops.map((stop) => stop.colour)).toEqual([
      hexWithAlpha(AEROBIC.ramp.light, LADDER_PIP_LIT_ALPHA),
      hexWithAlpha(AEROBIC.ramp.tone, LADDER_PIP_LIT_ALPHA),
      hexWithAlpha(AEROBIC.ramp.dark, LADDER_PIP_LIT_ALPHA),
    ]);
    const [focusX = 0, focusY = 0, , centreX = 0, centreY = 0] = body.geometry;
    expect(focusX).toBeLessThan(centreX);
    expect(focusY).toBeLessThan(centreY);
  });
});

describe('bakeUnlockRing', () => {
  const sprite = bakeUnlockRing(createFakeBakeCanvasFactory(), 1);
  const context = fakeContextOf(sprite.canvas);

  it('rings the ghost square LADDER_UNLOCK_RING_PAD_PX out and holds the stroke and glow on its canvas', () => {
    expect(unlockRingRadiusPx()).toBe(LADDER_GHOST_PX / 2 + LADDER_UNLOCK_RING_PAD_PX);
    const outer = unlockRingRadiusPx() + LADDER_UNLOCK_RING_STROKE_PX / 2 + UNLOCK_RING_BAKE.haloPx;
    expect(sprite.canvas.width).toBe(Math.ceil(outer * 2));
  });

  it('strokes a dark edge, the gold ring at its width and a lit arc toward the light', () => {
    expect(context.argumentsOf('stroke')).toEqual([
      [LADDER_UNLOCK_RING_STROKE_PX + UNLOCK_RING_BAKE.edgePx * 2],
      [LADDER_UNLOCK_RING_STROKE_PX],
      [LADDER_UNLOCK_RING_STROKE_PX / 2],
    ]);
    const onRing = context.argumentsOf('arc').filter((args) => args[2] === unlockRingRadiusPx());
    expect(onRing).toHaveLength(3);
    const [, , , start = 0, end = 0] = onRing[2]!;
    expect(end - start).toBeCloseTo(UNLOCK_RING_BAKE.litArcTurns * 2 * Math.PI, 9);
  });
});
