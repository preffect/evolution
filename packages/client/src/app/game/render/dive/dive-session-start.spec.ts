// The dive session's start and its surroundings (docs/rendering/opening-dive.md §1, §5): a start where either half
// fails gives the other back and answers false; an off-screen report that comes before the app is kept; reduced
// motion asked for mid-fall ends the fall; the lobby's autoplay waits for the tiles.

import { describe, expect, it } from 'vitest';
import {
  diveSessionHarness as harness,
  fakeDiveBands as fakeBands,
  fakeUpperBands,
  startedDiveSession as started,
} from '../../../../testing/dive-session-harness';
import { DIVE_AUTOPLAY_DELAY_MS, DIVE_PLAY_HOLD_MS } from '../constants';
import { SHORE_LOD } from '../constants/dive-shore';
import { DIVE_FIRST_PHASE } from './dive-controls';

describe('DiveSession.start when a half fails', () => {
  it('destroys the app it made when the upper bands fail (a missing coastline), and answers false', async () => {
    const { subject, apps } = harness({ loadUpperBands: () => Promise.reject(new Error('404')) });
    expect(await subject.start()).toBe(false);
    expect(apps[0]!.lifecycle.isDestroyed).toBe(true);
    subject.destroy();
  });

  it('releases the bands it made when the app fails (no WebGL), and answers false', async () => {
    const { subject, bands } = harness({ createPixiApp: () => Promise.reject(new Error('no WebGL')) });
    expect(await subject.start()).toBe(false);
    expect(bands.releases.count).toBe(1);
    subject.destroy();
  });

  it('answers false, holding nothing, when both fail', async () => {
    const { subject } = harness({
      createPixiApp: () => Promise.reject(new Error('no WebGL')),
      loadUpperBands: () => Promise.reject(new Error('404')),
    });
    await expect(subject.start()).resolves.toBe(false);
    subject.destroy();
  });

  it('gives back the half that arrives after destroy when the other failed', async () => {
    const { subject, apps } = harness({ loadUpperBands: () => Promise.reject(new Error('404')) });
    const start = subject.start();
    subject.destroy();
    expect(await start).toBe(false);
    expect(apps[0]!.lifecycle.isDestroyed).toBe(true);
  });
});

describe('DiveSession: what can change around it', () => {
  it('keeps an off-screen report that came before the app, and starts with the ticker stopped', async () => {
    const parts = harness();
    parts.subject.setIsVisible(false);
    expect(await parts.subject.start()).toBe(true);
    expect(parts.apps[0]!.ticking.isRunning).toBe(false);
    parts.subject.destroy();
  });

  it('jumps a playing opening to its stop when reduced motion is asked for mid-fall', async () => {
    const { subject, app, clock, motion } = await started();
    subject.controls.playPhase(DIVE_FIRST_PHASE, clock.nowMilliseconds(), false);
    clock.advanceMilliseconds(DIVE_PLAY_HOLD_MS + 2000);
    app.tick();
    expect(subject.controls.isPlaying).toBe(true);
    motion.isReduced = true;
    app.tick();
    expect(subject.controls.isPlaying).toBe(false);
    expect(subject.controls.zoom).toBe(DIVE_FIRST_PHASE.zoom);
    subject.destroy();
  });

  it('holds the autoplay until the upper bands’ tiles have baked', async () => {
    const baked = { isBaked: false };
    const bands = {
      ...fakeBands(),
      get isBaked() {
        return baked.isBaked;
      },
    };
    const { subject, app, clock } = await started({ loadUpperBands: () => Promise.resolve(fakeUpperBands(bands)) });
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS * 3);
    app.tick();
    expect(subject.controls.isPlaying).toBe(false);
    baked.isBaked = true;
    app.tick();
    expect(subject.controls.isPlaying).toBe(true);
    subject.destroy();
  });

  it('holds the autoplay until the shore’s tiles and its top level have baked', async () => {
    const { subject, app, clock, shore } = await started();
    const band = shore.bands[0]!;
    band.isReady = false;
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS * 3);
    app.tick();
    expect(subject.controls.isPlaying).toBe(false);
    band.isReady = true;
    app.tick();
    expect(subject.controls.isPlaying).toBe(true);
    subject.destroy();
  });

  it('holds the fall above the shore’s floor while its levels bake, then lets it go on', async () => {
    const { subject, app, clock, shore } = await started();
    const band = shore.bands[0]!;
    const floor = SHORE_LOD.topZoom;
    band.fallFloorZoom = floor;
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS);
    app.tick();
    expect(subject.controls.isPlaying).toBe(true);
    for (let frame = 0; frame < 1000; frame += 1) {
      clock.advanceMilliseconds(16);
      app.tick();
    }
    expect(subject.controls.zoom).toBeGreaterThan(floor);
    expect(subject.controls.isPlaying).toBe(true);
    band.fallFloorZoom = Number.NEGATIVE_INFINITY;
    clock.advanceMilliseconds(500);
    app.tick();
    expect(subject.controls.zoom).toBeLessThan(floor);
    subject.destroy();
  });
});
