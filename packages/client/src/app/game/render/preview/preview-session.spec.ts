// The preview session (docs/architecture/encyclopedia.md §12.7, §12.9) over the fake Pixi app and the fake baker
// `render-session.spec.ts` uses, so no spec here touches WebGL or `BitmapText` (which crashes jsdom).
//
// Three things are load-bearing and each is pinned by observing the thing itself, not a flag: **one bake per
// session** (the bundle's bakes are counted, and `show` must add none — ticket #442 measures the same bake at
// about 1.2 s on this box, so a rebake per entry would freeze the reader's page); **nothing leaks** over repeated
// opens, because a browser caps WebGL contexts at 16 and the BitmapFont cache is process-wide; and the **pause is
// the ticker, not the `FrameGate`**, because the room's own hook must keep working underneath the encyclopedia.

import { DEFAULT_BALANCE, ManualClock, TICK_INTERVAL_S, ZONE_ID, type BalanceConfig } from '@evolution/shared';
import { describe, expect, it, vi } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { PREVIEW_CANVAS_MAX_PX, PREVIEW_MAX_DEVICE_PIXEL_RATIO } from '../constants';
import { EVOLUTION_DEBUG_KEY, EVOLUTION_DEBUG_MODE } from '../../debug/evolution-debug';
import {
  PreviewSession,
  cappedPreviewDevicePixelRatio,
  clampedPreviewCanvasSize,
  type PreviewSessionDependencies,
} from './preview-session';
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

describe('PreviewSession.start', () => {
  it('bakes one bundle at PREVIEW_SEED and reports the open split, which sums to the total', async () => {
    const { subject, apps, clock } = harness();
    const start = subject.start(VENT_SPEC);
    clock.advanceMilliseconds(1);
    const timings = await start;
    expect(apps).toHaveLength(1);
    expect(timings).not.toBeNull();
    expect(timings!.initMs + timings!.bakeMs + timings!.firstSubmitMs).toBeCloseTo(timings!.openedToFirstFrameMs, 9);
    for (const value of Object.values(timings!)) expect(Number.isFinite(value)).toBe(true);
    expect(apps[0]!.renderCalls.count).toBe(1);
    subject.destroy();
  });

  it('never installs the debug hook: the room’s stays in place under the encyclopedia', async () => {
    const { subject } = harness();
    await subject.start(VENT_SPEC);
    expect(window[EVOLUTION_DEBUG_KEY]).toBeUndefined();
    subject.destroy();
  });

  /** A close that lands while the context is still being created must not leak it toward the browser's cap of 16. */
  it('destroys an app that arrives after destroy, and resolves null', async () => {
    const { subject, apps } = harness();
    const start = subject.start(VENT_SPEC);
    subject.destroy();
    expect(await start).toBeNull();
    expect(apps).toHaveLength(1);
    expect(apps[0]!.lifecycle.isDestroyed).toBe(true);
    // Nothing was baked into it either: the bundle is built after the destroy guard.
    expect(apps[0]!.textures.installedFonts).toHaveLength(0);
  });
});

describe('PreviewSession.show', () => {
  it('swaps the scene without a second bake', async () => {
    const { subject, apps } = harness();
    await subject.start(VENT_SPEC);
    const baker = apps[0]!.textures;
    const bakesAfterOpen = baker.texturedBakes.length;
    const fontsAfterOpen = baker.installedFonts.length;
    expect(bakesAfterOpen).toBeGreaterThan(0);
    subject.show(SHALLOWS_SPEC);
    subject.show(VENT_SPEC);
    apps[0]!.tick();
    expect(baker.texturedBakes).toHaveLength(bakesAfterOpen);
    expect(baker.installedFonts).toHaveLength(fontsAfterOpen);
    expect(apps).toHaveLength(1);
    subject.destroy();
  });

  it('restarts the scene’s loop, so showing the same spec again is the replay', async () => {
    const { subject, apps, clock } = harness();
    await subject.start(VENT_SPEC);
    clock.advanceMilliseconds(2_000);
    apps[0]!.tick();
    expect(subject.lastRenderedTick).toBeGreaterThan(0);
    subject.show(VENT_SPEC);
    apps[0]!.tick();
    expect(subject.lastRenderedTick).toBe(0);
    subject.destroy();
  });
});

describe('PreviewSession open and close cycles', () => {
  const cycles = 6;

  async function runCycles(dependencies: PreviewSessionDependencies): Promise<void> {
    for (let cycle = 0; cycle < cycles; cycle += 1) {
      const session = new PreviewSession(dependencies);
      await session.start(VENT_SPEC);
      session.destroy();
    }
  }

  /** The leak loop of §12.9, in the unit tier: what the `opens=20` smoke checks over a real context. */
  it('creates and destroys one app, one bundle and one font pair per cycle', async () => {
    const { apps, dependencies } = harness();
    await runCycles(dependencies);
    expect(apps).toHaveLength(cycles);
    const bakesPerCycle = apps[0]!.textures.texturedBakes.length;
    expect(bakesPerCycle).toBeGreaterThan(0);
    let installedFonts = 0;
    let uninstalledFonts = 0;
    for (const app of apps) {
      installedFonts += app.textures.installedFonts.length;
      uninstalledFonts += app.textures.uninstalledFonts.length;
      expect(app.textures.texturedBakes).toHaveLength(bakesPerCycle);
      expect(app.lifecycle.isDestroyed).toBe(true);
    }
    expect(installedFonts).toBeGreaterThan(0);
    // A bundle uninstalls its fonts when it is destroyed, so equal counts mean bakes = bundle destroys.
    expect(uninstalledFonts).toBe(installedFonts);
  });

  it('gives each cycle’s bundle its own font names', async () => {
    const { apps, dependencies } = harness();
    await runCycles(dependencies);
    const names = apps.flatMap((app) => app.textures.installedFonts.map((install) => install.name));
    expect(names).toHaveLength(cycles * 2);
    expect(new Set(names).size).toBe(names.length);
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
    subject.pause();
    clock.advanceMilliseconds(5_000);
    subject.show(SHALLOWS_SPEC);
    clock.advanceMilliseconds(5_000);
    subject.resume();
    apps[0]!.tick();
    expect(subject.lastRenderedTick).toBe(0);
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
