// The preview session's clocks and canvas bounds (docs/architecture/encyclopedia.md §12.7, §12.9), over the fake
// Pixi app so nothing here touches WebGL or `BitmapText` (which crashes jsdom).
//
// Two defects live in this file's subject matter. **Conflating the wall clock with the scene clock** made every
// `PreviewOpenTimings` field report the zero milliseconds the route's `ManualClock` had advanced by. And **a pause
// that touched the debug `FrameGate`** would fight the room's own hook, which stays installed underneath the
// encyclopedia. Both are pinned by observing the thing itself rather than a flag.

import {
  DEFAULT_BALANCE,
  ManualClock,
  TICK_INTERVAL_S,
  ZONE_ID,
  type BalanceConfig,
  type Clock,
} from '@evolution/shared';
import { describe, expect, it, vi } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { PREVIEW_CANVAS_MAX_PX, PREVIEW_MAX_DEVICE_PIXEL_RATIO } from '../constants';
import { cappedPreviewDevicePixelRatio, clampedPreviewCanvasSize, previewLensSidePx } from './preview-canvas';
import { EVOLUTION_DEBUG_MODE } from '../../debug/evolution-debug';
import { PreviewSession, type PreviewSessionDependencies } from './preview-session';
import { PREVIEW_SCENE, type PreviewSpec } from './preview-spec';

const LENS_SIDE_PX = 360;
const LENS_SIZE_PX = { width: LENS_SIDE_PX, height: LENS_SIDE_PX };
const VENT_SPEC: PreviewSpec = { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.warmVent };
const SHALLOWS_SPEC: PreviewSpec = { scene: PREVIEW_SCENE.zone, zone: ZONE_ID.sunlitShallows };

interface Harness {
  readonly subject: PreviewSession;
  readonly clock: ManualClock;
  readonly apps: FakePixiApp[];
  readonly dependencies: PreviewSessionDependencies;
}

function harness(overrides: Partial<PreviewSessionDependencies> = {}): Harness {
  const clock = new ManualClock(0);
  const apps: FakePixiApp[] = [];
  const dependencies: PreviewSessionDependencies = {
    host: document.createElement('div'),
    clock,
    devicePixelRatio: 1,
    sizePx: LENS_SIZE_PX,
    createPixiApp: () => {
      const app = createFakePixiApp({ width: LENS_SIDE_PX, height: LENS_SIDE_PX });
      apps.push(app);
      return Promise.resolve(app);
    },
    balance: (): BalanceConfig => DEFAULT_BALANCE,
    shouldPreserveDrawingBuffer: false,
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    ...overrides,
  };
  return { subject: new PreviewSession(dependencies), clock, apps, dependencies };
}

/**
 * The wall clock and the scene clock are two different things, and conflating them is a defect this seam has
 * already had once: the evidence route drives a `ManualClock` for the scene, and when `PreviewOpenTimings` was
 * read off that same clock every timing came back as the zero milliseconds it had advanced by. A spec that passes
 * no `sceneClock` cannot see the difference, so these two hand in a scene clock that never moves.
 */
describe('PreviewSession with a scene clock of its own', () => {
  /** A wall clock that advances by itself on every read: it stands in for time passing during the open. */
  function tickingWallClock(stepMs: number): Clock {
    let nowMs = 0;
    return {
      nowMilliseconds: () => {
        nowMs += stepMs;
        return nowMs;
      },
    };
  }

  it('measures the open on the wall clock, not on the scene clock the route walks', async () => {
    const stepMs = 7;
    const sceneClock = new ManualClock(0);
    const { subject } = harness({ clock: tickingWallClock(stepMs), sceneClock });
    const timings = await subject.start(VENT_SPEC);
    expect(timings).not.toBeNull();
    // The scene clock never moved, so every one of these would be 0 if the open were read off it.
    expect(sceneClock.nowMilliseconds()).toBe(0);
    expect(timings!.initMs).toBeGreaterThan(0);
    expect(timings!.bakeMs).toBeGreaterThan(0);
    expect(timings!.firstSubmitMs).toBeGreaterThan(0);
    expect(timings!.openedToFirstFrameMs).toBeGreaterThan(0);
    subject.destroy();
  });

  it('takes the scene’s time from the scene clock, which a still wall clock never advances', async () => {
    const sceneClock = new ManualClock(0);
    const { subject, apps } = harness({ clock: tickingWallClock(1), sceneClock });
    await subject.start(VENT_SPEC);
    apps[0]!.tick();
    expect(subject.lastSceneTick).toBe(0);
    // Only the scene clock moves the scene: the wall clock has been running throughout.
    sceneClock.advanceMilliseconds(1_000);
    apps[0]!.tick();
    expect(subject.lastSceneTick).toBeCloseTo(1 / TICK_INTERVAL_S, 9);
    subject.destroy();
  });
});

describe('PreviewSession.pause and resume', () => {
  it('stops the preview ticker and never touches the debug FrameGate', async () => {
    const { subject, apps, clock } = harness();
    await subject.start(VENT_SPEC);
    const app = apps[0]!;
    const rendersAfterOpen = app.renderCalls.count;
    subject.pause();
    expect(subject.isPaused).toBe(true);
    expect(app.ticking.isRunning).toBe(false);
    // The gate is the debug hook's pause; a UI pause must leave it alone, or `debug_resume_room` would fight it.
    expect(subject.gate.isPaused()).toBe(false);
    clock.advanceMilliseconds(1_000);
    app.tick();
    expect(app.renderCalls.count).toBe(rendersAfterOpen);
    subject.resume();
    expect(app.ticking.isRunning).toBe(true);
    app.tick();
    expect(app.renderCalls.count).toBe(rendersAfterOpen + 1);
    subject.destroy();
  });

  /** The paused span never plays: the tick after a resume is the tick the pause froze, not that span later. */
  it('re-bases the local clock across the paused span', async () => {
    const { subject, apps, clock } = harness();
    await subject.start(VENT_SPEC);
    const app = apps[0]!;
    const playedMs = 1_000;
    const pausedMs = 30_000;
    clock.advanceMilliseconds(playedMs);
    app.tick();
    const tickAtPause = subject.lastRenderedTick;
    expect(tickAtPause).toBeCloseTo(playedMs / 1000 / TICK_INTERVAL_S, 9);
    subject.pause();
    clock.advanceMilliseconds(pausedMs);
    subject.resume();
    app.tick();
    expect(subject.lastRenderedTick).toBeCloseTo(tickAtPause!, 9);
    subject.destroy();
  });

  it('holds a scene shown while paused until the resume', async () => {
    const { subject, apps, clock } = harness();
    await subject.start(VENT_SPEC);
    const tickAtPause = subject.lastRenderedTick!;
    subject.pause();
    clock.advanceMilliseconds(5_000);
    subject.show(SHALLOWS_SPEC);
    clock.advanceMilliseconds(5_000);
    subject.resume();
    apps[0]!.tick();
    // The swapped-in scene has not played a frame of its loop: the whole paused span was re-based away.
    expect(subject.lastSceneTick).toBe(0);
    // And the render tick did not go backwards to say so.
    expect(subject.lastRenderedTick!).toBeGreaterThanOrEqual(tickAtPause);
    subject.destroy();
  });

  it('applies a pause that lands before the app arrives', async () => {
    const { subject, apps } = harness();
    const start = subject.start(VENT_SPEC);
    subject.pause();
    await start;
    expect(apps[0]!.ticking.isRunning).toBe(false);
    subject.destroy();
  });
});

describe('PreviewSession.resize', () => {
  it('resizes the canvas with no rebake', async () => {
    const { subject, apps } = harness();
    await subject.start(VENT_SPEC);
    const app = apps[0]!;
    const bakes = app.textures.texturedBakes.length;
    const largerSidePx = 420;
    subject.resize({ width: largerSidePx, height: largerSidePx });
    expect(app.screen).toEqual({ width: largerSidePx, height: largerSidePx });
    expect(app.textures.texturedBakes).toHaveLength(bakes);
    subject.destroy();
  });
});

describe('the canvas bounds', () => {
  it('caps the device pixel ratio the preview renders and bakes at', () => {
    expect(cappedPreviewDevicePixelRatio(1)).toBe(1);
    expect(cappedPreviewDevicePixelRatio(3)).toBe(PREVIEW_MAX_DEVICE_PIXEL_RATIO);
  });

  it('reads the lens as its bounding square, so a non-square box never frames on the longer side', () => {
    expect(previewLensSidePx({ width: 400, height: 260 })).toBe(260);
    expect(previewLensSidePx({ width: 260, height: 400 })).toBe(260);
  });

  it('clamps each canvas side to PREVIEW_CANVAS_MAX_PX device pixels', () => {
    const capped = PREVIEW_MAX_DEVICE_PIXEL_RATIO;
    const underCap = PREVIEW_CANVAS_MAX_PX / capped - 1;
    expect(clampedPreviewCanvasSize({ width: underCap, height: underCap }, capped)).toEqual({
      width: underCap,
      height: underCap,
    });
    const overCap = PREVIEW_CANVAS_MAX_PX;
    const clamped = clampedPreviewCanvasSize({ width: overCap, height: overCap }, capped);
    expect(clamped.width * capped).toBe(PREVIEW_CANVAS_MAX_PX);
    expect(clamped.height * capped).toBe(PREVIEW_CANVAS_MAX_PX);
  });

  it('passes the capped ratio to the app, not the display’s', async () => {
    const createPixiApp = vi.fn(() => Promise.resolve(createFakePixiApp(LENS_SIZE_PX)));
    const { subject } = harness({ devicePixelRatio: 3, createPixiApp });
    await subject.start(VENT_SPEC);
    expect(createPixiApp).toHaveBeenCalledWith(
      expect.objectContaining({ devicePixelRatio: PREVIEW_MAX_DEVICE_PIXEL_RATIO }),
    );
    subject.destroy();
  });
});

describe('PreviewSession.performanceReport', () => {
  it('is null before the first frame and carries the seed’s frame after it', async () => {
    const { subject, apps } = harness();
    expect(subject.performanceReport()).toBeNull();
    await subject.start(VENT_SPEC);
    apps[0]!.tick();
    const report = subject.performanceReport();
    expect(report).not.toBeNull();
    expect(Number.isFinite(report!.frameTimeP95Ms)).toBe(true);
    expect(subject.debugApi().mode).toBe(EVOLUTION_DEBUG_MODE.preview);
    subject.destroy();
  });
});
