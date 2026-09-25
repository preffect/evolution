// The scene graph (docs/architecture/client.md §6, docs/rendering/budget.md §6): a world root the camera
// transforms, holding the layers in `LAYER_Z` order, and a screen root for the vignette. The dish field and its far
// particles sit on the world root; every layer above them sits in the drawn band, which a canvas wider than the
// interest aspect clips to its middle so the dish field alone fills the sides (#408). The orchestrator writes the
// world root's transform every frame and the band on every resize; nothing else moves a layer.

import type { CameraState } from '@evolution/shared';
import { Container, Graphics } from 'pixi.js';
import type { ViewportPx } from './camera';
import { drawnWidthPx, worldToScreen, zoomFor } from './camera';
import { hexToNumber } from './colour';
import { FIELD_LAYER_NAMES, LAYER_NAMES, LAYER_Z, WHITE, type LayerName } from './constants';
import { HALF } from './geometry';

export interface SceneLayers extends Record<LayerName, Container> {
  readonly world: Container;
  /** Under the world root, above the field layers: every layer the drawn band clips. */
  readonly band: Container;
  /** The band's clip rectangle in screen px, under the screen root; empty while the band spans the canvas. */
  readonly bandMask: Graphics;
  readonly screen: Container;
}

function isFieldLayer(name: LayerName): boolean {
  return FIELD_LAYER_NAMES.includes(name);
}

export function createSceneLayers(stage: Container): SceneLayers {
  const world = new Container();
  const band = new Container();
  const screen = new Container();
  const bandMask = new Graphics();
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
    (isFieldLayer(name) ? world : band).addChild(ordered[name]);
  }
  band.zIndex = Math.min(...LAYER_NAMES.filter((name) => !isFieldLayer(name)).map((name) => LAYER_Z[name]));
  world.addChild(band);
  for (const root of [world, band]) {
    root.sortableChildren = true;
    root.sortChildren();
  }
  screen.addChild(bandMask);
  stage.addChild(world, screen);
  return { world, band, bandMask, screen, ...ordered };
}

/** Points the world root at the camera: scale by the zoom, the camera centre at the viewport centre. */
export function applyCameraTransform(world: Container, camera: CameraState, viewport: ViewportPx): void {
  const zoom = zoomFor(camera, viewport);
  const origin = worldToScreen(camera, viewport, 0, 0);
  world.scale.set(zoom);
  world.position.set(origin.x, origin.y);
}

/**
 * Clips the band to `drawnWidthPx` centred on the viewport, or lifts the clip when the band spans the canvas. The
 * mask is a stencil rectangle (two draw calls), so a canvas no wider than the interest aspect pays nothing.
 */
export function applyDrawnBand(layers: Pick<SceneLayers, 'band' | 'bandMask'>, viewport: ViewportPx): void {
  const width = drawnWidthPx(viewport);
  layers.band.mask = null;
  layers.bandMask.clear();
  if (width >= viewport.width) return;
  layers.bandMask.rect((viewport.width - width) * HALF, 0, width, viewport.height).fill(hexToNumber(WHITE));
  layers.band.mask = layers.bandMask;
}
