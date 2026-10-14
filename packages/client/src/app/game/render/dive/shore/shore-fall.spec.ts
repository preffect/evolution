// @vitest-environment node
// The autoplay's fall through the shore against slow bakes (docs/rendering/opening-dive.md §4, ticket #801): the real
// controls and the real levels, each level's bake costing what a close one costs on the evidence box (about 450 ms of
// main thread at full resolution, in steps the slices cannot split, most of it by the pixel), the slices and the frames
// sharing one simulated main thread. Every frame inside the band must draw the right picture: the level the zoom is
// in, or one at most `SHORE_LEVEL_CACHE.standInSteps` coarser (it covers the whole view, only softer). The fall eases
// in where it must and still arrives, at 60 fps and when frames come a second or three apart (software GL, a VM).
// With the bakes in a worker (ticket #809) the same cost runs beside the main thread: no slice holds it, and the fall
// arrives no later.

import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_BUDGET_MS, DIVE_BAKE_INTERVAL_MS, DIVE_ZOOM_TOP } from '../../constants/dive';
import { SHORE_LEVEL_CACHE, SHORE_LOD } from '../../constants/dive-shore';
import { DIVE_FIRST_PHASE, DiveControls } from '../dive-controls';
import { shoreLevelAt } from './shore-lod';
import { ShoreLevels, type ShoreLevelUploader } from './shore-levels';
import type { ShoreView } from './shore-paint';
import type { ShoreSnapshot, ShoreSnapshotSources } from './shore-snapshot';
import { SHORE_BAKE_WAITING, type ShoreBakeStep } from './shore-pump';

/** A close level's bake on the evidence box at full resolution: five steps of 90 ms, 70 % of it by the pixel. */
const BAKE_STEPS = 5;
const BAKE_STEP_MS = 90;
const BAKE_PIXEL_SHARE = 0.7;
const FRAME_AT_60_FPS_MS = 16;
/** Long enough for every level to bake one after another, and the fall's own time. */
const FALL_LIMIT_MS = 120_000;
/** The longest a task may hold the main thread before it shows as a hitch (a long task). */
const LONG_TASK_MS = 50;

interface MainThread {
  nowMs: number;
}

function bakeStepMs(view: ShoreView): number {
  const pixels = view.devicePixelRatio * view.devicePixelRatio;
  return BAKE_STEP_MS * (1 - BAKE_PIXEL_SHARE + BAKE_PIXEL_SHARE * pixels);
}

/** A snapshot bake that takes main-thread time, step by step, and lands the view it was asked for. */
function* timedBake(view: ShoreView, thread: MainThread): Generator<ShoreBakeStep, ShoreSnapshot> {
  const stepMs = bakeStepMs(view);
  for (let step = 0; step < BAKE_STEPS; step += 1) {
    thread.nowMs += stepMs;
    yield;
  }
  return { view } as unknown as ShoreSnapshot;
}

/** The same bake in a worker: it takes no main-thread time, and lands once its cost has passed on the wall clock. */
function* workerBake(view: ShoreView, thread: MainThread): Generator<ShoreBakeStep, ShoreSnapshot> {
  const landsAtMs = thread.nowMs + bakeStepMs(view) * BAKE_STEPS;
  while (thread.nowMs < landsAtMs) yield SHORE_BAKE_WAITING;
  return { view } as unknown as ShoreSnapshot;
}

type TimedBaker = (view: ShoreView, thread: MainThread) => Generator<ShoreBakeStep, ShoreSnapshot>;

const UPLOADER: ShoreLevelUploader<number> = {
  upload: (snapshot) => shoreLevelAt(snapshot.view.zoom),
  release: () => undefined,
};

interface FallReport {
  readonly hasArrived: boolean;
  readonly fallMs: number;
  /** The longest bake slice on the main thread. */
  readonly longestSliceMs: number;
  /** Each frame inside the band: the zoom's level and the level drawn, `null` for none. */
  readonly frames: { readonly level: number; readonly drawn: number | null }[];
}

/** One autoplay fall on one simulated main thread: bake slices every interval until the next frame is due, then it. */
function fall(
  floorOf: (levels: ShoreLevels<number>) => number,
  frameMs = FRAME_AT_60_FPS_MS,
  baker: TimedBaker = timedBake,
): FallReport {
  const thread: MainThread = { nowMs: 0 };
  const levels = new ShoreLevels<number>({} as ShoreSnapshotSources, UPLOADER, (view) => baker(view, thread));
  levels.setStage({ width: 830, height: 467 }, 1);
  levels.focus(DIVE_ZOOM_TOP, 1);
  const controls = new DiveControls();
  controls.playPhase(DIVE_FIRST_PHASE, 0, false);
  const frames: FallReport['frames'][number][] = [];
  let frameDueMs = frameMs;
  let longestSliceMs = 0;
  while (controls.isPlaying && thread.nowMs < FALL_LIMIT_MS) {
    while (thread.nowMs < frameDueMs) {
      const sliceStartMs = thread.nowMs;
      levels.pump(DIVE_BAKE_BUDGET_MS, () => thread.nowMs);
      longestSliceMs = Math.max(longestSliceMs, thread.nowMs - sliceStartMs);
      thread.nowMs += DIVE_BAKE_INTERVAL_MS;
    }
    frameDueMs = thread.nowMs + frameMs;
    const zoom = controls.tick(thread.nowMs, floorOf(levels));
    levels.focus(zoom, 1);
    if (zoom < SHORE_LOD.topZoom && zoom > SHORE_LOD.cutZoom) {
      frames.push({ level: shoreLevelAt(zoom), drawn: levels.standInLevelAt(zoom) });
    }
  }
  return { hasArrived: !controls.isPlaying, fallMs: thread.nowMs, longestSliceMs, frames };
}

const isRightPicture = (frame: FallReport['frames'][number]): boolean =>
  frame.drawn !== null && frame.drawn <= frame.level && frame.level - frame.drawn <= SHORE_LEVEL_CACHE.standInSteps;

describe('the autoplay’s fall through the shore, against slow bakes', () => {
  it('draws the right picture on every frame in the band, waiting where it must, and arrives', () => {
    const report = fall((levels) => levels.fallFloorZoom);
    expect(report.hasArrived).toBe(true);
    expect(report.frames.length).toBeGreaterThan(0);
    expect(report.frames.filter((frame) => !isRightPicture(frame))).toEqual([]);
    // it fell through the whole band, down to its last level
    expect(Math.max(...report.frames.map((frame) => frame.level))).toBe(shoreLevelAt(SHORE_LOD.cutZoom));
  });

  it.each([1000, 3000])(
    'arrives when frames come %i ms apart, every frame in the band the right picture',
    (frameMs) => {
      const report = fall((levels) => levels.fallFloorZoom, frameMs);
      expect(report.hasArrived).toBe(true);
      expect(report.frames.filter((frame) => !isRightPicture(frame))).toEqual([]);
    },
  );

  it('would draw wrong pictures if the fall did not wait: the guard above is not vacuous', () => {
    const report = fall(() => Number.NEGATIVE_INFINITY);
    expect(report.frames.filter((frame) => !isRightPicture(frame)).length).toBeGreaterThan(0);
  });

  it.each([FRAME_AT_60_FPS_MS, 1000, 3000])(
    'with the bakes in a worker, frames %i ms apart: no slice holds the main thread, and the fall arrives no later',
    (frameMs) => {
      const onPage = fall((levels) => levels.fallFloorZoom, frameMs);
      const inWorker = fall((levels) => levels.fallFloorZoom, frameMs, workerBake);
      expect(inWorker.hasArrived).toBe(true);
      expect(inWorker.frames.filter((frame) => !isRightPicture(frame))).toEqual([]);
      expect(inWorker.longestSliceMs).toBeLessThan(LONG_TASK_MS);
      expect(onPage.longestSliceMs).toBeGreaterThan(LONG_TASK_MS);
      expect(inWorker.fallMs).toBeLessThanOrEqual(onPage.fallMs);
    },
  );
});
