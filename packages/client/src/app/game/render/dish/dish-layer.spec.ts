import { describe, expect, it } from 'vitest';
import { DISH_RADIUS } from '@evolution/shared';
import { Graphics, ParticleContainer, Sprite } from 'pixi.js';
import { createTestRenderTextures } from '../../../../testing/fake-pixi-app';
import { worldToScreen, type CameraState, type ViewportPx } from '../camera';
import {
  DEPTH_BOKEH,
  DEPTH_FAR,
  DEPTH_NEAR_PARTICLES,
  LIGHT_POOL_VIEW_CENTRE,
  LIGHT_POOL_VIEW_RADII,
  VENT_CENTRE_WU,
  WALL_GLASS_WU,
} from '../constants';
import {
  DishLayer,
  createDishFieldSprite,
  createLightPoolSprite,
  createVentSprite,
  drawDishWall,
  placeLightPoolSprite,
} from './dish-layer';

/** One bundle for the seed-agnostic tests: the bakes are the slow part (#226). */
const textures = createTestRenderTextures();
const VIEWPORT_1080P: ViewportPx = { width: 1920, height: 1080 };
const VIEWPORT_SMALL: ViewportPx = { width: 640, height: 400 };
/** The camera's zoom ends (VISUAL-STYLE §6): the spawn floor and the view ceiling, in px/wu at 1080p. */
const ZOOM_ENDS = [1.8, 0.36] as const;
const CAMERA_POSITIONS = [
  { x: 0, y: 0 },
  { x: 2400, y: -900 },
] as const;
const FAR_PARTICLES_INDEX = 4;

/** A camera at `zoom` px/wu for `viewport`, centred on `position`. */
function cameraAt(position: { x: number; y: number }, zoom: number, viewport: ViewportPx): CameraState {
  return { x: position.x, y: position.y, viewHalfHeightWu: viewport.height / 2 / zoom };
}

function layer(seed: number) {
  return new DishLayer(createTestRenderTextures({ seed }));
}

function farParticle(subject: DishLayer) {
  return (subject.container.children[FAR_PARTICLES_INDEX] as ParticleContainer).particleChildren[0]!;
}

describe('DishLayer', () => {
  it('puts the field, the light pool over it, the vent, the wall and the far particles under the cells and the near ones above', () => {
    const subject = new DishLayer(textures);
    const [field, lightPool, vent, wall, far] = subject.container.children;
    expect(field).toBeInstanceOf(Sprite);
    expect(lightPool).toBeInstanceOf(Sprite);
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
    const camera = cameraAt({ x: 100, y: -50 }, 1, VIEWPORT_1080P);
    const frame = { timeSeconds: 2, camera, viewport: VIEWPORT_1080P };
    first.update(frame);
    second.update(frame);
    expect(farParticle(first).x).toBe(farParticle(second).x);
    expect(farParticle(first).y).toBe(farParticle(second).y);
    const before = { x: farParticle(first).x, y: farParticle(first).y };
    first.update({ timeSeconds: 4, camera, viewport: VIEWPORT_1080P });
    expect(farParticle(first).x !== before.x || farParticle(first).y !== before.y).toBe(true);
  });

  it('re-places the light pool sprite every frame from the camera and the viewport', () => {
    const subject = new DishLayer(textures);
    const lightPool = subject.container.children[1] as Sprite;
    subject.update({
      timeSeconds: 0,
      camera: cameraAt(CAMERA_POSITIONS[1], 1.8, VIEWPORT_1080P),
      viewport: VIEWPORT_1080P,
    });
    const first = { x: lightPool.x, y: lightPool.y, width: lightPool.width };
    subject.update({
      timeSeconds: 1,
      camera: cameraAt(CAMERA_POSITIONS[0], 0.36, VIEWPORT_SMALL),
      viewport: VIEWPORT_SMALL,
    });
    expect(lightPool.x).not.toBe(first.x);
    expect(lightPool.y).not.toBe(first.y);
    expect(lightPool.width).not.toBe(first.width);
  });

  it('destroys both containers', () => {
    const subject = new DishLayer(textures);
    subject.destroy();
    expect(subject.container.destroyed).toBe(true);
    expect(subject.nearContainer.destroyed).toBe(true);
  });
});

describe('placeLightPoolSprite (RENDERING §6.1)', () => {
  it.each([VIEWPORT_1080P, VIEWPORT_SMALL])(
    'keeps the pool at LIGHT_POOL_VIEW_CENTRE / LIGHT_POOL_VIEW_RADII of a %o viewport at both zoom ends and two camera positions',
    (viewport) => {
      const sprite = createLightPoolSprite(textures);
      for (const zoom of ZOOM_ENDS) {
        for (const position of CAMERA_POSITIONS) {
          const camera = cameraAt(position, zoom, viewport);
          placeLightPoolSprite(sprite, camera, viewport);
          const centre = worldToScreen(camera, viewport, sprite.x, sprite.y);
          expect(centre.x).toBeCloseTo(LIGHT_POOL_VIEW_CENTRE.x * viewport.width, 6);
          expect(centre.y).toBeCloseTo(LIGHT_POOL_VIEW_CENTRE.y * viewport.height, 6);
          expect(sprite.width * zoom).toBeCloseTo(2 * LIGHT_POOL_VIEW_RADII.x * viewport.width, 6);
          expect(sprite.height * zoom).toBeCloseTo(2 * LIGHT_POOL_VIEW_RADII.y * viewport.height, 6);
        }
      }
    },
  );

  it('sits in the top-left of the view: its centre is left of and above the viewport centre', () => {
    const sprite = createLightPoolSprite(textures);
    const camera = cameraAt(CAMERA_POSITIONS[1], 1, VIEWPORT_1080P);
    placeLightPoolSprite(sprite, camera, VIEWPORT_1080P);
    const centre = worldToScreen(camera, VIEWPORT_1080P, sprite.x, sprite.y);
    expect(centre.x).toBeLessThan(VIEWPORT_1080P.width / 2);
    expect(centre.y).toBeLessThan(VIEWPORT_1080P.height / 2);
    expect(sprite.anchor.x).toBe(0.5);
    expect(sprite.anchor.y).toBe(0.5);
  });
});

describe('createDishFieldSprite / createVentSprite / drawDishWall', () => {
  it('centres the field bake on the origin and scales it to the bake extent, past the wall', () => {
    const field = createDishFieldSprite(textures);
    expect(field.anchor.x).toBe(0.5);
    expect(field.anchor.y).toBe(0.5);
    expect(field.width).toBeCloseTo(textures.dishField.halfExtentWu * 2, 6);
    expect(field.height).toBeCloseTo(field.width, 6);
    expect(field.width / 2).toBeGreaterThan(DISH_RADIUS + WALL_GLASS_WU);
  });

  it('centres the vent sprite on the vent zone and scales it to its bake extent', () => {
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
