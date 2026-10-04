// The shore band (docs/rendering/opening-dive.md §4): a quad for the dive's own Pixi stage (one WebGL context), its
// shader compiled once into a pixel of its own; hidden outside its band; its tiles and then its levels baked in slices
// on the scheduler while there is work, at the stage's size from the first frame; ready once the tiles and the top
// level have baked; and everything given back on destroy, the shader first.

import { ManualScheduler } from '@evolution/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIVE_BAKE_INTERVAL_MS, DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import { SHORE_LEVEL_DRAFT_SCALE, SHORE_LOD } from '../../constants/dive-shore';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { QUICK_TILE_BAKES, TEST_SHORE_LAND } from '../../../../../testing/shore-paint-builder';
import { diveViewAt } from '../dive-view';
import { FakeBitmap, FakeShoreBakePort, fakeBitmap, fakeWorkerSnapshot } from '../../../../../testing/fake-shore-bake';
import { DiveShoreBand } from './dive-shore-band';
import { SHORE_BAKE_MESSAGE, type ShoreBakeRequest } from './shore-bake-messages';
import { ShoreBakeThread } from './shore-bake-thread';
import { SHORE_TILE_NAMES, ShoreTiles } from './shore-tiles';

const VIEWPORT = { width: 830, height: 467 };

function band(port: FakeShoreBakePort | null = null) {
  const pixi = createFakePixiApp(VIEWPORT);
  const factory = createFakeShoreCanvasFactory();
  const tiles = new ShoreTiles(factory, QUICK_TILE_BAKES);
  const thread = port === null ? null : new ShoreBakeThread(port, tiles);
  const subject = new DiveShoreBand(
    { land: TEST_SHORE_LAND, tiles, factory },
    1,
    (container, target) => pixi.renderToTexture(container, target),
    thread,
  );
  pixi.app.stage.addChild(subject.view);
  return { subject, pixi, tiles };
}

function lastRequest(port: FakeShoreBakePort): ShoreBakeRequest | undefined {
  return port.posted
    .map((posted) => posted.message)
    .filter((message): message is ShoreBakeRequest => message.type === SHORE_BAKE_MESSAGE.bake)
    .at(-1);
}

function view(zoom: number, timeSeconds = 0, deviceRatio = 1) {
  return diveViewAt({ zoom, viewport: VIEWPORT, timeSeconds, isMoving: false, globeIdleSpinDegrees: 0, deviceRatio });
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

  it('holds a fall at its edge until its tiles and top level have baked, and bakes ahead while the planet shows', () => {
    const { subject } = band();
    expect(subject.fallFloorZoom).toBe(SHORE_LOD.topZoom);
    subject.draw(view(6), true);
    bakeUntilReady(subject, new ManualScheduler());
    subject.draw(view(6), true);
    expect(subject.fallFloorZoom).toBeLessThan(SHORE_LOD.topZoom);
    subject.destroy();
  });

  describe('with a bake worker', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('bakes nothing on the page: the tiles and the levels the worker sends land, and destroy ends the worker', () => {
      vi.stubGlobal('ImageBitmap', FakeBitmap);
      const port = new FakeShoreBakePort();
      const { subject, tiles } = band(port);
      const scheduler = new ManualScheduler();
      let landed = 0;
      subject.bakeOn(
        scheduler,
        () => 0,
        () => (landed += 1),
      );
      subject.draw(view(6), true);
      scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS + DIVE_BAKE_INTERVAL_MS * 100);
      expect(SHORE_TILE_NAMES.filter((name) => tiles.has(name))).toEqual([]);
      expect(scheduler.pendingCallCount).toBe(0);
      for (const name of SHORE_TILE_NAMES) {
        port.send({ type: SHORE_BAKE_MESSAGE.tile, name, bitmap: fakeBitmap(), averageRgba: [0, 0, 0, 1] });
      }
      expect(landed).toBe(SHORE_TILE_NAMES.length);
      expect(tiles.isBaked).toBe(true);
      scheduler.advanceMilliseconds(DIVE_BAKE_INTERVAL_MS);
      const request = lastRequest(port);
      expect(request).toBeDefined();
      port.send({ type: SHORE_BAKE_MESSAGE.level, id: request!.id, snapshot: fakeWorkerSnapshot(request!.view) });
      scheduler.advanceMilliseconds(DIVE_BAKE_INTERVAL_MS);
      expect(subject.isReady).toBe(true);
      subject.destroy();
      expect(port.isTerminated).toBe(true);
    });

    it('bakes its levels at the governed ratio taken outside its band, and keeps them through a step inside it', () => {
      vi.stubGlobal('ImageBitmap', FakeBitmap);
      const port = new FakeShoreBakePort();
      const { subject, tiles } = band(port);
      const scheduler = new ManualScheduler();
      subject.bakeOn(
        scheduler,
        () => 0,
        () => undefined,
      );
      for (const name of SHORE_TILE_NAMES) {
        port.send({ type: SHORE_BAKE_MESSAGE.tile, name, bitmap: fakeBitmap(), averageRgba: [0, 0, 0, 1] });
      }
      expect(tiles.isBaked).toBe(true);
      const governed = 0.35;
      /** The ratio the worker was last asked to bake at, over the draft's scale. */
      const askedRatio = (): number => lastRequest(port)!.view.devicePixelRatio / SHORE_LEVEL_DRAFT_SCALE;
      subject.draw(view(6, 0, governed), true);
      scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS + DIVE_BAKE_INTERVAL_MS);
      expect(askedRatio()).toBeCloseTo(governed, 12);
      const anchor = lastRequest(port)!;
      port.send({ type: SHORE_BAKE_MESSAGE.level, id: anchor.id, snapshot: fakeWorkerSnapshot(anchor.view) });
      scheduler.advanceMilliseconds(DIVE_BAKE_INTERVAL_MS);
      // In the band the governor steps back up: the levels in view stay, baked at the ratio they were asked at.
      subject.draw(view(3, 0, 1), true);
      scheduler.advanceMilliseconds(DIVE_BAKE_INTERVAL_MS);
      expect(askedRatio()).toBeCloseTo(governed, 12);
      expect(subject.draw(view(3, 0, 1), true)).toBe(true);
      // Past its cut, the band hidden, the new ratio is taken.
      subject.draw(view(-2, 0, 1), true);
      subject.draw(view(3, 0, 1), true);
      scheduler.advanceMilliseconds(DIVE_BAKE_INTERVAL_MS);
      expect(askedRatio()).toBe(1);
      subject.destroy();
    });

    it('bakes the tiles on the page once the worker fails', () => {
      const port = new FakeShoreBakePort();
      const { subject, tiles } = band(port);
      const scheduler = new ManualScheduler();
      subject.bakeOn(
        scheduler,
        () => 0,
        () => undefined,
      );
      subject.draw(view(6), true);
      port.throwError();
      bakeUntilReady(subject, scheduler);
      expect(tiles.isBaked).toBe(true);
      expect(subject.isReady).toBe(true);
      subject.destroy();
    });
  });
});
