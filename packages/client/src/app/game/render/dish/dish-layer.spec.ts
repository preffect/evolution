import { describe, expect, it } from 'vitest';
import { RANDOM_STREAM, createSeededRandom } from '@evolution/shared';
import { Graphics, ParticleContainer } from 'pixi.js';
import { createOnePixelTexture } from '../../../../testing/fake-pixi-app';
import { DEPTH_BOKEH, DEPTH_FAR, DEPTH_NEAR_PARTICLES } from '../constants';
import { DishLayer, drawDishField, drawDishWall } from './dish-layer';

function cosmetic(seed = 1) {
  return createSeededRandom(seed).fork(RANDOM_STREAM.cosmetic);
}

describe('DishLayer', () => {
  it('puts the field, the wall and the far particles under the cells and the near ones above', () => {
    const layer = new DishLayer(createOnePixelTexture(), cosmetic());
    const [field, wall, far] = layer.container.children;
    expect(field).toBeInstanceOf(Graphics);
    expect(wall).toBeInstanceOf(Graphics);
    expect(far).toBeInstanceOf(ParticleContainer);
    expect((far as ParticleContainer).particleChildren).toHaveLength(DEPTH_FAR.count);
    const [near, bokeh] = layer.nearContainer.children;
    expect((near as ParticleContainer).particleChildren).toHaveLength(DEPTH_NEAR_PARTICLES.count);
    expect((bokeh as ParticleContainer).particleChildren).toHaveLength(DEPTH_BOKEH.count);
  });

  it('moves the particles with time and the camera, deterministically for a seed', () => {
    const first = new DishLayer(createOnePixelTexture(), cosmetic(5));
    const second = new DishLayer(createOnePixelTexture(), cosmetic(5));
    const frame = { timeSeconds: 2, camera: { x: 100, y: -50 } };
    first.update(frame);
    second.update(frame);
    const particle = (container: DishLayer) =>
      (container.container.children[2] as ParticleContainer).particleChildren[0]!;
    expect(particle(first).x).toBe(particle(second).x);
    expect(particle(first).y).toBe(particle(second).y);
    const before = { x: particle(first).x, y: particle(first).y };
    first.update({ timeSeconds: 4, camera: { x: 100, y: -50 } });
    expect(particle(first).x !== before.x || particle(first).y !== before.y).toBe(true);
  });

  it('destroys both containers', () => {
    const layer = new DishLayer(createOnePixelTexture(), cosmetic());
    layer.destroy();
    expect(layer.container.destroyed).toBe(true);
    expect(layer.nearContainer.destroyed).toBe(true);
  });
});

describe('drawDishField / drawDishWall', () => {
  it('draw into the given graphics', () => {
    const field = new Graphics();
    drawDishField(field);
    expect(field.getLocalBounds().width).toBeGreaterThan(0);
    const wall = new Graphics();
    drawDishWall(wall);
    expect(wall.getLocalBounds().width).toBeGreaterThan(field.getLocalBounds().width);
  });
});
