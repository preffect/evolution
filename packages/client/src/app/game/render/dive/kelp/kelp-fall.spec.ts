// A fall into the kelp band before its bakes land (docs/rendering/opening-dive.md §4, ticket #802): the real controls
// and the real band, its once-a-page bakes costing main-thread time in steps the slices cannot split (a phase played
// the moment the lobby opens, before the autoplay would have waited for them), the slices and the frames sharing one
// simulated main thread. No frame may show the kelp's band before the band is ready, and the fall must still arrive,
// at 60 fps and when frames come a second or three apart (software GL, a VM): nothing is baked per view, so once the
// bakes land the band draws its true picture at any zoom.

import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_BUDGET_MS, DIVE_BAKE_INTERVAL_MS, DIVE_KELP_WINDOW } from '../../constants';
import { createFakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { quickKelpBake } from '../../../../../testing/kelp-builder';
import { TEST_SHORE_LAND, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { DIVE_FIRST_PHASE, DiveControls } from '../dive-controls';
import { DiveKelpBand } from './dive-kelp-band';
import { KelpBakes, kelpBaker, type KelpBakeSources, type KelpBaked } from './kelp-bakes';

/** The bakes on a loaded box: 300 steps of 20 ms, six seconds of main thread, past the fall's own reach of the band. */
const BAKE_STEPS = 300;
const BAKE_STEP_MS = 20;
const FRAME_AT_60_FPS_MS = 16;
const FALL_LIMIT_MS = 120_000;
const KELP_TOP = DIVE_KELP_WINDOW.fadeFromZoom ?? 0;

interface MainThread {
  nowMs: number;
}

/** The quick bake, with every step costing main-thread time. */
function timedBake(thread: MainThread): (sources: KelpBakeSources) => Generator<void, KelpBaked> {
  const quick = quickKelpBake(0);
  return function* bake(sources) {
    for (let step = 0; step < BAKE_STEPS; step += 1) {
      thread.nowMs += BAKE_STEP_MS;
      yield;
    }
    return yield* quick(sources);
  };
}

interface FallReport {
  readonly hasArrived: boolean;
  /** Each frame at or under the band's top: whether the band was ready to draw it. */
  readonly framesInBand: readonly boolean[];
}

function fall(isFloorHeld: boolean, frameMs = FRAME_AT_60_FPS_MS): FallReport {
  const thread: MainThread = { nowMs: 0 };
  const bakes = new KelpBakes({ land: TEST_SHORE_LAND, factory: createFakeShoreCanvasFactory() }, timedBake(thread));
  const pixi = createFakePixiApp();
  const band = new DiveKelpBand({ bakes, tiles: bakedTestTiles() }, (container, target) =>
    pixi.renderToTexture(container, target),
  );
  const baker = kelpBaker(bakes, () => thread.nowMs);
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
    if (zoom <= KELP_TOP) framesInBand.push(band.isReady);
  }
  band.destroy();
  return { hasArrived: !controls.isPlaying, framesInBand };
}

describe('a fall into the kelp band before its bakes land', () => {
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
      expect(report.framesInBand.filter((isReady) => !isReady)).toEqual([]);
    },
  );

  it('would reach the band unready if the fall did not wait: the guard above is not vacuous', () => {
    const report = fall(false);
    expect(report.framesInBand.filter((isReady) => !isReady).length).toBeGreaterThan(0);
  });
});
