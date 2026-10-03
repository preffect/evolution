// The dive's micro end through the real renderer (docs/rendering/opening-dive.md §4): the scripted dish scene, the
// band table and the log-zoom camera together decide what the game's own layers draw; and its planet over the real
// coastline bakes, from the loader's plan through the scheduler's slices to the shader's textures. Over the fake Pixi
// app (no WebGL), with the renderer's real layers: what is checked is what reached them.

import { DEFAULT_BALANCE, ManualClock, ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { fakeUpperBands, planetUniformOf } from '../../../../testing/dive-session-harness';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { DIVE_BACTERIA_COUNT, DIVE_METRES_PER_WU, DIVE_MOTE_COUNT, DIVE_ZOOM_BOTTOM } from '../constants';
import { DIVE_BAKE_START_DELAY_MS, DIVE_PLANET_WORLD_PREVIEW_BAKE_PX, EARTH_RADIUS_M } from '../constants';
import type { DiveUpperBands } from './dive-macro-band';
import { DiveSession } from './dive-session';
import { createDivePlanetBakePlan, type DiveCoastRing } from './planet/dive-planet-bakes';
import { DIVE_PLANET_UNIFORM } from './planet/dive-planet-shader';
import type { MockupBands } from './mockup/dive-mockup-bands';

const NO_BANDS: MockupBands = {
  canvas: document.createElement('canvas'),
  isBaked: true,
  draw: () => false,
  pumpBakes: () => false,
  release: () => undefined,
};

async function builtSession(
  bands: DiveUpperBands = fakeUpperBands(NO_BANDS),
  scheduler = new ManualScheduler(),
): Promise<{ subject: DiveSession; app: FakePixiApp }> {
  let app: FakePixiApp | null = null;
  const subject = new DiveSession({
    host: document.createElement('div'),
    clock: new ManualClock(0),
    scheduler,
    devicePixelRatio: 1,
    createPixiApp: () => {
      // the game's app first, then the shore's
      const made = createFakePixiApp({ width: 1200, height: 675 });
      app ??= made;
      return Promise.resolve(made);
    },
    loadUpperBands: () => Promise.resolve(bands),
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

describe('the dive’s planet over the real coastline bakes', () => {
  /** A square continent round the focus, as Natural Earth winds land. */
  const continent: DiveCoastRing = [
    [-130, 40],
    [-110, 40],
    [-110, 55],
    [-130, 55],
    [-130, 40],
  ];
  /** The region: a wide, low strip, so its bake stays small. */
  const strip: DiveCoastRing = [
    [-125, 48],
    [-115, 48],
    [-115, 48.5],
    [-125, 48.5],
    [-125, 48],
  ];

  it('bakes the loader’s plan on the scheduler and hands each bake to the shader it draws through', async () => {
    const scheduler = new ManualScheduler();
    const planet = { plan: createDivePlanetBakePlan([continent], [strip]), kept: new Map() };
    const { subject, app } = await builtSession(fakeUpperBands(NO_BANDS, planet), scheduler);
    // The planet is not baked yet: the dive waits in orbit, its slices running every 10 ms.
    for (let slice = 0; slice < 2000 && planet.kept.size < 3; slice += 1)
      scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    expect([...planet.kept.keys()]).toEqual(['worldPreviewSdf', 'worldSdf', 'regionSdf']);
    subject.controls.scrub(7);
    app.tick();
    expect(planetUniformOf(app, DIVE_PLANET_UNIFORM.worldPreviewTexelMetres)).toBeCloseTo(
      (2 * Math.PI * EARTH_RADIUS_M) / DIVE_PLANET_WORLD_PREVIEW_BAKE_PX.width,
      6,
    );
    expect(planetUniformOf(app, DIVE_PLANET_UNIFORM.isRegionReady)).toBe(1);
    expect(planetUniformOf(app, DIVE_PLANET_UNIFORM.regionBoxRadians)).toEqual(
      [-125, 48, -115, 48.5].map((degrees) => (degrees * Math.PI) / 180),
    );
    subject.destroy();
  });
});
