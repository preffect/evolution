// The slime band over the fake Pixi app (docs/rendering/opening-dive.md §4, ticket #803): its programs warmed up unseen
// when it opens and its textures uploaded unseen once its bakes land; ready only once its bakes and the shore's caustic
// tile are; a fall held above it until then; the stand-in before (the floor, the scatters once made, the plankton's
// halos and strokes, never the atlases' meshes); its textures made once; and every GPU object given back.

import type { Geometry, Mesh, Shader } from 'pixi.js';
import { describe, expect, it, vi } from 'vitest';
import { DIVE_SLIME_WINDOW } from '../../constants';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { SLIME_BAND_TEST_TIMEOUT_MS, quickSlimeBake, testSlimeScatters } from '../../../../../testing/slime-builder';
import type { ShoreTileSource } from '../shore/shore-tiles';
import { diveViewAt } from '../dive-view';
import { DiveSlimeBand } from './dive-slime-band';
import { SlimeBakes } from './slime-bakes';
import { SLIME_FLOOR_UNIFORM } from './slime-shader-floor';
import { createSlimeParts } from './slime-module';

const viewAt = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

function* quickScatters() {
  yield;
  return testSlimeScatters();
}

function band(tiles: ShoreTileSource = bakedTestTiles()) {
  const app = createFakePixiApp();
  const factory = createFakeShoreCanvasFactory();
  const bakes = new SlimeBakes({ factory, devicePixelRatio: 1 }, quickSlimeBake(2), quickScatters);
  const subject = new DiveSlimeBand({ bakes, tiles, factory }, (container, target) =>
    app.renderToTexture(container, target),
  );
  const bakeAll = (): void => {
    let nowMs = 0;
    while (!bakes.isBaked) bakes.pump(100, () => (nowMs += 1));
  };
  return { app, bakes, subject, bakeAll };
}

/** The band's meshes by name, from its root in the mockup's order. */
function meshesOf(subject: DiveSlimeBand) {
  const children = subject.view.children as Mesh<Geometry, Shader>[];
  const [floor, clouds, diatoms, pocket, plankton, outside, rods, motes, skin] = children;
  return { floor, clouds, diatoms, pocket, plankton, outside, rods, motes, skin };
}

describe('DiveSlimeBand', { timeout: SLIME_BAND_TEST_TIMEOUT_MS }, () => {
  it('warms its programs up unseen when it opens, every mesh hidden after', () => {
    const { app, subject } = band();
    expect(app.textureRenders).toHaveLength(1);
    expect(app.textureRenders[0]!.container).toBe(subject.view);
    expect(app.textureRenders[0]!.target.destroyed).toBe(true);
    const meshes = meshesOf(subject);
    expect([meshes.floor, meshes.diatoms, meshes.skin].every((mesh) => mesh!.visible === false)).toBe(true);
    subject.destroy();
  });

  it('is ready once its bakes and the shore’s caustic tile have landed, and holds a fall above it until then', () => {
    const noCaustic: ShoreTileSource = { get: () => null, isBaked: false };
    const { subject, bakeAll } = band(noCaustic);
    expect(subject.isReady).toBe(false);
    expect(subject.fallFloorZoom).toBe(DIVE_SLIME_WINDOW.fadeFromZoom);
    bakeAll();
    expect(subject.isReady).toBe(false);
    subject.destroy();
    const ready = band();
    ready.bakeAll();
    expect(ready.subject.isReady).toBe(true);
    expect(ready.subject.fallFloorZoom).toBe(Number.NEGATIVE_INFINITY);
    ready.subject.destroy();
  });

  it('stands in before its bakes: the floor and the plankton, the scatters once made, never the atlases’ meshes', () => {
    const { subject, bakes } = band();
    expect(subject.draw(viewAt(-3.9))).toBe(true);
    let meshes = meshesOf(subject);
    expect(meshes.floor!.visible).toBe(true);
    expect(meshes.plankton!.visible).toBe(true);
    expect(meshes.rods!.visible).toBe(false);
    let nowMs = 0;
    bakes.pump(4, () => (nowMs += 1));
    expect(bakes.scatters).not.toBeNull();
    expect(bakes.baked).toBeNull();
    subject.draw(viewAt(-3.9));
    meshes = meshesOf(subject);
    expect(meshes.diatoms!.geometry.indexBuffer.data.length).toBeGreaterThan(0);
    expect(meshes.rods!.visible).toBe(false);
    subject.destroy();
  });

  it('makes and uploads its textures once when its bakes land, and draws the atlases’ meshes from then on', () => {
    const { app, subject, bakeAll } = band();
    bakeAll();
    subject.draw(viewAt(-3.9));
    const floor = meshesOf(subject).floor as unknown as { shader: { resources: Record<string, unknown> } };
    const cells = floor.shader.resources[SLIME_FLOOR_UNIFORM.cells];
    expect(app.textureRenders).toHaveLength(2);
    subject.draw(viewAt(-3.9));
    expect(floor.shader.resources[SLIME_FLOOR_UNIFORM.cells]).toBe(cells);
    expect(app.textureRenders).toHaveLength(2);
    expect(meshesOf(subject).rods!.visible).toBe(true);
    subject.destroy();
  });

  it('uploads its textures on the first frame after its bakes land, in orbit, never on the frame the fall reaches it', () => {
    const { app, subject, bakeAll } = band();
    bakeAll();
    expect(subject.draw(viewAt(5))).toBe(false);
    expect(app.textureRenders).toHaveLength(2);
    subject.draw(viewAt(-2.2));
    expect(app.textureRenders).toHaveLength(2);
    subject.destroy();
  });

  it('hides everything outside its band', () => {
    const { subject } = band();
    expect(subject.draw(viewAt(-1.9))).toBe(false);
    expect(subject.view.children.every((child) => !child.visible)).toBe(true);
    subject.destroy();
  });

  it('gives every GPU object back on destroy, its bakes kept', () => {
    const { subject, bakes, bakeAll } = band();
    bakeAll();
    subject.draw(viewAt(-3.9));
    const meshes = meshesOf(subject);
    const destroyGeometry = vi.spyOn(meshes.rods!.geometry, 'destroy');
    subject.destroy();
    expect(subject.view.destroyed).toBe(true);
    expect(destroyGeometry).toHaveBeenCalledOnce();
    expect(bakes.baked).not.toBeNull();
  });
});

describe('createSlimeParts', { timeout: SLIME_BAND_TEST_TIMEOUT_MS }, () => {
  it('keeps one set of bakes for the page at each device pixel ratio', () => {
    const shore = { tiles: bakedTestTiles(), factory: createFakeShoreCanvasFactory() };
    const app = createFakePixiApp();
    const renderToTexture = app.renderToTexture.bind(app);
    const parts = createSlimeParts(shore, () => 0);
    const first = parts.createBand(renderToTexture, 1);
    const second = createSlimeParts(shore, () => 0).createBand(renderToTexture, 1);
    const sharper = parts.createBand(renderToTexture, 2);
    const bakesOf = (made: typeof first): unknown =>
      (made.band as unknown as { readonly sources: { readonly bakes: unknown } }).sources.bakes;
    expect(first.band).not.toBe(second.band);
    expect(bakesOf(second)).toBe(bakesOf(first));
    expect(bakesOf(sharper)).not.toBe(bakesOf(first));
    for (const made of [first, second, sharper]) made.band.destroy();
  });
});
