import { describe, expect, it } from 'vitest';
import { DISH_RADIUS, RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { FakeBakeContext } from '../../../../testing/fake-bake-canvas';
import {
  CAUSTIC_ALPHA,
  CAUSTIC_SWEEPS,
  FIELD_MIN_STROKE_TEXELS,
  LIGHT_ACCENT,
  MIRE_STRAND,
  MIRE_STRANDS_PER_PATCH,
  MIRE_STRAND_ALPHA_MAX,
  MIRE_STRAND_ALPHA_MIN,
  STAGE_SCRATCH,
  STAGE_SCRATCHES,
  WALL_GLASS_WU,
  ZONE_GEL,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { fieldStrokePx, paintCaustics, placeMireStrands, placeStageScratches } from './dish-field-details';

const FIELD_SCALE = { pxPerWu: 0.33 };
const SPRITE_SCALE = { pxPerWu: 2 };

function random(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

describe('fieldStrokePx', () => {
  it('scales a width to px and never goes under the texel floor', () => {
    expect(fieldStrokePx(3, SPRITE_SCALE)).toBe(6);
    expect(fieldStrokePx(MIRE_STRAND.widthWuMin, FIELD_SCALE)).toBe(FIELD_MIN_STROKE_TEXELS);
  });
});

describe('paintCaustics', () => {
  it('strokes one open cubic sweep per table row, round-capped, in the condenser colour at the caustic alpha', () => {
    const context = new FakeBakeContext();
    paintCaustics(context, { x: 100, y: 100 }, FIELD_SCALE);
    expect(context.count('stroke')).toBe(CAUSTIC_SWEEPS.length);
    expect(context.count('bezierCurveTo')).toBe(CAUSTIC_SWEEPS.length);
    expect(context.count('closePath')).toBe(0);
    expect(context.strokeStyle).toBe(hexWithAlpha(LIGHT_ACCENT, CAUSTIC_ALPHA));
    expect(context.lineCap).toBe('round');
    expect(context.lineWidth).toBe(fieldStrokePx(CAUSTIC_SWEEPS.at(-1)!.widthWu, FIELD_SCALE));
  });

  it('maps y through pxPerWuY when the scale carries one and through pxPerWu when it does not', () => {
    const pool = { x: 100, y: 100 };
    const uniform = new FakeBakeContext();
    paintCaustics(uniform, pool, SPRITE_SCALE);
    const anisotropic = new FakeBakeContext();
    paintCaustics(anisotropic, pool, { pxPerWu: SPRITE_SCALE.pxPerWu, pxPerWuY: SPRITE_SCALE.pxPerWu * 2 });
    const [sweep] = CAUSTIC_SWEEPS;
    expect(uniform.argumentsOf('moveTo')[0]).toEqual([
      pool.x + sweep.start.x * SPRITE_SCALE.pxPerWu,
      pool.y + sweep.start.y * SPRITE_SCALE.pxPerWu,
    ]);
    expect(anisotropic.argumentsOf('moveTo')[0]).toEqual([
      pool.x + sweep.start.x * SPRITE_SCALE.pxPerWu,
      pool.y + sweep.start.y * SPRITE_SCALE.pxPerWu * 2,
    ]);
    expect(anisotropic.argumentsOf('stroke')).toEqual(uniform.argumentsOf('stroke'));
  });
});

const PATCH = { x: 400, y: -300, radius: 350 };
const HALF_EXTENT_WU = 3102;

describe('placeMireStrands', () => {
  it('places the sheet count of short bent curves in the patch, in the gel colour, at the strand widths and alphas', () => {
    const strands = placeMireStrands(PATCH, ZONE_GEL, random());
    expect(strands).toHaveLength(MIRE_STRANDS_PER_PATCH);
    for (const strand of strands) {
      expect(strand.colour).toBe(ZONE_GEL);
      expect(strand.control).not.toBeNull();
      const rootDistance = Math.hypot(strand.start.x - PATCH.x, strand.start.y - PATCH.y);
      expect(rootDistance).toBeLessThanOrEqual(MIRE_STRAND.rootShareMax * PATCH.radius);
      const length = Math.hypot(strand.end.x - strand.start.x, strand.end.y - strand.start.y);
      expect(length).toBeGreaterThanOrEqual(MIRE_STRAND.lengthShareMin * PATCH.radius - 1e-9);
      expect(length).toBeLessThanOrEqual(MIRE_STRAND.lengthShareMax * PATCH.radius + 1e-9);
      expect(strand.widthWu).toBeGreaterThanOrEqual(MIRE_STRAND.widthWuMin);
      expect(strand.widthWu).toBeLessThanOrEqual(MIRE_STRAND.widthWuMax);
      expect(strand.alpha).toBeGreaterThanOrEqual(MIRE_STRAND_ALPHA_MIN);
      expect(strand.alpha).toBeLessThanOrEqual(MIRE_STRAND_ALPHA_MAX);
    }
  });

  it('places the same strands for the same stream and other strands for another', () => {
    expect(placeMireStrands(PATCH, ZONE_GEL, random(1))).toEqual(placeMireStrands(PATCH, ZONE_GEL, random(1)));
    expect(placeMireStrands(PATCH, ZONE_GEL, random(1))).not.toEqual(placeMireStrands(PATCH, ZONE_GEL, random(2)));
  });
});

describe('placeStageScratches', () => {
  it('places the table count of straight lines on the stage, past the wall, in the scratch colour', () => {
    const scratches = placeStageScratches(HALF_EXTENT_WU, random());
    expect(scratches).toHaveLength(STAGE_SCRATCHES.count);
    const innerWu = DISH_RADIUS + WALL_GLASS_WU * STAGE_SCRATCHES.innerMarginGlass;
    for (const scratch of scratches) {
      expect(scratch.control).toBeNull();
      expect(scratch.colour).toBe(STAGE_SCRATCH);
      expect(scratch.widthWu).toBe(STAGE_SCRATCHES.widthWu);
      expect(Math.hypot(scratch.start.x, scratch.start.y)).toBeGreaterThanOrEqual(innerWu - 1e-9);
      expect(Math.hypot(scratch.start.x, scratch.start.y)).toBeLessThanOrEqual(HALF_EXTENT_WU + 1e-9);
      expect(scratch.alpha).toBeGreaterThanOrEqual(STAGE_SCRATCHES.alphaMin);
      expect(scratch.alpha).toBeLessThanOrEqual(STAGE_SCRATCHES.alphaMax);
    }
  });
});
