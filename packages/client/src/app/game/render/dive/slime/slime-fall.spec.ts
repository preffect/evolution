// A fall into the slime band before its bakes land (docs/rendering/opening-dive.md §4, ticket #803): the real controls
// and the real band, its once-a-page bakes costing main-thread time in steps the slices cannot split (a phase played
// the moment the lobby opens, before the autoplay would have waited for them), the slices and the frames sharing one
// simulated main thread. No frame may show the slime before the band is ready, and the fall must still arrive, at
// 60 fps and when frames come a second or three apart (software GL, a VM): nothing is baked per view, so once the
// bakes land the band draws its true picture at any zoom.

import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_BUDGET_MS, DIVE_BAKE_INTERVAL_MS, DIVE_SLIME_WINDOW } from '../../constants';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { SLIME_BAND_TEST_TIMEOUT_MS, quickSlimeBake, testSlimeScatters } from '../../../../../testing/slime-builder';
import { DIVE_FIRST_PHASE, DiveControls } from '../dive-controls';
import { DiveSlimeBand } from './dive-slime-band';
import { SlimeBakes, slimeBaker, type SlimeBakeSources, type SlimeBaked } from './slime-bakes';

/** The bakes on a loaded box: 600 steps of 20 ms, twelve seconds of main thread, past the fall's reach of the band. */
const BAKE_STEPS = 600;
const BAKE_STEP_MS = 20;
const FRAME_AT_60_FPS_MS = 16;
const FALL_LIMIT_MS = 180_000;
const SLIME_TOP = DIVE_SLIME_WINDOW.fadeFromZoom ?? 0;

interface MainThread {
  nowMs: number;
}

/** The quick bake, with every step costing main-thread time. */
function timedBake(thread: MainThread): (sources: SlimeBakeSources) => Generator<void, SlimeBaked> {
  const quick = quickSlimeBake(0);
  return function* bake(sources) {
    for (let step = 0; step < BAKE_STEPS; step += 1) {
      thread.nowMs += BAKE_STEP_MS;
      yield;
    }
    return yield* quick(sources);
  };
}

function* quickScatters() {
  yield;
  return testSlimeScatters();
}

interface FallReport {
  readonly hasArrived: boolean;
  /** Each frame at or under the band's top: whether the band was ready to draw it. */
  readonly framesInBand: readonly boolean[];
}

function fall(isFloorHeld: boolean, frameMs = FRAME_AT_60_FPS_MS): FallReport {
  const thread: MainThread = { nowMs: 0 };
  const factory = createFakeShoreCanvasFactory();
  const bakes = new SlimeBakes({ factory, devicePixelRatio: 1 }, timedBake(thread), quickScatters);
  const pixi = createFakePixiApp();
  const band = new DiveSlimeBand({ bakes, tiles: bakedTestTiles(), factory }, (container, target) =>
    pixi.renderToTexture(container, target),
  );
  const baker = slimeBaker(bakes, () => thread.nowMs);
  const controls = new DiveControls();
  controls.playPhase(DIVE_FIRST_PHASE, 0, false);
  const framesInBand: boolean[] = [];
  let frameDueMs = frameMs;
  while (controls.isPlaying && thread.nowMs < FALL_LIMIT_MS) {
    while (thread.nowMs < frameDueMs) {
      if (!baker.isBaked) baker.pumpBakes(DIVE_BAKE_BUDGET_MS);
      thread.nowMs += DIVE_BAKE_INTERVAL_MS;
    }
    frameDueMs = thread.nowMs + frameMs;
    const zoom = controls.tick(thread.nowMs, isFloorHeld ? band.fallFloorZoom : Number.NEGATIVE_INFINITY);
    if (zoom <= SLIME_TOP) framesInBand.push(band.isReady);
  }
  band.destroy();
  return { hasArrived: !controls.isPlaying, framesInBand };
}

describe('a fall into the slime band before its bakes land', { timeout: SLIME_BAND_TEST_TIMEOUT_MS }, () => {
  it('waits above the band until the band is ready, then falls on through it and arrives', () => {
    const report = fall(true);
    expect(report.hasArrived).toBe(true);
    expect(report.framesInBand.length).toBeGreaterThan(0);
    expect(report.framesInBand.filter((isReady) => !isReady)).toEqual([]);
  });

  it.each([1000, 3000])(
    'arrives when frames come %i ms apart, never showing the band before it is ready',
    (frameMs) => {
      const report = fall(true, frameMs);
      expect(report.hasArrived).toBe(true);
      expect(report.framesInBand.length).toBeGreaterThan(0);
      expect(report.framesInBand.filter((isReady) => !isReady)).toEqual([]);
    },
  );

  it('would reach the band unready if the fall did not wait: the guard above is not vacuous', () => {
    const report = fall(false);
    expect(report.framesInBand.filter((isReady) => !isReady).length).toBeGreaterThan(0);
  });
});
