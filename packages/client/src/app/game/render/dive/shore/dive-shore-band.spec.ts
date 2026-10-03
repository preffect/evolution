// The shore band (docs/rendering/opening-dive.md §4): its own Pixi canvas, drawn by the dive's frame and never by the
// app's ticker; hidden outside its band; its tiles and then its levels baked in slices on the scheduler while there is
// work; ready once the tiles and the top level have baked; and everything given back on destroy, the shader first.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import { DIVE_SHORE_CANVAS_TEST_ID, SHORE_LOD } from '../../constants/dive-shore';
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
  const subject = new DiveShoreBand(pixi, { land: TEST_SHORE_LAND, tiles, factory }, 1);
  return { subject, pixi, tiles };
}

function view(zoom: number, timeSeconds = 0) {
  return diveViewAt({ zoom, viewport: VIEWPORT, timeSeconds, isMoving: false, globeIdleSpinDegrees: 0 });
}

describe('DiveShoreBand', () => {
  it('names its canvas, stops the app’s ticker and compiles its shader once, unseen', () => {
    const { subject, pixi } = band();
    expect(subject.canvas.dataset['testid']).toBe(DIVE_SHORE_CANVAS_TEST_ID);
    expect(pixi.ticking.isRunning).toBe(false);
    expect(pixi.renderCalls.count).toBe(1);
    expect(subject.canvas.hidden).toBe(true);
    subject.destroy();
  });

  it('hides its canvas and draws nothing outside its band', () => {
    const { subject, pixi } = band();
    subject.draw(view(6), true);
    subject.draw(view(-2), true);
    expect(subject.canvas.hidden).toBe(true);
    expect(pixi.renderCalls.count).toBe(1);
    subject.destroy();
  });

  it('draws a frame in its band with no level yet: the quad hidden until one bakes', () => {
    const { subject, pixi } = band();
    subject.draw(view(3), false);
    expect(subject.canvas.hidden).toBe(false);
    expect(pixi.renderCalls.count).toBe(2);
    expect(pixi.stage.children[0]!.visible).toBe(false);
    subject.destroy();
  });

  it('bakes its tiles, then the levels near the camera, in slices, and is ready once the top level has baked', () => {
    const { subject, tiles, pixi } = band();
    const scheduler = new ManualScheduler();
    let clock = 0;
    let landed = 0;
    subject.bakeOn(
      scheduler,
      () => (clock += 1),
      () => (landed += 1),
    );
    expect(subject.isReady).toBe(false);
    scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    for (let slice = 0; slice < 20_000 && !subject.isReady; slice += 1) scheduler.advanceMilliseconds(10);
    expect(tiles.isBaked).toBe(true);
    expect(subject.isReady).toBe(true);
    expect(landed).toBeGreaterThan(0);
    subject.draw(view(SHORE_LOD.topZoom - 0.05, 2), true);
    expect(pixi.stage.children[0]!.visible).toBe(true);
    subject.destroy();
    expect(scheduler.pendingCallCount).toBe(0);
    expect(pixi.lifecycle.isDestroyed).toBe(true);
  });

  it('follows the stage’s size', () => {
    const { subject, pixi } = band();
    subject.resize({ width: 400, height: 300 });
    expect(pixi.screen).toEqual({ width: 400, height: 300 });
    subject.destroy();
  });
});
