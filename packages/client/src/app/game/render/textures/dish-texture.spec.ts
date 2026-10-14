import { describe, expect, it } from 'vitest';
import {
  COSMETIC_SUB_STREAM,
  DISH_RADIUS,
  RANDOM_STREAM,
  createSeededRandom,
  type GelPatchView,
} from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import {
  FIELD_TEXTURE_PX,
  MIRE_STRANDS_PER_PATCH,
  OUTSIDE_DISH,
  OUTSIDE_DISH_ALPHA,
  STAGE_SCRATCH,
  STAGE_SCRATCHES,
  WALL_INNER_SHADOW,
  WALL_INNER_SHADOW_ALPHA,
  ZONE_GEL,
  ZONE_SHALLOWS,
  ZONE_TINT_ALPHA,
  ZONE_VENT,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { placeMireStrands } from './dish-field-details';
import { bakeDishField } from './dish-texture';

const PATCHES: GelPatchView[] = [
  { x: 500, y: 500, radius: 350 },
  { x: -900, y: 200, radius: 350 },
];

function cosmetic(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

function bake(patches: GelPatchView[] = PATCHES) {
  const field = bakeDishField(createFakeBakeCanvasFactory(), patches, cosmetic());
  return { field, context: fakeContextOf(field.canvas) };
}

describe('bakeDishField', () => {
  it('covers the dish and its wall at the field resolution, centred on the origin', () => {
    const { field } = bake([]);
    expect(field.canvas.width).toBe(FIELD_TEXTURE_PX);
    expect(field.canvas.height).toBe(FIELD_TEXTURE_PX);
    expect(field.halfExtentWu).toBeGreaterThan(DISH_RADIUS);
  });

  it('paints in sheet-02 order: field, shallows, vent tint, wall shadow, the outside; no pool (§6.1), no lines (#223)', () => {
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
    expect(context.count('stroke')).toBe(0);
    expect(context.fillStyle).toBe(hexWithAlpha(OUTSIDE_DISH, OUTSIDE_DISH_ALPHA));
  });

  it('leaves the vent tint out when asked (the opening dive’s dish), and only that', () => {
    const field = bakeDishField(createFakeBakeCanvasFactory(), [], cosmetic(), false);
    const [shallows, shadow] = fakeContextOf(field.canvas).gradients;
    expect(fakeContextOf(field.canvas).gradients).toHaveLength(2);
    expect(shallows!.stops[0]!.colour).toBe(hexWithAlpha(ZONE_SHALLOWS, 0));
    expect(shadow!.stops[0]!.colour).toBe(hexWithAlpha(WALL_INNER_SHADOW, 0));
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

  it('draws every gel patch as a mire tint and strokes no line into the field, at any number of patches', () => {
    const bare = bake([]).context;
    const patched = bake().context;
    expect(patched.gradients).toHaveLength(bare.gradients.length + PATCHES.length);
    expect(patched.count('stroke')).toBe(0);
    expect(patched.count('quadraticCurveTo')).toBe(0);
  });

  it('places the strands of every patch, then the scratches, as world-space details beside the bake', () => {
    const { field } = bake();
    const strands = field.details.slice(0, PATCHES.length * MIRE_STRANDS_PER_PATCH);
    const scratches = field.details.slice(PATCHES.length * MIRE_STRANDS_PER_PATCH);
    expect(scratches).toHaveLength(STAGE_SCRATCHES.count);
    expect(strands.every((detail) => detail.colour === ZONE_GEL && detail.control !== null)).toBe(true);
    expect(scratches.every((detail) => detail.colour === STAGE_SCRATCH && detail.control === null)).toBe(true);
    PATCHES.forEach((patch, index) => {
      for (const strand of strands.slice(index * MIRE_STRANDS_PER_PATCH, (index + 1) * MIRE_STRANDS_PER_PATCH)) {
        expect(Math.hypot(strand.start.x - patch.x, strand.start.y - patch.y)).toBeLessThanOrEqual(patch.radius);
      }
    });
  });

  it('places the details from the dish sub-stream of the cosmetic stream: same seed, same details; another, others', () => {
    const detailsFor = (seed: number) => bakeDishField(createFakeBakeCanvasFactory(), PATCHES, cosmetic(seed)).details;
    expect(detailsFor(1)).toEqual(detailsFor(1));
    expect(detailsFor(1)).not.toEqual(detailsFor(2));
    const dishStream = cosmetic(1).fork(COSMETIC_SUB_STREAM.dish);
    expect(detailsFor(1).slice(0, MIRE_STRANDS_PER_PATCH)).toEqual(placeMireStrands(PATCHES[0]!, ZONE_GEL, dishStream));
  });
});
