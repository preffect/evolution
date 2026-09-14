import { describe, expect, it } from 'vitest';
import { INDICATOR_FILL_TWEEN_MS } from '../constants';
import { IndicatorFillTween } from './indicator-fill-tween';

const HALF_TWEEN_MS = INDICATOR_FILL_TWEEN_MS / 2;

describe('IndicatorFillTween', () => {
  it('shows the first target at once, then eases linearly to a new one over the tween', () => {
    const tween = new IndicatorFillTween();
    expect(tween.update(0.2, 1000, false)).toBe(0.2);
    expect(tween.update(0.6, 1000, false)).toBeCloseTo(0.2, 9);
    expect(tween.update(0.6, 1000 + HALF_TWEEN_MS, false)).toBeCloseTo(0.4, 9);
    expect(tween.update(0.6, 1000 + INDICATOR_FILL_TWEEN_MS, false)).toBeCloseTo(0.6, 9);
    expect(tween.update(0.6, 5000, false)).toBeCloseTo(0.6, 9);
  });

  it('starts a retarget from where the fill is, not from the old target', () => {
    const tween = new IndicatorFillTween();
    tween.update(0, 0, false);
    tween.update(1, 0, false);
    expect(tween.update(0, HALF_TWEEN_MS, false)).toBeCloseTo(0.5, 9);
    expect(tween.update(0, HALF_TWEEN_MS * 2, false)).toBeCloseTo(0.25, 9);
  });

  it('jumps on a snap (a level-up) and after a reset (a new cell)', () => {
    const tween = new IndicatorFillTween();
    tween.update(0.9, 0, false);
    expect(tween.update(0.1, 10, true)).toBe(0.1);
    tween.reset();
    expect(tween.update(0.7, 20, false)).toBe(0.7);
  });
});
