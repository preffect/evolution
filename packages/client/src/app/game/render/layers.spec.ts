import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { parkCamera } from './camera';
import { LAYER_NAMES, LAYER_Z } from './constants';
import { applyCameraTransform, createSceneLayers } from './layers';

describe('createSceneLayers', () => {
  it('names every layer of LAYER_Z once, in z order, under one world root beside the screen root', () => {
    expect([...LAYER_NAMES]).toEqual(Object.keys(LAYER_Z));
    const stage = new Container();
    const layers = createSceneLayers(stage);
    expect(stage.children).toEqual([layers.world, layers.screen]);
    expect(layers.world.children.map((child) => child.zIndex)).toEqual(LAYER_NAMES.map((name) => LAYER_Z[name]));
    expect(layers.world.children).toEqual(LAYER_NAMES.map((name) => layers[name]));
  });

  it('scales the world root by the zoom and puts the camera centre at the viewport centre', () => {
    const layers = createSceneLayers(new Container());
    applyCameraTransform(layers.world, parkCamera({ x: 100, y: 50, radius: 10 }), { width: 800, height: 600 });
    expect(layers.world.scale.x).toBeGreaterThan(0);
    expect(layers.world.position.x).toBeCloseTo(400 - 100 * layers.world.scale.x, 6);
    expect(layers.world.position.y).toBeCloseTo(300 - 50 * layers.world.scale.y, 6);
  });
});
