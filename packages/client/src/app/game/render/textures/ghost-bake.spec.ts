import { describe, expect, it } from 'vitest';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { hexWithAlpha } from '../colour';
import {
  GHOST_ASPECT,
  GHOST_BAKE,
  GHOST_LOOP,
  INDICATOR_RIM_TINTED_RAMP,
  INDICATOR_VARIANT_RAMP,
  LADDER_GHOST_PX,
  type IndicatorRamp,
} from '../constants';
import { GHOST_SHAPE, bakeGhost, ghostFrameOf, type GhostShape } from './ghost-bake';

const SHAPES = Object.values(GHOST_SHAPE);
const AEROBIC = INDICATOR_VARIANT_RAMP.aerobic;
const PATH_OPERATIONS = new Set(['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo']);
/** A float's worth of slack on the box edge. */
const EDGE_TOLERANCE_PX = 1e-9;
/** The wash, the faint trace and the dashes each lay the outline down once. */
const OUTLINE_PASSES = 3;

function contextOf(shape: GhostShape, scale = 1, ramp: IndicatorRamp = AEROBIC) {
  const sprite = bakeGhost(createFakeBakeCanvasFactory(), scale, shape, ramp);
  return { sprite, context: fakeContextOf(sprite.canvas) };
}

describe('bakeGhost', () => {
  it('bakes every shape on a square that holds its halo, in whole texels at the scale, sized back in CSS px', () => {
    for (const shape of SHAPES) {
      for (const scale of [1, 2]) {
        const { sprite, context } = contextOf(shape, scale);
        expect(sprite.canvas.width).toBe(Math.ceil(LADDER_GHOST_PX * GHOST_BAKE.haloReach * scale));
        expect(sprite.canvas.height).toBe(sprite.canvas.width);
        expect(sprite.widthPx).toBe(sprite.canvas.width / scale);
        expect(context.argumentsOf('scale')[0]).toEqual([scale, scale]);
      }
    }
  });

  it('keeps every outline and detail point inside the LADDER_GHOST_PX square that orbit-layout clears', () => {
    // orbit-layout's `ghostBoxOf` measures clearance from that square, so a silhouette past it would crowd a counter.
    const half = LADDER_GHOST_PX / 2;
    for (const shape of SHAPES.filter((candidate) => candidate !== GHOST_SHAPE.envelope)) {
      const coordinates = contextOf(shape)
        .context.calls.filter((call) => PATH_OPERATIONS.has(call.name))
        .flatMap((call) => call.args);
      expect(coordinates.length, shape).toBeGreaterThan(0);
      for (const value of coordinates) expect(Math.abs(value), shape).toBeLessThanOrEqual(half + EDGE_TOLERANCE_PX);
    }
    // The envelope is the one circle: its outline fills the square exactly, its pores sit on that rim.
    const envelopeOutlines = contextOf(GHOST_SHAPE.envelope)
      .context.argumentsOf('arc')
      .filter((args) => args[0] === 0 && args[1] === 0 && args[2]! <= half);
    expect(envelopeOutlines.length).toBeGreaterThan(0);
    for (const args of envelopeOutlines) expect(args[2]).toBe(half);
  });

  it('layers each ghost back to front: halo, lit wash, faint trace, dashes, detail, glint', () => {
    for (const shape of SHAPES) {
      const { context } = contextOf(shape);
      expect(context.paintCount, shape).toBeGreaterThanOrEqual(6);
      expect(context.gradients[0]!.kind).toBe('radial');
      expect(context.gradients[0]!.stops[0]!.colour).toBe(hexWithAlpha(AEROBIC.tone, GHOST_BAKE.haloAlpha));
      expect(context.gradients[1]!.kind).toBe('linear');
      expect(context.gradients[1]!.stops[0]!.colour).toBe(hexWithAlpha(AEROBIC.light, GHOST_BAKE.washAlpha));
      // Solid trace, dashed outline, then solid again so the detail strokes are not dashed.
      expect(context.argumentsOf('setLineDash')).toEqual([[], [GHOST_BAKE.dashPx, GHOST_BAKE.dashGapPx], []]);
      expect(context.ops.slice(-4)).toEqual(['beginPath', 'ellipse', 'fill', 'restore']);
    }
  });

  it('bakes the rung ghosts white, so the sprite layer tints them the rim colour', () => {
    for (const shape of [GHOST_SHAPE.loop, GHOST_SHAPE.envelope, GHOST_SHAPE.slipper]) {
      const stops = contextOf(shape, 1, INDICATOR_RIM_TINTED_RAMP).context.gradients.flatMap(
        (gradient) => gradient.stops,
      );
      for (const stop of stops) expect(stop.colour).toMatch(/^rgba\(255, 255, 255, /);
    }
  });

  it('draws a distinct silhouette per shape: bean, pointed lens, wobbling loop, pored circle, slipper', () => {
    const signature = (shape: GhostShape) => {
      const { context } = contextOf(shape);
      return ['ellipse', 'arc', 'bezierCurveTo', 'lineTo', 'quadraticCurveTo']
        .map((name) => context.count(name))
        .join();
    };
    expect(new Set(SHAPES.map(signature)).size).toBe(SHAPES.length);
    expect(contextOf(GHOST_SHAPE.loop).context.count('lineTo')).toBe(OUTLINE_PASSES * GHOST_LOOP.steps);
  });

  it('frames each ghost LADDER_GHOST_PX long at its aspect', () => {
    for (const shape of SHAPES) {
      const frame = ghostFrameOf(shape);
      expect(frame.halfLength * 2).toBe(LADDER_GHOST_PX);
      expect(frame.halfHeight).toBe(frame.halfLength * GHOST_ASPECT[shape]);
    }
    expect(ghostFrameOf(GHOST_SHAPE.envelope).halfHeight).toBe(LADDER_GHOST_PX / 2);
  });
});
