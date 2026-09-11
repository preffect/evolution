import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '@evolution/shared';
import { DEPTH_FAR, DEPTH_FIELD_WU, DEPTH_PARALLAX } from '../constants';
import { DEPTH_LAYER, DEPTH_TINTS, depthParticlePosition, depthParticleSpecs } from './depth-particles';

const TEST_SEED = 3;

describe('depth particles', () => {
  it("draws the far layer's count inside the field window, seeded", () => {
    const specs = depthParticleSpecs(DEPTH_LAYER.far, createSeededRandom(TEST_SEED));
    expect(specs).toHaveLength(DEPTH_FAR.count);
    for (const particle of specs) {
      expect(particle.x).toBeGreaterThanOrEqual(0);
      expect(particle.x).toBeLessThan(DEPTH_FIELD_WU.width);
      expect(particle.radiusWu).toBeGreaterThanOrEqual(DEPTH_FAR.radiusMin);
      expect(particle.alpha).toBeLessThanOrEqual(DEPTH_FAR.alphaMax);
      expect(DEPTH_TINTS.far).toContain(particle.tint);
    }
    expect(new Set(specs.map((particle) => particle.tint)).size).toBe(DEPTH_TINTS.far.length);
    expect(depthParticleSpecs(DEPTH_LAYER.far, createSeededRandom(TEST_SEED))).toEqual(specs);
    expect(depthParticleSpecs(DEPTH_LAYER.near, createSeededRandom(TEST_SEED))).not.toEqual(specs);
  });

  it('keeps every particle inside the window around the camera as it drifts and the camera moves', () => {
    const particle = depthParticleSpecs(DEPTH_LAYER.bokeh, createSeededRandom(TEST_SEED))[0]!;
    for (const [time, camera] of [
      [0, { x: 0, y: 0 }],
      [500, { x: 4000, y: -3000 }],
      [9000, { x: -100, y: 50 }],
    ] as const) {
      const position = depthParticlePosition(particle, DEPTH_LAYER.bokeh, time, camera);
      expect(Math.abs(position.x - camera.x)).toBeLessThanOrEqual(DEPTH_FIELD_WU.width / 2);
      expect(Math.abs(position.y - camera.y)).toBeLessThanOrEqual(DEPTH_FIELD_WU.height / 2);
    }
  });

  it('moves with the camera at the layer parallax: the far layer follows it, the bokeh runs against it', () => {
    const particle = {
      ...depthParticleSpecs(DEPTH_LAYER.far, createSeededRandom(TEST_SEED))[0]!,
      x: 500,
      y: 300,
      driftWuPerSecond: 0,
    };
    const positionAt = (layer: 'far' | 'bokeh', cameraX: number) =>
      depthParticlePosition(particle, layer, 0, { x: cameraX, y: 0 }).x;
    expect(positionAt('far', 100) - positionAt('far', 0)).toBeCloseTo(100 * (1 - DEPTH_PARALLAX.far), 6);
    expect(positionAt('bokeh', 100) - positionAt('bokeh', 0)).toBeCloseTo(100 * (1 - DEPTH_PARALLAX.bokeh), 6);
  });
});
