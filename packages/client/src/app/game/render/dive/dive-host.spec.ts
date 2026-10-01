// The `OPENING_DIVE` seam (docs/rendering/opening-dive.md §1): what the panel is told each frame, and how a control
// reaches the session — every one takes the controls from the lobby's autoplay, except a skip with nothing to skip.

import { DEFAULT_BALANCE, ManualClock, ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { DIVE_AUTOPLAY_DELAY_MS, DIVE_PHASE_STOPS, DIVE_ZOOM_TOP, type DivePhaseStop } from '../constants';
import { createDiveHandle, type DiveFrameState, type DiveHandle } from './dive-host';
import type { MockupBands } from './mockup/dive-mockup-bands';

const SHORE = DIVE_PHASE_STOPS[4] as DivePhaseStop;

function bands(): MockupBands {
  return {
    canvas: document.createElement('canvas'),
    isBaked: true,
    isPlanetReady: true,
    draw: () => undefined,
    pumpBakes: () => false,
    release: () => undefined,
  };
}

async function opened(): Promise<{
  handle: DiveHandle;
  app: FakePixiApp;
  clock: ManualClock;
  frames: DiveFrameState[];
}> {
  const clock = new ManualClock(0);
  const frames: DiveFrameState[] = [];
  let app: FakePixiApp | null = null;
  const handle = createDiveHandle(
    {
      host: document.createElement('div'),
      balance: () => DEFAULT_BALANCE,
      isMotionReduced: () => false,
      onFrame: (state) => frames.push(state),
    },
    {
      clock,
      scheduler: new ManualScheduler(),
      devicePixelRatio: 1,
      createPixiApp: () => {
        app = createFakePixiApp({ width: 1200, height: 675 });
        return Promise.resolve(app);
      },
      loadMockupBands: () => Promise.resolve(bands()),
      noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    },
  );
  await handle.start();
  return { handle, app: app as unknown as FakePixiApp, clock, frames };
}

describe('createDiveHandle', () => {
  it('tells the panel each frame’s view and where the controls stand', async () => {
    const { handle, app, clock, frames } = await opened();
    handle.playPhase(SHORE, false);
    app.tick();
    expect(frames.at(-1)).toMatchObject({ isPlaying: true, isPaused: false, stopShown: SHORE, hasArrived: false });
    handle.togglePause();
    app.tick();
    expect(frames.at(-1)!.isPaused).toBe(true);
    handle.togglePause();
    clock.advanceMilliseconds(60_000);
    app.tick();
    expect(frames.at(-1)).toMatchObject({ isPlaying: false, stopShown: SHORE, hasArrived: true });
    expect(frames.at(-1)!.view.camera.zoom).toBe(SHORE.zoom);
    handle.destroy();
  });

  it('takes the dive from the lobby’s autoplay on any control', async () => {
    const { handle, app, clock, frames } = await opened();
    handle.scrub(3);
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS * 2);
    app.tick();
    expect(frames.at(-1)!.isPlaying).toBe(false);
    expect(frames.at(-1)!.view.camera.zoom).toBe(3);
    handle.destroy();
  });

  it('leaves the autoplay alone on a skip with nothing to skip', async () => {
    const { handle, app, clock, frames } = await opened();
    expect(handle.skip()).toBe(false);
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS);
    app.tick();
    expect(frames.at(-1)!.isPlaying).toBe(true);
    expect(handle.skip()).toBe(true);
    app.tick();
    expect(frames.at(-1)!.view.camera.zoom).not.toBe(DIVE_ZOOM_TOP);
    handle.destroy();
  });

  it('reports the frames drawn since the last take', async () => {
    const { handle, app } = await opened();
    app.tick();
    app.tick();
    expect(handle.takeFrameTimes().frames).toBe(2);
    expect(handle.takeFrameTimes().frames).toBe(0);
    handle.setIsVisible(false);
    expect(app.ticking.isRunning).toBe(false);
    handle.destroy();
  });
});
