import { INTEREST_VIEW_ASPECT_RATIO, parkCamera } from '@evolution/shared';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { FIELD_LAYER_NAMES, LAYER_NAMES, LAYER_Z } from './constants';
import { applyCameraTransform, applyDrawnBand, createSceneLayers, type SceneLayers } from './layers';

/** Every layer's container in the order the renderer draws them: the world root's children, the band's in its place. */
function drawOrder(layers: SceneLayers): Container[] {
  return layers.world.children.flatMap((child) => (child === layers.band ? layers.band.children : [child]));
}

describe('createSceneLayers', () => {
  it('names every layer of LAYER_Z once, in z order, under one world root beside the screen root', () => {
    expect([...LAYER_NAMES]).toEqual(Object.keys(LAYER_Z));
    const stage = new Container();
    const layers = createSceneLayers(stage);
    expect(stage.children).toEqual([layers.world, layers.screen]);
    expect(drawOrder(layers)).toEqual(LAYER_NAMES.map((name) => layers[name]));
    expect(drawOrder(layers).map((child) => child.zIndex)).toEqual(LAYER_NAMES.map((name) => LAYER_Z[name]));
  });

  it('keeps the field layers on the world root and every layer above them in the band', () => {
    const layers = createSceneLayers(new Container());
    expect(layers.world.children).toEqual([...FIELD_LAYER_NAMES.map((name) => layers[name]), layers.band]);
    expect(layers.band.children).toEqual(
      LAYER_NAMES.filter((name) => !FIELD_LAYER_NAMES.includes(name)).map((name) => layers[name]),
    );
    expect(layers.screen.children).toContain(layers.bandMask);
  });

  it('scales the world root by the zoom and puts the camera centre at the viewport centre', () => {
    const layers = createSceneLayers(new Container());
    applyCameraTransform(layers.world, parkCamera({ x: 100, y: 50, radius: 10 }), { width: 800, height: 600 });
    expect(layers.world.scale.x).toBeGreaterThan(0);
    expect(layers.world.position.x).toBeCloseTo(400 - 100 * layers.world.scale.x, 6);
    expect(layers.world.position.y).toBeCloseTo(300 - 50 * layers.world.scale.y, 6);
  });
});

describe('applyDrawnBand', () => {
  it('clips the band to the interest aspect, centred, on a canvas wider than it (#408)', () => {
    const layers = createSceneLayers(new Container());
    const viewport = { width: 3000, height: 1000 };
    applyDrawnBand(layers, viewport);
    const drawnWidth = INTEREST_VIEW_ASPECT_RATIO * viewport.height;
    expect(layers.band.mask).toBe(layers.bandMask);
    const bounds = layers.bandMask.getLocalBounds();
    expect(bounds.width).toBeCloseTo(drawnWidth, 6);
    expect(bounds.height).toBeCloseTo(viewport.height, 6);
    expect(bounds.x).toBeCloseTo((viewport.width - drawnWidth) / 2, 6);
    expect(bounds.x + bounds.width / 2).toBeCloseTo(viewport.width / 2, 6);
  });

  it('lifts the clip and empties the mask once the canvas is no wider than the interest aspect', () => {
    const layers = createSceneLayers(new Container());
    applyDrawnBand(layers, { width: 3000, height: 1000 });
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 3440, height: 1440 },
      { width: INTEREST_VIEW_ASPECT_RATIO * 1000, height: 1000 },
    ]) {
      applyDrawnBand(layers, viewport);
      expect(layers.band.mask).toBeFalsy();
      expect(layers.bandMask.getLocalBounds().width).toBe(0);
    }
  });
});
