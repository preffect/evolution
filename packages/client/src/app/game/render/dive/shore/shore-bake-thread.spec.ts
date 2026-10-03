// The page's side of the shore's bake worker (docs/rendering/opening-dive.md §4, ticket #809): it opens the worker
// with the land and the tiles the page has, adopts each tile the worker sends into a page canvas, waits on a level
// without baking it, closes what lands stale or is never taken, and hands its bakes back to the page if the worker
// fails. Where the platform cannot bake offscreen there is no thread at all.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FakeBitmap,
  FakeShoreBakePort,
  fakeBitmap,
  fakeWorkerSnapshot,
  isClosed,
} from '../../../../../testing/fake-shore-bake';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import {
  QUICK_TILE_BAKES,
  TEST_SHORE_LAND,
  TEST_SHORE_STAGE,
  bakedTestTiles,
} from '../../../../../testing/shore-paint-builder';
import { SHORE_BAKE_MESSAGE, type ShoreBakeRequest } from './shore-bake-messages';
import { SHORE_BAKE_WAITING } from './shore-pump';
import { ShoreBakeThread, openShoreBakeThread } from './shore-bake-thread';
import { shoreLevelView } from './shore-lod';
import type { ShoreSnapshot } from './shore-snapshot';
import { SHORE_TILE_NAMES, ShoreTiles } from './shore-tiles';

const VIEW = shoreLevelView(0, TEST_SHORE_STAGE, 1, 1);

function thread(tiles = new ShoreTiles(createFakeShoreCanvasFactory(), QUICK_TILE_BAKES)) {
  const port = new FakeShoreBakePort();
  const factory = createFakeShoreCanvasFactory();
  const subject = new ShoreBakeThread(port, tiles, factory);
  const listener = { onTile: vi.fn(), onLevel: vi.fn(), onFailed: vi.fn() };
  subject.listen(listener);
  return { subject, port, tiles, listener };
}

function sources() {
  const factory = createFakeShoreCanvasFactory();
  return { land: TEST_SHORE_LAND, tiles: bakedTestTiles(factory), factory };
}

function snapshotOf(view = VIEW): ShoreSnapshot {
  return fakeWorkerSnapshot(view);
}

function requestIds(port: FakeShoreBakePort): number[] {
  return port.posted
    .filter((posted) => posted.message.type === SHORE_BAKE_MESSAGE.bake)
    .map((posted) => (posted.message as ShoreBakeRequest).id);
}

describe('ShoreBakeThread', () => {
  beforeEach(() => vi.stubGlobal('ImageBitmap', FakeBitmap));
  afterEach(() => vi.unstubAllGlobals());

  it('opens the worker with the land and a bitmap of every tile the page has, transferred', async () => {
    const tiles = new ShoreTiles(createFakeShoreCanvasFactory(), QUICK_TILE_BAKES);
    tiles.advance();
    tiles.advance();
    const { subject, port } = thread(tiles);
    await subject.open(TEST_SHORE_LAND, (canvas) => Promise.resolve(fakeBitmap(canvas.width, canvas.height)));
    const [opened] = port.posted;
    expect(opened!.message.type).toBe(SHORE_BAKE_MESSAGE.open);
    const sent = opened!.message.type === SHORE_BAKE_MESSAGE.open ? opened!.message.tiles : [];
    expect(sent.map((tile) => tile.name)).toEqual([SHORE_TILE_NAMES[0]]);
    expect(opened!.transfer).toEqual(sent.map((tile) => tile.bitmap));
  });

  it('sends nothing, and closes its bitmaps, when the dive ended before the tiles were copied', async () => {
    const tiles = new ShoreTiles(createFakeShoreCanvasFactory(), QUICK_TILE_BAKES);
    tiles.bakeAll();
    const { subject, port } = thread(tiles);
    const bitmaps: ImageBitmap[] = [];
    const opening = subject.open(TEST_SHORE_LAND, () => {
      const bitmap = fakeBitmap();
      bitmaps.push(bitmap);
      return Promise.resolve(bitmap);
    });
    subject.terminate();
    await opening;
    expect(port.posted).toEqual([]);
    expect(bitmaps.length).toBe(SHORE_TILE_NAMES.length);
    expect(bitmaps.every(isClosed)).toBe(true);
  });

  it('adopts a tile the worker sends into a page canvas, closes its bitmap and says so', () => {
    const { port, tiles, listener } = thread();
    const bitmap = fakeBitmap(8, 8);
    port.send({ type: SHORE_BAKE_MESSAGE.tile, name: 'rock', bitmap, averageRgba: [0.5, 0.25, 0, 1] });
    const tile = tiles.get('rock');
    expect(tile?.sizePx).toBe(8);
    expect(tile?.averageRgba).toEqual([0.5, 0.25, 0, 1]);
    expect(isClosed(bitmap)).toBe(true);
    expect(listener.onTile).toHaveBeenCalledTimes(1);
  });

  it('waits on its level without baking it, then lands it; a stale level is closed', () => {
    const { subject, port, listener } = thread();
    const bake = subject.bakeLevel(VIEW, sources());
    expect(bake.next()).toEqual({ done: false, value: SHORE_BAKE_WAITING });
    expect(requestIds(port)).toEqual([1]);
    const stale = snapshotOf();
    port.send({ type: SHORE_BAKE_MESSAGE.level, id: 0, snapshot: stale });
    expect(isClosed(stale.colour.image)).toBe(true);
    expect(isClosed(stale.stones!.image)).toBe(true);
    expect(bake.next().value).toBe(SHORE_BAKE_WAITING);
    const landed = snapshotOf();
    port.send({ type: SHORE_BAKE_MESSAGE.level, id: 1, snapshot: landed });
    expect(listener.onLevel).toHaveBeenCalledTimes(1);
    expect(bake.next()).toEqual({ done: true, value: landed });
    expect(isClosed(landed.colour.image)).toBe(false);
  });

  it('asks again for a level dropped and asked for anew, closing the old one should it land', () => {
    const { subject, port } = thread();
    subject.bakeLevel(VIEW, sources()).next();
    const again = subject.bakeLevel(VIEW, sources());
    again.next();
    expect(requestIds(port)).toEqual([1, 2]);
    const late = snapshotOf();
    port.send({ type: SHORE_BAKE_MESSAGE.level, id: 1, snapshot: late });
    expect(isClosed(late.colour.image)).toBe(true);
    expect(again.next().value).toBe(SHORE_BAKE_WAITING);
  });

  it.each([
    ['says it failed', (port: FakeShoreBakePort) => port.send({ type: SHORE_BAKE_MESSAGE.failed, reason: 'none' })],
    ['throws', (port: FakeShoreBakePort) => port.throwError()],
  ])('hands a bake under way back to the page when the worker %s', (_case, failWorker) => {
    const { subject, port, listener } = thread();
    const bake = subject.bakeLevel(VIEW, sources());
    bake.next();
    failWorker(port);
    expect(subject.hasFailed).toBe(true);
    expect(port.isTerminated).toBe(true);
    expect(listener.onFailed).toHaveBeenCalledTimes(1);
    let step = bake.next();
    for (let pass = 0; pass < 100 && step.done !== true; pass += 1) {
      expect(step.value).not.toBe(SHORE_BAKE_WAITING);
      step = bake.next();
    }
    expect(step.done).toBe(true);
    expect((step.value as ShoreSnapshot).view).toBe(VIEW);
    expect(subject.bakeLevel(VIEW, sources()).next().value).not.toBe(SHORE_BAKE_WAITING);
  });

  it('ends the worker on terminate, closing a level that landed and was never taken', () => {
    const { subject, port } = thread();
    subject.bakeLevel(VIEW, sources()).next();
    const landed = snapshotOf();
    port.send({ type: SHORE_BAKE_MESSAGE.level, id: 1, snapshot: landed });
    subject.terminate();
    expect(port.isTerminated).toBe(true);
    expect(port.onmessage).toBeNull();
    expect(isClosed(landed.colour.image)).toBe(true);
  });
});

/** A worker the page can make: it records where its script is and what it was sent. */
class RecordingWorker extends FakeShoreBakePort {
  static made: RecordingWorker[] = [];

  constructor(
    readonly url: URL,
    readonly options: WorkerOptions,
  ) {
    super();
    RecordingWorker.made.push(this);
  }
}

class TwoDimensionalCanvas {
  getContext(): object {
    return {};
  }
}

describe('openShoreBakeThread', () => {
  const page = {
    land: TEST_SHORE_LAND,
    tiles: new ShoreTiles(createFakeShoreCanvasFactory()),
    factory: createFakeShoreCanvasFactory(),
  };
  const toBitmap = () => Promise.resolve(fakeBitmap());

  /** A platform with these of a worker and an offscreen canvas. */
  function platform(worker?: typeof Worker, canvas?: typeof OffscreenCanvas) {
    const scope: Partial<Pick<typeof globalThis, 'Worker' | 'OffscreenCanvas'>> = {};
    if (worker !== undefined) scope.Worker = worker;
    if (canvas !== undefined) scope.OffscreenCanvas = canvas;
    return scope;
  }
  const offscreen = TwoDimensionalCanvas as unknown as typeof OffscreenCanvas;
  const worker = RecordingWorker as unknown as typeof Worker;

  afterEach(() => {
    vi.unstubAllGlobals();
    RecordingWorker.made = [];
  });

  it('makes no worker where there is none, or no OffscreenCanvas with a 2D context', () => {
    expect(openShoreBakeThread(platform(), page, toBitmap)).toBeNull();
    expect(openShoreBakeThread(platform(worker), page, toBitmap)).toBeNull();
    class NoContextCanvas {
      getContext(): null {
        return null;
      }
    }
    const noContext = NoContextCanvas as unknown as typeof OffscreenCanvas;
    expect(openShoreBakeThread(platform(worker, noContext), page, toBitmap)).toBeNull();
    expect(RecordingWorker.made).toEqual([]);
  });

  it('starts the bundled bake worker as a module and opens it with the land', async () => {
    vi.stubGlobal('Worker', RecordingWorker);
    const subject = openShoreBakeThread(platform(worker, offscreen), page, toBitmap);
    expect(subject).not.toBeNull();
    const [made] = RecordingWorker.made;
    // the builder bundled `shore-bake.worker.ts` into a worker file of its own and pointed the URL at it
    expect(made!.url.pathname).toMatch(/\/worker-[A-Z0-9]+\.js$/);
    expect(made!.options).toEqual({ type: 'module' });
    await Promise.resolve();
    await Promise.resolve();
    expect(made!.posted.map((posted) => posted.message.type)).toEqual([SHORE_BAKE_MESSAGE.open]);
  });
});
