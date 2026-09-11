import { describe, expect, it } from 'vitest';
import { DNA_TAG } from '@evolution/shared';
import { createFakeBakeCanvasFactory, fakeContextOf } from '../../../../testing/fake-bake-canvas';
import { DNA_FRAGMENT_HALO, DNA_FRAGMENT_RUNGS, DNA_FRAGMENT_SIZE_WU, DNA_STRAND, DNA_TAG_COLOR } from '../constants';
import { hexWithAlpha } from '../colour';
import { bakeFragmentSprite } from './fragment-bake';

const PX_PER_WU = 4;

describe('bakeFragmentSprite', () => {
  const sprite = bakeFragmentSprite(createFakeBakeCanvasFactory(), DNA_TAG.motile, PX_PER_WU);
  const context = fakeContextOf(sprite);

  it('is square, wide enough for the wide halo plus its margin', () => {
    const halo = DNA_FRAGMENT_HALO.radius * PX_PER_WU;
    expect(sprite.width).toBe(sprite.height);
    expect(sprite.width).toBeGreaterThanOrEqual(halo * 2);
    expect(sprite.width).toBeGreaterThanOrEqual(DNA_FRAGMENT_SIZE_WU.length * PX_PER_WU);
  });

  it('paints the tag halo, the strand halo, one rung per rung and two strands', () => {
    expect(context.gradients[0]!.stops[0]!.colour).toBe(hexWithAlpha(DNA_TAG_COLOR.motile, DNA_FRAGMENT_HALO.alpha));
    expect(context.gradients[1]!.stops[0]!.colour).toBe(hexWithAlpha(DNA_STRAND, DNA_FRAGMENT_HALO.innerAlpha));
    expect(context.count('stroke')).toBe(DNA_FRAGMENT_RUNGS + 2);
    expect(context.count('fill')).toBe(2);
    expect(context.globalAlpha).toBe(1);
  });

  it('keeps the strands visible at the small variant scale', () => {
    const small = fakeContextOf(bakeFragmentSprite(createFakeBakeCanvasFactory(), DNA_TAG.toxic, 1));
    expect(small.lineWidth).toBeGreaterThanOrEqual(1);
    expect(small.count('stroke')).toBe(DNA_FRAGMENT_RUNGS + 2);
  });
});
