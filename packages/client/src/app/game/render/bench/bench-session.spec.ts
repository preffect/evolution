import { ManualClock, RENDER_STAGE_NAMES } from '@evolution/shared';
import { describe, expect, it, vi } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp } from '../../../../testing/fake-pixi-app';
import type { PixiAppOptions } from '../pixi-app';
import {
  RENDER_BENCH_DEFAULT_TICK,
  RENDER_BENCH_DEFAULT_ZOOM,
  RENDER_BENCH_REPORT_FRAMES,
  RENDER_BENCH_SEED,
  RENDER_BENCH_WARMUP_FRAMES,
} from '../constants';
import { GPU_TIMER_STATUS } from './gpu-timer';
import { BenchSession, isBenchRoute, parseBenchQuery, type BenchQuery, type RenderBenchReport } from './bench-session';

const DEFAULT_FLAGS = { shouldAdvanceTick: false, shouldPreserveDrawingBuffer: false };

describe('parseBenchQuery', () => {
  it('reads the seed, tick, zoom and flags with defaults for what is missing or malformed', () => {
    expect(parseBenchQuery('?bench=7&tick=300&zoom=1.8&window=12&advance=1&preserve=1')).toEqual({
      seed: 7,
      tick: 300,
      zoom: 1.8,
      windowFrames: 12,
      shouldAdvanceTick: true,
      shouldPreserveDrawingBuffer: true,
    });
    expect(parseBenchQuery('?bench')).toEqual({
      seed: RENDER_BENCH_SEED,
      tick: RENDER_BENCH_DEFAULT_TICK,
      zoom: RENDER_BENCH_DEFAULT_ZOOM,
      windowFrames: RENDER_BENCH_REPORT_FRAMES,
      ...DEFAULT_FLAGS,
    });
    expect(parseBenchQuery('?bench=abc&tick=1.9&zoom=x&window=0&advance=0&preserve=yes')).toEqual({
      seed: RENDER_BENCH_SEED,
      tick: 1,
      zoom: RENDER_BENCH_DEFAULT_ZOOM,
      windowFrames: 1,
      ...DEFAULT_FLAGS,
    });
  });

  it('never lets a zoom of zero or less through to the camera', () => {
    expect(parseBenchQuery('?bench&zoom=0').zoom).toBe(RENDER_BENCH_DEFAULT_ZOOM);
    expect(parseBenchQuery('?bench&zoom=-2').zoom).toBe(RENDER_BENCH_DEFAULT_ZOOM);
  });

  it('selects the bench route only when the bench parameter is present', () => {
    expect(isBenchRoute('?bench=42')).toBe(true);
    expect(isBenchRoute('?bench')).toBe(true);
    expect(isBenchRoute('?tick=3')).toBe(false);
    expect(isBenchRoute('')).toBe(false);
  });
});

const SMALL_ZOOM = 0.5;
const SMALL_WINDOW_FRAMES = 12;
const SMALL_COUNTS = { cells: 12, motes: 30, fragments: 5 };
const BYTES_PER_FRAME = 16;

/** A heap that grows `BYTES_PER_FRAME` per read after the collection the bench asks for. */
function fakeHeap() {
  let reads = 0;
  return {
    collectGarbage: vi.fn(),
    readHeapBytes: () => {
      reads += 1;
      return 1000 + (reads - 1) * BYTES_PER_FRAME * SMALL_WINDOW_FRAMES;
    },
  };
}

const SMALL_QUERY: BenchQuery = {
  seed: RENDER_BENCH_SEED,
  tick: 60,
  zoom: SMALL_ZOOM,
  windowFrames: SMALL_WINDOW_FRAMES,
  ...DEFAULT_FLAGS,
};

async function session(query: BenchQuery = SMALL_QUERY) {
  const pixi = createFakePixiApp();
  const heap = fakeHeap();
  const reports: RenderBenchReport[] = [];
  const appOptions: PixiAppOptions[] = [];
  const subject = new BenchSession(query, {
    host: document.createElement('div'),
    clock: new ManualClock(0),
    devicePixelRatio: 1,
    createPixiApp: (options) => {
      appOptions.push(options);
      return Promise.resolve(pixi);
    },
    heap,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    counts: SMALL_COUNTS,
    onReport: (report) => reports.push(report),
  });
  await subject.start();
  return { subject, pixi, heap, reports, appOptions };
}

describe('BenchSession', () => {
  it('renders the parked tick every frame and reports once after the warm-up and the window', async () => {
    const { subject, pixi, heap, reports } = await session();
    expect(pixi.tickerCallbacks).toHaveLength(1);
    const api = subject.debugApi();
    expect(api.mode).toBe('bench');
    for (let frame = 0; frame < RENDER_BENCH_WARMUP_FRAMES + SMALL_WINDOW_FRAMES - 1; frame += 1) pixi.tick();
    expect(reports).toHaveLength(0);
    expect(heap.collectGarbage).toHaveBeenCalledTimes(1);
    expect(api.renderTick()).toBeCloseTo(60, 6);
    pixi.tick();
    expect(reports).toHaveLength(1);
    const report = reports[0]!;
    expect(report).toMatchObject({ seed: RENDER_BENCH_SEED, tick: 60, frames: SMALL_WINDOW_FRAMES });
    expect(report.zoom).toBeCloseTo(SMALL_ZOOM);
    expect(report.heapGrowthBytesPerFrame).toBe(BYTES_PER_FRAME);
    expect(report.visibleCells).toBeGreaterThan(0);
    expect(report.isTickAdvancing).toBe(false);
    expect(report.gpuStatus).toBe(GPU_TIMER_STATUS.unsupported);
    expect(report.gpuMs).toBeNull();
    expect(Object.keys(report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
    expect(report.verdict.isWithinBudget).toBe(true);
    expect(report.verdict.sampleCount).toBe(SMALL_WINDOW_FRAMES);
    expect(report.verdict.isP95Estimable, 'a twelve-frame window cannot support a p95').toBe(false);
    expect(report.verdict.isFullyJudged).toBe(false);
    expect(api.performanceReport()).toBe(report);
    pixi.tick();
    expect(reports).toHaveLength(1);
    expect(pixi.renderCalls.count).toBe(RENDER_BENCH_WARMUP_FRAMES + SMALL_WINDOW_FRAMES + 1);
  });

  it('renders the production context unless `preserve=1` asks for the readable backbuffer', async () => {
    const { appOptions } = await session();
    expect(appOptions[0]).toMatchObject({ shouldPreserveDrawingBuffer: false });
    const preserved = await session({ ...SMALL_QUERY, shouldPreserveDrawingBuffer: true });
    expect(preserved.appOptions[0]).toMatchObject({ shouldPreserveDrawingBuffer: true });
  });

  it('steps the scene a tick a frame under `advance=1`, so the snapshot apply is inside the window', async () => {
    const { subject, pixi } = await session({ ...SMALL_QUERY, shouldAdvanceTick: true });
    const api = subject.debugApi();
    for (let frame = 0; frame < 3; frame += 1) pixi.tick();
    expect(api.renderTick()).toBeCloseTo(63, 6);
    expect(subject.driver.tick).toBe(63);
  });

  it('holds the frame while paused, steps the scene by ticks and rebuilds it on a new seed', async () => {
    const { subject, pixi } = await session();
    const api = subject.debugApi();
    pixi.tick();
    const bakes = pixi.bakedSpecs.length;
    api.pause();
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(1);
    api.step(5);
    pixi.tick();
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(2);
    expect(api.renderTick()).toBeCloseTo(65, 6);
    expect(api.isPaused()).toBe(true);
    expect(api.setSeed(RENDER_BENCH_SEED + 1)).toBe(true);
    expect(subject.driver.world.seed).toBe(RENDER_BENCH_SEED + 1);
    expect(subject.driver.tick).toBe(60);
    expect(pixi.bakedSpecs.length).toBeGreaterThan(bakes);
    api.resume();
    pixi.tick();
    expect(pixi.renderCalls.count).toBe(3);
    subject.destroy();
    expect(pixi.lifecycle.isDestroyed).toBe(true);
  });
});
