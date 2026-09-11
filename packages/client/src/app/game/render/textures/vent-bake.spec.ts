import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf, type FakeBakeContext } from '../../../../testing/fake-bake-canvas';
import {
  VENT_BUBBLES,
  VENT_CRACKS,
  VENT_HEAT_POOL,
  VENT_PLUME_MOTES,
  VENT_SEAM_CORE,
  VENT_SEAM_GLINTS,
  VENT_SHIMMER_ARCS,
  VENT_SPRITE_PADDING_WU,
  VENT_SPRITE_PX_PER_WU,
  WHITE,
  ZONE_VENT,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { bakeVentSprite, ventSpriteHalfExtentWu } from './vent-bake';

function cosmetic(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

function bake(seed = 1) {
  const sprite = bakeVentSprite(createFakeBakeCanvasFactory(), cosmetic(seed));
  return { sprite, context: fakeContextOf(sprite.canvas) };
}

/** Every fill and stroke style a bake sets, in paint order. */
function paintStyles(seed: number): string[] {
  const factory = createFakeBakeCanvasFactory();
  const styles: string[] = [];
  const originalCreate = factory.create.bind(factory);
  factory.create = (width, height) => {
    const canvas = originalCreate(width, height);
    const context = canvas.context as FakeBakeContext;
    const originalStroke = context.stroke.bind(context);
    const originalFill = context.fill.bind(context);
    context.stroke = () => {
      styles.push(String(context.strokeStyle));
      originalStroke();
    };
    context.fill = () => {
      styles.push(typeof context.fillStyle === 'string' ? context.fillStyle : 'gradient');
      originalFill();
    };
    return canvas;
  };
  bakeVentSprite(factory, cosmetic(seed));
  return styles;
}

describe('bakeVentSprite', () => {
  it('bakes a square at the sprite resolution, reaching past the plume by the padding', () => {
    const { sprite } = bake();
    const halfExtent = ventSpriteHalfExtentWu();
    expect(halfExtent).toBeGreaterThan(VENT_PLUME_MOTES.riseWuMax + VENT_SPRITE_PADDING_WU);
    expect(halfExtent).toBeGreaterThan(VENT_HEAT_POOL.radiusX + VENT_HEAT_POOL.blurWu + VENT_SPRITE_PADDING_WU);
    expect(sprite.halfExtentWu).toBe(halfExtent);
    expect(sprite.canvas.width).toBe(Math.ceil(halfExtent * 2 * VENT_SPRITE_PX_PER_WU));
    expect(sprite.canvas.height).toBe(sprite.canvas.width);
  });

  it('draws in wu under one scale, the fissure in its rotated frame and the plume outside it', () => {
    const { context } = bake();
    expect(context.ops.slice(0, 4)).toEqual(['save', 'translate', 'scale', 'save']);
    const softEllipses = 4;
    expect(context.count('rotate')).toBe(1 + softEllipses + VENT_PLUME_MOTES.count);
    expect(context.count('restore')).toBe(context.count('save'));
  });

  it('opens with the soft heat pool in the vent tint and stacks every sheet-02 layer above it', () => {
    const { context } = bake();
    const pool = context.gradients[0]!;
    expect(pool.stops[0]!.colour).toBe(hexWithAlpha(ZONE_VENT, VENT_HEAT_POOL.alpha));
    expect(pool.stops.at(-1)!.colour).toBe(hexWithAlpha(ZONE_VENT, 0));
    const softShapes = 4;
    const plates = 2;
    const cracks = VENT_CRACKS.count * 2;
    const seamAndGlints = 3 + VENT_SEAM_GLINTS.length;
    const risers = VENT_SHIMMER_ARCS.count + VENT_BUBBLES.count * 5;
    expect(context.paintCount).toBeGreaterThanOrEqual(
      softShapes + plates + cracks + seamAndGlints + risers + VENT_PLUME_MOTES.count,
    );
    expect(context.count('bezierCurveTo')).toBe(0);
    expect(context.count('quadraticCurveTo')).toBe(VENT_SHIMMER_ARCS.count);
  });

  it('puts the white core over the seam glow and the glints over the core, with the cracks in the plume colour', () => {
    const styles = paintStyles(1);
    const glow = styles.findIndex((style) => style.startsWith('rgba(255, 154, 77'));
    const core = styles.indexOf(hexWithAlpha(WHITE, VENT_SEAM_CORE.alpha));
    const glint = styles.indexOf(hexWithAlpha(WHITE, VENT_SEAM_GLINTS[1].alpha));
    expect(glow).toBeGreaterThan(-1);
    expect(core).toBeGreaterThan(glow);
    expect(glint).toBeGreaterThan(core);
    const plumeColoured = styles.filter((style) => style.startsWith('rgba(255, 177, 90'));
    expect(plumeColoured.length).toBeGreaterThanOrEqual(VENT_CRACKS.count * 2 + VENT_SHIMMER_ARCS.count);
  });

  it('places the cracks, bubbles and plume from the vent sub-stream: same seed, same paints; another seed, other paints', () => {
    const first = paintStyles(3);
    expect(first).toEqual(paintStyles(3));
    expect(first).not.toEqual(paintStyles(4));
    expect(first).toHaveLength(paintStyles(4).length);
  });
});
