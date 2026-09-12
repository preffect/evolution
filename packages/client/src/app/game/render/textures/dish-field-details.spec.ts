import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { FakeBakeContext } from '../../../../testing/fake-bake-canvas';
import {
  CAUSTIC_ALPHA,
  CAUSTIC_SWEEPS,
  FIELD_MIN_STROKE_TEXELS,
  LIGHT_ACCENT,
  MIRE_STRAND,
  MIRE_STRANDS_PER_PATCH,
  STAGE_SCRATCHES,
  ZONE_GEL,
} from '../constants';
import { hexWithAlpha } from '../colour';
import { fieldStrokePx, paintCaustics, paintMireStrands, paintStageScratches } from './dish-field-details';

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

describe('paintMireStrands', () => {
  it('strokes the sheet count of short curves in the gel colour at the strand alphas', () => {
    const context = new FakeBakeContext();
    paintMireStrands(context, { x: 0, y: 0, radius: 100 }, { colour: ZONE_GEL, random: random(), scale: SPRITE_SCALE });
    expect(context.count('stroke')).toBe(MIRE_STRANDS_PER_PATCH);
    expect(context.count('quadraticCurveTo')).toBe(MIRE_STRANDS_PER_PATCH);
    expect(context.strokeStyle).toMatch(/^rgba\(176, 112, 255, 0\.[12]/);
    expect(context.lineWidth).toBeGreaterThanOrEqual(MIRE_STRAND.widthWuMin * SPRITE_SCALE.pxPerWu);
    expect(context.lineWidth).toBeLessThanOrEqual(MIRE_STRAND.widthWuMax * SPRITE_SCALE.pxPerWu);
  });

  it('draws the same strands for the same stream and other strands for another', () => {
    const strokes = (seed: number) => {
      const context = new FakeBakeContext();
      const widths: number[] = [];
      context.stroke = () => widths.push(context.lineWidth);
      paintMireStrands(
        context,
        { x: 0, y: 0, radius: 100 },
        { colour: ZONE_GEL, random: random(seed), scale: SPRITE_SCALE },
      );
      return widths;
    };
    expect(strokes(1)).toEqual(strokes(1));
    expect(strokes(1)).not.toEqual(strokes(2));
  });
});

describe('paintStageScratches', () => {
  it('strokes the table count of straight lines in the scratch colour', () => {
    const context = new FakeBakeContext();
    paintStageScratches(context, { centre: 1024, halfExtentWu: 3000 }, { random: random(), scale: FIELD_SCALE });
    expect(context.count('stroke')).toBe(STAGE_SCRATCHES.count);
    expect(context.count('lineTo')).toBe(STAGE_SCRATCHES.count);
    expect(context.strokeStyle).toMatch(/^rgba\(42, 61, 88, 0\.(2[5-9]|3[0-5])/);
  });
});
