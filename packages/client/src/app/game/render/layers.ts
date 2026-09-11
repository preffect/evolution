// The scene graph (docs/ARCHITECTURE.md §6, docs/RENDERING.md §6): a world root the camera
// transforms, holding the layers in `LAYER_Z` order, and a screen root for the vignette. The
// orchestrator writes the world root's transform every frame; nothing else moves a layer.

import { Container } from 'pixi.js';
import type { CameraState, ViewportPx } from './camera';
import { worldToScreen, zoomFor } from './camera';
import { LAYER_NAMES, LAYER_Z, type LayerName } from './constants';

export interface SceneLayers extends Record<LayerName, Container> {
  readonly world: Container;
  readonly screen: Container;
}

export function createSceneLayers(stage: Container): SceneLayers {
  const world = new Container();
  const screen = new Container();
  const ordered: Record<LayerName, Container> = {
    dish: new Container(),
    depthFar: new Container(),
    food: new Container(),
    fragments: new Container(),
    cells: new Container(),
    depthNear: new Container(),
    effects: new Container(),
    debug: new Container(),
  };
  for (const name of LAYER_NAMES) {
    ordered[name].zIndex = LAYER_Z[name];
    world.addChild(ordered[name]);
  }
  world.sortableChildren = true;
  world.sortChildren();
  stage.addChild(world, screen);
  return { world, screen, ...ordered };
}

/** Points the world root at the camera: scale by the zoom, the camera centre at the viewport centre. */
export function applyCameraTransform(world: Container, camera: CameraState, viewport: ViewportPx): void {
  const zoom = zoomFor(camera, viewport);
  const origin = worldToScreen(camera, viewport, 0, 0);
  world.scale.set(zoom);
  world.position.set(origin.x, origin.y);
}
