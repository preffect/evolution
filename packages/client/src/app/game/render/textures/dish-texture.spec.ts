import { describe, expect, it } from 'vitest';
import { DISH_RADIUS, RANDOM_STREAM, createSeededRandom, type GelPatchView } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import {
  FIELD_TEXTURE_PX,
  MIRE_STRANDS_PER_PATCH,
  OUTSIDE_DISH,
  OUTSIDE_DISH_ALPHA,
  STAGE_SCRATCHES,
  WALL_INNER_SHADOW,
  WALL_INNER_SHADOW_ALPHA,
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
  });

  it('paints in sheet-02 order: field, shallows, vent tint, wall shadow, the outside and its scratches; no pool (§6.1)', () => {
    const { context } = bake([]);
    expect(context.ops[0]).toBe('fillRect');
    const [shallows, vent, shadow] = context.gradients;
    expect(shallows!.stops[0]!.colour).toBe(hexWithAlpha(ZONE_SHALLOWS, 0));
    expect(shallows!.stops.at(-1)!.colour).toBe(hexWithAlpha(ZONE_SHALLOWS, ZONE_TINT_ALPHA.shallows));
    expect(vent!.stops[0]!.colour).toBe(hexWithAlpha(ZONE_VENT, ZONE_TINT_ALPHA.vent));
    expect(vent!.stops.at(-1)!.colour).toBe(hexWithAlpha(ZONE_VENT, 0));
    expect(shadow!.stops[0]!.colour).toBe(hexWithAlpha(WALL_INNER_SHADOW, 0));
    expect(shadow!.stops.at(-1)!.colour).toBe(hexWithAlpha(WALL_INNER_SHADOW, WALL_INNER_SHADOW_ALPHA));
    expect(context.gradients).toHaveLength(3);
    expect(context.count('bezierCurveTo')).toBe(0);
    expect(context.count('ellipse')).toBe(0);
    const outsideFill = context.ops.lastIndexOf('fill');
    expect(context.ops.slice(0, outsideFill).filter((operation) => operation === 'stroke')).toHaveLength(0);
    expect(context.ops.slice(outsideFill).filter((operation) => operation === 'stroke')).toHaveLength(
      STAGE_SCRATCHES.count,
    );
    expect(context.fillStyle).toBe(hexWithAlpha(OUTSIDE_DISH, OUTSIDE_DISH_ALPHA));
  });

  it('keeps every zone tint at or under the sheet-02 ceiling and fills the field once, uniformly', () => {
    const { context } = bake();
    const isZoneTint = (colour: string) => !colour.startsWith(`rgba(0, 0, 0`);
    const zoneStops = context.gradients.flatMap((gradient) => gradient.stops).filter((stop) => isZoneTint(stop.colour));
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
    const gelStrokes = bakeStrokes(1).filter((style) => GEL_RGBA_PREFIX.test(style));
    expect(gelStrokes).toHaveLength(PATCHES.length * MIRE_STRANDS_PER_PATCH);
  });

  it('places the strands and scratches from the cosmetic stream: same seed, same strokes; another seed, other strokes', () => {
    const first = bakeStrokes(1);
    expect(first).toHaveLength(PATCHES.length * MIRE_STRANDS_PER_PATCH + STAGE_SCRATCHES.count);
    expect(first).toEqual(bakeStrokes(1));
    expect(first).not.toEqual(bakeStrokes(2));
  });
});
