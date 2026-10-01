// The dive session (docs/rendering/opening-dive.md §1) over the fake Pixi app `render-session.spec.ts` uses and a
// recording stand-in for the mockup's upper bands, so no spec here touches WebGL, a 2D canvas or the coastlines.
//
// What is load-bearing, each observed on the thing itself: the upper bands draw from the first frame while the
// renderer still bakes, on their own canvas under the game's; the game's dish is drawn only where the band table
// says (never in orbit, unclipped inside the dish, clipped to its wall while the slime shows) and faded in by the
// game canvas's opacity; a still dive under reduced motion draws nothing new; the lobby plays phase 1 on its own
// once; and `destroy` gives every resource back.

import { DEFAULT_BALANCE, ManualClock, ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { DIVE_AUTOPLAY_DELAY_MS, DIVE_CANVAS_TEST_ID, DIVE_PLAY_HOLD_MS, DIVE_ZOOM_TOP } from '../constants';
import { DIVE_FIRST_PHASE } from './dive-controls';
import { DiveSession, type DiveSessionDependencies } from './dive-session';
import type { DiveView } from './dive-view';
import type { MockupBands, MockupFrame } from './mockup/dive-mockup-bands';

interface FakeBands extends MockupBands {
  readonly frames: MockupFrame[];
  readonly releases: { count: number };
}

/** The game's canvas opacity: the dish band's weight. */
const opacityOf = (app: FakePixiApp): number => Number(app.canvas.style.opacity);

function fakeBands(): FakeBands {
  const frames: MockupFrame[] = [];
  const releases = { count: 0 };
  const canvas = document.createElement('canvas');
  return {
    canvas,
    frames,
    releases,
    isBaked: true,
    draw: (frame) => frames.push(frame),
    pumpBakes: () => false,
    release: () => {
      releases.count += 1;
    },
  };
}

interface Harness {
  readonly subject: DiveSession;
  readonly clock: ManualClock;
  readonly bands: FakeBands;
  readonly apps: FakePixiApp[];
  readonly views: DiveView[];
  readonly motion: { isReduced: boolean };
  readonly dependencies: DiveSessionDependencies;
}

function harness(overrides: Partial<DiveSessionDependencies> = {}): Harness {
  const clock = new ManualClock(0);
  const bands = fakeBands();
  const apps: FakePixiApp[] = [];
  const views: DiveView[] = [];
  const motion = { isReduced: false };
  const dependencies: DiveSessionDependencies = {
    host: document.createElement('div'),
    clock,
    scheduler: new ManualScheduler(),
    devicePixelRatio: 1,
    createPixiApp: () => {
      const app = createFakePixiApp({ width: 1200, height: 675 });
      apps.push(app);
      return Promise.resolve(app);
    },
    loadMockupBands: () => Promise.resolve(bands),
    balance: () => DEFAULT_BALANCE,
    isMotionReduced: () => motion.isReduced,
    onView: (view) => views.push(view),
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    ...overrides,
  };
  return { subject: new DiveSession(dependencies), clock, bands, apps, views, motion, dependencies };
}

/** Ticks until the staged renderer is current: one bake per frame (ticket #479). */
function tickUntilBuilt(app: FakePixiApp, subject: DiveSession): void {
  for (let frame = 0; frame < 200 && subject.isBuildingRenderer; frame += 1) app.tick();
  app.tick();
}

async function started(overrides: Partial<DiveSessionDependencies> = {}): Promise<Harness & { app: FakePixiApp }> {
  const parts = harness(overrides);
  expect(await parts.subject.start()).toBe(true);
  return { ...parts, app: parts.apps[0]! };
}

describe('DiveSession.start', () => {
  it('draws the upper bands from the first frame, while the renderer still bakes, and hides the empty game canvas', async () => {
    const { subject, app, bands, views } = await started();
    expect(subject.isBuildingRenderer).toBe(true);
    app.tick();
    expect(bands.frames).toHaveLength(1);
    expect(bands.frames[0]!.zoom).toBe(DIVE_ZOOM_TOP);
    expect(app.renderCalls.count).toBe(0);
    expect(opacityOf(app)).toBe(0);
    expect(views.at(-1)!.camera.zoom).toBe(DIVE_ZOOM_TOP);
    subject.destroy();
  });

  it('lays the upper bands’ canvas first in the stage, under the game’s, and the renderer in a root of its own', async () => {
    const { subject, app, bands, dependencies } = await started();
    expect(dependencies.host.firstElementChild).toBe(bands.canvas);
    expect(app.canvas.dataset['testid']).toBe(DIVE_CANVAS_TEST_ID);
    tickUntilBuilt(app, subject);
    expect(subject.isBuildingRenderer).toBe(false);
    const [gameRoot] = app.stage.children;
    expect(gameRoot!.children.length).toBeGreaterThan(0);
    subject.destroy();
  });

  it('gives back an app and the bands that arrive after destroy, and answers false', async () => {
    const { subject, apps, bands } = harness();
    const start = subject.start();
    subject.destroy();
    expect(await start).toBe(false);
    expect(apps[0]!.lifecycle.isDestroyed).toBe(true);
    expect(bands.releases.count).toBe(1);
  });
});

describe('DiveSession frames', () => {
  it('leaves the game’s dish undrawn and unseen in orbit', async () => {
    const { subject, app, views } = await started();
    tickUntilBuilt(app, subject);
    const rendered = app.renderCalls.count;
    app.tick();
    expect(views.at(-1)!.bands.dish.isActive).toBe(false);
    expect(app.renderCalls.count).toBe(rendered);
    expect(opacityOf(app)).toBe(0);
    subject.destroy();
  });

  it('draws the dish clipped to its wall while the slime shows, and the upper bands under it', async () => {
    const { subject, app, bands } = await started();
    tickUntilBuilt(app, subject);
    subject.controls.scrub(-4.3);
    const drawnBefore = bands.frames.length;
    app.tick();
    const [gameRoot, dishClip] = app.stage.children;
    expect(opacityOf(app)).toBe(1);
    expect(gameRoot!.mask).toBe(dishClip);
    expect(bands.frames.length).toBe(drawnBefore + 1);
    expect(subject.lastRenderedTick).not.toBeNull();
    subject.destroy();
  });

  it('draws only the dish, unclipped, once the view lies inside it', async () => {
    const { subject, app, bands } = await started();
    tickUntilBuilt(app, subject);
    subject.controls.scrub(-5.5);
    const drawnBefore = bands.frames.length;
    app.tick();
    const [gameRoot] = app.stage.children;
    expect(bands.canvas.hidden).toBe(true);
    expect(gameRoot!.mask ?? null).toBeNull();
    expect(bands.frames.length).toBe(drawnBefore);
    subject.destroy();
  });

  it('fades the dish in by the band table as the dark field arrives', async () => {
    const { subject, app } = await started();
    tickUntilBuilt(app, subject);
    subject.controls.scrub(-3.96);
    app.tick();
    expect(opacityOf(app)).toBeCloseTo(0.5, 6);
    subject.destroy();
  });
});

describe('DiveSession under reduced motion', () => {
  it('draws nothing new while the dive is still, and one frame for each change', async () => {
    const { subject, app, bands, motion } = await started();
    motion.isReduced = true;
    app.tick();
    const drawn = bands.frames.length;
    app.tick();
    app.tick();
    expect(bands.frames.length).toBe(drawn);
    subject.controls.scrub(3);
    subject.requestFrame();
    app.tick();
    expect(bands.frames.length).toBe(drawn + 1);
    expect(bands.frames.at(-1)!.zoom).toBe(3);
    subject.destroy();
  });

  it('holds the ambient time still', async () => {
    const { subject, app, clock, bands, motion } = await started();
    motion.isReduced = true;
    app.tick();
    clock.advanceMilliseconds(5000);
    subject.requestFrame();
    app.tick();
    expect(bands.frames.at(-1)!.timeSeconds).toBe(bands.frames[0]!.timeSeconds);
    subject.destroy();
  });
});

describe('DiveSession autoplay', () => {
  it('plays phase 1’s opening once, a moment after the open', async () => {
    const { subject, app, clock } = await started();
    app.tick();
    expect(subject.controls.isPlaying).toBe(false);
    clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS);
    app.tick();
    expect(subject.controls.stopShown).toBe(DIVE_FIRST_PHASE);
    clock.advanceMilliseconds(DIVE_PLAY_HOLD_MS + 1000);
    app.tick();
    expect(subject.controls.zoom).toBeLessThan(DIVE_ZOOM_TOP);
    subject.destroy();
  });

  it('never plays on its own under reduced motion, or once the reader has taken the controls', async () => {
    for (const takeOver of [
      (parts: Harness) => (parts.motion.isReduced = true),
      (parts: Harness) => parts.subject.controls.cancelAutoplay(),
    ]) {
      const parts = await started();
      takeOver(parts);
      parts.clock.advanceMilliseconds(DIVE_AUTOPLAY_DELAY_MS * 2);
      parts.app.tick();
      expect(parts.subject.controls.isPlaying).toBe(false);
      parts.subject.destroy();
    }
  });
});

describe('DiveSession.destroy', () => {
  it('destroys the app, unbinds before it does, takes the upper bands off the stage and gives the planet’s context back', async () => {
    const { subject, app, bands } = await started();
    tickUntilBuilt(app, subject);
    subject.destroy();
    expect(app.lifecycle.isDestroyed).toBe(true);
    expect(app.unbindCalls.count).toBe(1);
    expect(bands.canvas.parentElement).toBeNull();
    expect(bands.releases.count).toBe(1);
  });

  it('stops and starts the ticker as the stage leaves and comes back into view', async () => {
    const { subject, app } = await started();
    subject.setIsVisible(false);
    expect(app.ticking.isRunning).toBe(false);
    subject.setIsVisible(true);
    expect(app.ticking.isRunning).toBe(true);
    subject.destroy();
  });
});

describe('DiveSession.probeFrames', () => {
  it('draws the frames back to back at the zoom, the scene moving on, and answers their means', async () => {
    const { subject, app, bands } = await started();
    tickUntilBuilt(app, subject);
    const drawn = bands.frames.length;
    const report = subject.probeFrames(-2.8, 4);
    expect(report.frames).toBe(4);
    expect(bands.frames.length).toBe(drawn + 4);
    const probed = bands.frames.slice(-4);
    expect(probed.every((frame) => frame.zoom === -2.8)).toBe(true);
    expect(probed[3]!.timeSeconds - probed[0]!.timeSeconds).toBeCloseTo(3 / 60, 6);
    subject.destroy();
  });
});
