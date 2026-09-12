import { describe, expect, it, vi } from 'vitest';
import { ManualClock, RENDER_STAGE_NAMES } from '@evolution/shared';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp } from '../../../../testing/fake-pixi-app';
import {
  RENDER_BENCH_DEFAULT_TICK,
  RENDER_BENCH_DEFAULT_ZOOM,
  RENDER_BENCH_REPORT_FRAMES,
  RENDER_BENCH_SEED,
  RENDER_BENCH_WARMUP_FRAMES,
} from '../constants';
import { BenchSession, isBenchRoute, parseBenchQuery, type RenderBenchReport } from './bench-session';

describe('parseBenchQuery', () => {
  it('reads the seed, tick and zoom with defaults for what is missing or malformed', () => {
    expect(parseBenchQuery('?bench=7&tick=300&zoom=1.8&window=12')).toEqual({
      seed: 7,
      tick: 300,
      zoom: 1.8,
      windowFrames: 12,
    });
    expect(parseBenchQuery('?bench')).toEqual({
      seed: RENDER_BENCH_SEED,
      tick: RENDER_BENCH_DEFAULT_TICK,
      zoom: RENDER_BENCH_DEFAULT_ZOOM,
      windowFrames: RENDER_BENCH_REPORT_FRAMES,
    });
    expect(parseBenchQuery('?bench=abc&tick=1.9&zoom=x&window=0')).toEqual({
      seed: RENDER_BENCH_SEED,
      tick: 1,
      zoom: RENDER_BENCH_DEFAULT_ZOOM,
      windowFrames: 1,
    });
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

async function session(
  query = { seed: RENDER_BENCH_SEED, tick: 60, zoom: SMALL_ZOOM, windowFrames: SMALL_WINDOW_FRAMES },
) {
  const pixi = createFakePixiApp();
  const heap = fakeHeap();
  const reports: RenderBenchReport[] = [];
  const subject = new BenchSession(query, {
    host: document.createElement('div'),
    clock: new ManualClock(0),
    devicePixelRatio: 1,
    createPixiApp: () => Promise.resolve(pixi),
    heap,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    counts: SMALL_COUNTS,
    onReport: (report) => reports.push(report),
  });
  await subject.start();
  return { subject, pixi, heap, reports };
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
    expect(report.allocatedBytesPerFrame).toBe(BYTES_PER_FRAME);
    expect(report.visibleCells).toBeGreaterThan(0);
    expect(Object.keys(report.renderStagesMs).sort()).toEqual([...RENDER_STAGE_NAMES].sort());
    expect(report.verdict.isWithinBudget).toBe(true);
    expect(api.performanceReport()).toBe(report);
    pixi.tick();
    expect(reports).toHaveLength(1);
    expect(pixi.renderCalls.count).toBe(RENDER_BENCH_WARMUP_FRAMES + SMALL_WINDOW_FRAMES + 1);
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
