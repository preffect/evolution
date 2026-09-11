import { describe, expect, it } from 'vitest';
import { DISH_RADIUS, RANDOM_STREAM, createSeededRandom, type GelPatchView } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import {
  CAUSTIC_ARCS,
  FIELD_TEXTURE_PX,
  LIGHT_ACCENT,
  LIGHT_POOL_ALPHA,
  MIRE_STRANDS_PER_PATCH,
  OUTSIDE_DISH,
  OUTSIDE_DISH_ALPHA,
  ZONE_SHALLOWS,
  ZONE_TINT_ALPHA,
  ZONE_VENT,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { bakeDishField } from './dish-texture';

const PATCHES: GelPatchView[] = [
  { x: 500, y: 500, radius: 350 },
  { x: -900, y: 200, radius: 350 },
];
/** `ZONE_GEL` `#b070ff` as the rgba prefix every strand stroke starts with. */
const GEL_RGBA_PREFIX = /^rgba\(176, 112, 255, /;

function cosmetic(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

function bake(patches: GelPatchView[] = PATCHES) {
  const field = bakeDishField(createFakeBakeCanvasFactory(), patches, cosmetic());
  return { field, context: fakeContextOf(field.canvas) };
}

/** The stroke styles a bake sets, in order: a recording stroke on every canvas the factory hands out. */
function bakeStrokes(seed: number): string[] {
  const factory = createFakeBakeCanvasFactory();
  const styles: string[] = [];
  const originalCreate = factory.create.bind(factory);
  factory.create = (width, height) => {
    const canvas = originalCreate(width, height);
    const originalStroke = canvas.context.stroke.bind(canvas.context);
    canvas.context.stroke = () => {
      styles.push(canvas.context.strokeStyle as string);
      originalStroke();
    };
    return canvas;
  };
  bakeDishField(factory, PATCHES, cosmetic(seed));
  return styles;
}

describe('bakeDishField', () => {
  it('covers the dish and its wall at the field resolution, centred on the origin', () => {
    const { field } = bake([]);
    expect(field.canvas.width).toBe(FIELD_TEXTURE_PX);
    expect(field.canvas.height).toBe(FIELD_TEXTURE_PX);
    expect(field.halfExtentWu).toBeGreaterThan(DISH_RADIUS);
    expect(field.wuPerPx * FIELD_TEXTURE_PX).toBeCloseTo(field.halfExtentWu * 2, 6);
  });

  it('paints in sheet-02 order: field, light pool and caustics, shallows, vent tint and fissure, then the outside', () => {
    const { context } = bake([]);
    expect(context.ops[0]).toBe('fillRect');
    const [pool, shallows, vent] = context.gradients;
    expect(pool!.stops[0]!.colour).toBe(hexWithAlpha(LIGHT_ACCENT, LIGHT_POOL_ALPHA));
    expect(pool!.stops.at(-1)!.colour).toBe(hexWithAlpha(LIGHT_ACCENT, 0));
    expect(shallows!.stops[0]!.colour).toBe(hexWithAlpha(ZONE_SHALLOWS, 0));
    expect(shallows!.stops.at(-1)!.colour).toBe(hexWithAlpha(ZONE_SHALLOWS, ZONE_TINT_ALPHA.shallows));
    expect(vent!.stops[0]!.colour).toBe(hexWithAlpha(ZONE_VENT, ZONE_TINT_ALPHA.vent));
    expect(vent!.stops.at(-1)!.colour).toBe(hexWithAlpha(ZONE_VENT, 0));
    expect(context.count('stroke')).toBe(CAUSTIC_ARCS);
    expect(context.fillStyle).toBe(hexWithAlpha(OUTSIDE_DISH, OUTSIDE_DISH_ALPHA));
    expect(context.ops.at(-1)).toBe('fill');
  });

  it('keeps every zone tint at or under the sheet-02 ceiling and fills the field once, uniformly', () => {
    const { context } = bake();
    const zoneStops = context.gradients.slice(1).flatMap((gradient) => gradient.stops);
    expect(zoneStops.length).toBeGreaterThan(0);
    for (const stop of zoneStops) {
      const alpha = Number(/, ([\d.]+)\)$/.exec(stop.colour)?.[1]);
      expect(alpha).toBeLessThanOrEqual(ZONE_TINT_ALPHA.shallows);
    }
    expect(context.count('fillRect')).toBe(1);
  });

  it('draws every gel patch as a mire tint with its strands', () => {
    const bare = bake([]).context;
    const patched = bake().context;
    expect(patched.paintCount).toBe(bare.paintCount + PATCHES.length * (1 + MIRE_STRANDS_PER_PATCH));
    expect(patched.count('quadraticCurveTo')).toBe(PATCHES.length * MIRE_STRANDS_PER_PATCH);
    expect(patched.strokeStyle).toMatch(GEL_RGBA_PREFIX);
  });

  it('places the strands from the cosmetic stream: same seed, same strokes; another seed, other strokes', () => {
    const first = bakeStrokes(1);
    expect(first).toHaveLength(CAUSTIC_ARCS + PATCHES.length * MIRE_STRANDS_PER_PATCH);
    expect(first).toEqual(bakeStrokes(1));
    expect(first).not.toEqual(bakeStrokes(2));
  });
});
