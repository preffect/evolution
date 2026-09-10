import { describe, expect, it } from 'vitest';
import {
  EASING,
  EASING_NAMES,
  MOTION_CLIPS,
  MOTION_OVERSHOOT_MAX,
  MOTION_PULSE_MAX,
  sampleTrack,
} from '@evolution/shared';
import { ease } from './easing';

const SAMPLES = 200;

describe('ease', () => {
  it.each(EASING_NAMES)('%s starts at 0, ends at 1 and clamps outside the unit range', (name) => {
    expect(ease(name, 0)).toBeCloseTo(0, 9);
    expect(ease(name, 1)).toBeCloseTo(1, 9);
    expect(ease(name, -1)).toBeCloseTo(0, 9);
    expect(ease(name, 2)).toBeCloseTo(1, 9);
  });

  it('is monotonic for every curve but the back, which overshoots by at most 7.5 % of the delta', () => {
    for (const name of EASING_NAMES) {
      let peak = 0;
      let previous = 0;
      for (let index = 1; index <= SAMPLES; index += 1) {
        const value = ease(name, index / SAMPLES);
        peak = Math.max(peak, value);
        if (name !== EASING.easeOutBack) expect(value).toBeGreaterThanOrEqual(previous - 1e-9);
        previous = value;
      }
      expect(peak).toBeLessThanOrEqual(name === EASING.easeOutBack ? 1.075 + 1e-6 : 1 + 1e-9);
    }
  });

  it('keeps every sampled pulse track under the pulse cap and its overshoot under 3 % (sheet 03)', () => {
    for (const clip of Object.values(MOTION_CLIPS)) {
      const pulse = clip.tracks['pulse'];
      if (!pulse) continue;
      const keyframeMax = Math.max(...pulse.map((keyframe) => keyframe.value));
      let sampledMax = 0;
      for (let index = 0; index <= SAMPLES; index += 1) {
        sampledMax = Math.max(sampledMax, sampleTrack(pulse, (index / SAMPLES) * clip.duration, ease));
      }
      expect(sampledMax).toBeLessThanOrEqual(MOTION_PULSE_MAX + 1e-9);
      expect(sampledMax - keyframeMax).toBeLessThanOrEqual(MOTION_OVERSHOOT_MAX + 1e-9);
    }
  });

  it('matches the Penner midpoints', () => {
    expect(ease(EASING.easeOutQuad, 0.5)).toBeCloseTo(0.75, 9);
    expect(ease(EASING.easeInQuad, 0.5)).toBeCloseTo(0.25, 9);
    expect(ease(EASING.easeInOutQuad, 0.25)).toBeCloseTo(0.125, 9);
    expect(ease(EASING.easeInOutQuad, 0.75)).toBeCloseTo(0.875, 9);
    expect(ease(EASING.easeOutCubic, 0.5)).toBeCloseTo(0.875, 9);
    expect(ease(EASING.easeInOutSine, 0.5)).toBeCloseTo(0.5, 9);
    expect(ease(EASING.easeOutExpo, 0.5)).toBeCloseTo(1 - Math.pow(2, -5), 9);
  });
});
