// The shore band (docs/rendering/opening-dive.md §4): a quad for the dive's own Pixi stage (one WebGL context), its
// shader compiled once into a pixel of its own; hidden outside its band; its tiles and then its levels baked in slices
// on the scheduler while there is work, at the stage's size from the first frame; ready once the tiles and the top
// level have baked; and everything given back on destroy, the shader first.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import { SHORE_LOD } from '../../constants/dive-shore';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { QUICK_TILE_BAKES, TEST_SHORE_LAND } from '../../../../../testing/shore-paint-builder';
import { diveViewAt } from '../dive-view';
import { DiveShoreBand } from './dive-shore-band';
import { ShoreTiles } from './shore-tiles';

const VIEWPORT = { width: 830, height: 467 };

function band() {
  const pixi = createFakePixiApp(VIEWPORT);
  const factory = createFakeShoreCanvasFactory();
  const tiles = new ShoreTiles(factory, QUICK_TILE_BAKES);
  const subject = new DiveShoreBand({ land: TEST_SHORE_LAND, tiles, factory }, 1, (container, target) =>
    pixi.renderToTexture(container, target),
  );
  pixi.app.stage.addChild(subject.view);
  return { subject, pixi, tiles };
}

function view(zoom: number, timeSeconds = 0) {
  return diveViewAt({ zoom, viewport: VIEWPORT, timeSeconds, isMoving: false, globeIdleSpinDegrees: 0 });
}

function bakeUntilReady(subject: DiveShoreBand, scheduler: ManualScheduler): number {
  let clock = 0;
  let landed = 0;
  subject.bakeOn(
    scheduler,
    () => (clock += 1),
    () => (landed += 1),
  );
  scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
  for (let slice = 0; slice < 20_000 && !subject.isReady; slice += 1) scheduler.advanceMilliseconds(10);
  return landed;
}

describe('DiveShoreBand', () => {
  it('compiles its shader once, unseen, into a pixel of its own, and leaves its quad hidden', () => {
    const { subject, pixi } = band();
    expect(pixi.textureRenders).toHaveLength(1);
    expect(pixi.textureRenders[0]!.container).toBe(subject.view);
    expect([pixi.textureRenders[0]!.target.width, pixi.textureRenders[0]!.target.height]).toEqual([1, 1]);
    expect(pixi.renderCalls.count).toBe(0);
    expect(subject.view.visible).toBe(false);
    subject.destroy();
  });

  it('shows nothing outside its band, nor in it before a level has baked', () => {
    const { subject } = band();
    expect(subject.draw(view(6), true)).toBe(false);
    expect(subject.draw(view(-2), true)).toBe(false);
    expect(subject.draw(view(3), false)).toBe(false);
    expect(subject.view.visible).toBe(false);
    subject.destroy();
  });

  it('bakes nothing for the levels until a frame gives it the stage’s size, even in orbit', () => {
    const { subject, tiles } = band();
    const scheduler = new ManualScheduler();
    subject.bakeOn(
      scheduler,
      () => 0,
      () => undefined,
    );
    for (let slice = 0; slice < 2000 && !tiles.isBaked; slice += 1) scheduler.advanceMilliseconds(10);
    scheduler.advanceMilliseconds(1000);
    expect(subject.isReady).toBe(false);
    subject.destroy();
  });

  it('bakes its tiles, then the levels near the camera, in slices, and is ready once the top level has baked', () => {
    const { subject, tiles } = band();
    const scheduler = new ManualScheduler();
    subject.draw(view(6), true);
    const landed = bakeUntilReady(subject, scheduler);
    expect(tiles.isBaked).toBe(true);
    expect(subject.isReady).toBe(true);
    expect(landed).toBeGreaterThan(0);
    expect(subject.draw(view(SHORE_LOD.topZoom - 0.05, 2), true)).toBe(true);
    expect(subject.view.visible).toBe(true);
    subject.destroy();
    expect(scheduler.pendingCallCount).toBe(0);
    expect(subject.view.destroyed).toBe(true);
  });
});
