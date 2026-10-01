// The dive's micro end through the real renderer (docs/rendering/opening-dive.md §4): the scripted dish scene, the
// band table and the log-zoom camera together decide what the game's own layers draw. Over the fake Pixi app (no
// WebGL), with the renderer's real layers: what is checked is what reached them.

import { DEFAULT_BALANCE, ManualClock, ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { DIVE_BACTERIA_COUNT, DIVE_METRES_PER_WU, DIVE_MOTE_COUNT, DIVE_ZOOM_BOTTOM } from '../constants';
import { DiveSession } from './dive-session';
import type { MockupBands } from './mockup/dive-mockup-bands';

const NO_BANDS: MockupBands = {
  canvas: document.createElement('canvas'),
  isBaked: true,
  isPlanetReady: true,
  draw: () => undefined,
  pumpBakes: () => false,
  release: () => undefined,
};

async function builtSession(): Promise<{ subject: DiveSession; app: FakePixiApp }> {
  let app: FakePixiApp | null = null;
  const subject = new DiveSession({
    host: document.createElement('div'),
    clock: new ManualClock(0),
    scheduler: new ManualScheduler(),
    devicePixelRatio: 1,
    createPixiApp: () => {
      app = createFakePixiApp({ width: 1200, height: 675 });
      return Promise.resolve(app);
    },
    loadMockupBands: () => Promise.resolve(NO_BANDS),
    balance: () => DEFAULT_BALANCE,
    isMotionReduced: () => false,
    onView: () => undefined,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
  });
  await subject.start();
  const started = app as unknown as FakePixiApp;
  for (let frame = 0; frame < 200 && subject.isBuildingRenderer; frame += 1) started.tick();
  return { subject, app: started };
}

function outputsAt(subject: DiveSession, app: FakePixiApp, zoom: number) {
  subject.controls.scrub(zoom);
  app.tick();
  return subject.lastRenderOutputs;
}

describe('the dive’s dish through the real renderer', () => {
  it('draws your cell, every bacterium and every speck when the whole dish is in view (phase 1’s stop)', async () => {
    const { subject, app } = await builtSession();
    const outputs = outputsAt(subject, app, -4.3);
    expect(outputs!.visibleCells).toBe(1 + DIVE_BACTERIA_COUNT);
    expect(outputs!.visibleMotes).toBe(DIVE_MOTE_COUNT);
    subject.destroy();
  });

  it('frames the dish at the dive’s scale: zoomed in on your cell, the renderer culls the rest of the dish', async () => {
    const { subject, app } = await builtSession();
    const outputs = outputsAt(subject, app, DIVE_ZOOM_BOTTOM);
    expect(outputs!.visibleCells).toBeGreaterThanOrEqual(1);
    expect(outputs!.visibleCells).toBeLessThan(1 + DIVE_BACTERIA_COUNT);
    // The view's width at the bottom is 10^zoom metres: about 377 wu of the 6,000 wu dish.
    const widthWu = Math.pow(10, DIVE_ZOOM_BOTTOM) / DIVE_METRES_PER_WU;
    expect(Math.abs(outputs!.cameraExtent.maxX - outputs!.cameraExtent.minX - widthWu)).toBeLessThan(1);
    subject.destroy();
  });

  it('sends the renderer nothing to draw in orbit', async () => {
    const { subject, app } = await builtSession();
    const outputs = outputsAt(subject, app, 7.3);
    expect(outputs!.visibleCells).toBe(0);
    expect(outputs!.visibleMotes).toBe(0);
    subject.destroy();
  });
});
