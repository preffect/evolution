import { describe, expect, it } from 'vitest';
import { DISH_RADIUS } from '@evolution/shared';
import { Graphics, ParticleContainer, Sprite } from 'pixi.js';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { DEPTH_BOKEH, DEPTH_FAR, DEPTH_NEAR_PARTICLES, VENT_CENTRE_WU, WALL_GLASS_WU } from '../constants';
import { DishLayer, createDishFieldSprite, createVentSprite, drawDishWall } from './dish-layer';

function layer(seed = 1) {
  return new DishLayer(createTestRenderTextures({ seed }));
}

describe('DishLayer', () => {
  it('puts the field sprite, the vent over it, the wall and the far particles under the cells and the near ones above', () => {
    const subject = layer();
    const [field, vent, wall, far] = subject.container.children;
    expect(field).toBeInstanceOf(Sprite);
    expect(vent).toBeInstanceOf(Sprite);
    expect(wall).toBeInstanceOf(Graphics);
    expect(far).toBeInstanceOf(ParticleContainer);
    expect((far as ParticleContainer).particleChildren).toHaveLength(DEPTH_FAR.count);
    const [near, bokeh] = subject.nearContainer.children;
    expect((near as ParticleContainer).particleChildren).toHaveLength(DEPTH_NEAR_PARTICLES.count);
    expect((bokeh as ParticleContainer).particleChildren).toHaveLength(DEPTH_BOKEH.count);
  });

  it('moves the particles with time and the camera, deterministically for a seed', () => {
    const first = layer(5);
    const second = layer(5);
    const frame = { timeSeconds: 2, camera: { x: 100, y: -50 } };
    first.update(frame);
    second.update(frame);
    const particle = (container: DishLayer) =>
      (container.container.children[3] as ParticleContainer).particleChildren[0]!;
    expect(particle(first).x).toBe(particle(second).x);
    expect(particle(first).y).toBe(particle(second).y);
    const before = { x: particle(first).x, y: particle(first).y };
    first.update({ timeSeconds: 4, camera: { x: 100, y: -50 } });
    expect(particle(first).x !== before.x || particle(first).y !== before.y).toBe(true);
  });

  it('destroys both containers', () => {
    const subject = layer();
    subject.destroy();
    expect(subject.container.destroyed).toBe(true);
    expect(subject.nearContainer.destroyed).toBe(true);
  });
});

describe('createDishFieldSprite / createVentSprite / drawDishWall', () => {
  it('centres the field bake on the origin and scales it to the bake extent, past the wall', () => {
    const textures = createTestRenderTextures();
    const field = createDishFieldSprite(textures);
    expect(field.anchor.x).toBe(0.5);
    expect(field.anchor.y).toBe(0.5);
    expect(field.width).toBeCloseTo(textures.dishField.halfExtentWu * 2, 6);
    expect(field.height).toBeCloseTo(field.width, 6);
    expect(field.width / 2).toBeGreaterThan(DISH_RADIUS + WALL_GLASS_WU);
  });

  it('centres the vent sprite on the vent zone and scales it to its bake extent', () => {
    const textures = createTestRenderTextures();
    const vent = createVentSprite(textures);
    expect(vent.anchor.x).toBe(0.5);
    expect(vent.position.x).toBe(VENT_CENTRE_WU.x);
    expect(vent.position.y).toBe(VENT_CENTRE_WU.y);
    expect(vent.width).toBeCloseTo(textures.vent.halfExtentWu * 2, 6);
    expect(vent.height).toBeCloseTo(vent.width, 6);
  });

  it('draws the wall past the dish radius', () => {
    const wall = new Graphics();
    drawDishWall(wall);
    expect(wall.getLocalBounds().width / 2).toBeGreaterThan(DISH_RADIUS);
  });
});
