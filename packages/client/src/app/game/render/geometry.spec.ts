import { describe, expect, it } from 'vitest';
import { clamp01, degreesToRadians, gaussianBump, hypot, lerp, smoothstep, wrapAngle } from './geometry';

describe('geometry helpers', () => {
  it('wraps angles into (−π, π]', () => {
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-2.5 * Math.PI)).toBeCloseTo(-Math.PI / 2, 9);
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 9);
  });

  it('ramps like GLSL smoothstep and clamps', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(1, 1, 0.5)).toBe(0);
    expect(smoothstep(1, 1, 1.5)).toBe(1);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(-2)).toBe(0);
    expect(lerp(2, 4, 0.25)).toBe(2.5);
    expect(hypot(3, 4)).toBe(5);
  });

  it('gives a Gaussian bump with its derivative', () => {
    const peak = gaussianBump(0.5, 0, 0.3);
    expect(peak.value).toBe(0.5);
    expect(peak.derivative).toBe(-0);
    const flank = gaussianBump(0.5, 0.3, 0.3);
    expect(flank.value).toBeCloseTo(0.5 * Math.exp(-0.5), 9);
    expect(flank.derivative).toBeCloseTo(-flank.value / 0.3, 9);
  });
});
