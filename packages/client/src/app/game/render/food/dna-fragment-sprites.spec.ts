import { describe, expect, it } from 'vitest';
import { createSeededRandom, entityId } from '@evolution/shared';
import { MOTE_ATLAS_PX_PER_WU } from '../constants';
import { drawFragmentSpinPhase, fragmentAppearance } from './dna-fragment-sprites';

describe('dna fragment sprites', () => {
  it('spins 20 °/s from a per-fragment phase drawn from the cosmetic stream', () => {
    const phase = drawFragmentSpinPhase(createSeededRandom(3), entityId('f-1'));
    expect(phase).toBe(drawFragmentSpinPhase(createSeededRandom(3), entityId('f-1')));
    expect(phase).not.toBe(drawFragmentSpinPhase(createSeededRandom(3), entityId('f-2')));
    const texture = { width: 168, height: 168 };
    const start = fragmentAppearance(0.25, 0, texture);
    expect(start.rotation).toBeCloseTo(Math.PI / 2, 9);
    expect(fragmentAppearance(0.25, 9, texture).rotation - start.rotation).toBeCloseTo(Math.PI, 9);
    expect(start.widthWu).toBe(168 / MOTE_ATLAS_PX_PER_WU);
    expect(start.heightWu).toBe(start.widthWu);
  });
});
