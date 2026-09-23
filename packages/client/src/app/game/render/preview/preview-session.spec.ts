// The preview session (docs/architecture/encyclopedia.md §12.7, §12.9) over the fake Pixi app and the fake baker
// `render-session.spec.ts` uses, so no spec here touches WebGL or `BitmapText` (which crashes jsdom).
//
// Three things are load-bearing and each is pinned by observing the thing itself, not a flag: **one bake per
// session** (the bundle's bakes are counted, and `show` must add none — ticket #442 measures the same bake at
// about 1.2 s on this box, so a rebake per entry would freeze the reader's page); **nothing leaks** over repeated
// opens, because a browser caps WebGL contexts at 16 and the BitmapFont cache is process-wide; and the **pause is
// the ticker, not the `FrameGate`**, because the room's own hook must keep working underneath the encyclopedia.

import { DEFAULT_BALANCE, ManualClock, ZONE_ID, type BalanceConfig } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import { EVOLUTION_DEBUG_KEY } from '../../debug/evolution-debug';
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

describe('PreviewSession.start', () => {
  /**
   * Each of the three spans brackets exactly the call it names, so they do **not** sum to the total: adopting the
   * ticker and building the scene fall between them, outside all three. What must hold is that none of them
   * escapes the total, which is what stops a span quietly covering work its name does not cover.
   */
  it('bakes one bundle at PREVIEW_SEED and reports an open split that stays inside the total', async () => {
    const { subject, apps, clock } = harness();
    const start = subject.start(VENT_SPEC);
    clock.advanceMilliseconds(1);
    const timings = await start;
    expect(apps).toHaveLength(1);
    expect(timings).not.toBeNull();
    const { initMs, bakeMs, firstSubmitMs, openedToFirstFrameMs } = timings!;
    for (const value of Object.values(timings!)) expect(Number.isFinite(value)).toBe(true);
    expect(initMs + bakeMs + firstSubmitMs).toBeLessThanOrEqual(openedToFirstFrameMs);
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

describe('PreviewSession.destroy', () => {
  /** Ticket #503: a texture destroyed while a kept shader still binds it logs a Pixi `[BindGroup]` warning. */
  it('unbinds the app’s textures before it destroys the bundle', async () => {
    const { subject, apps } = harness();
    await subject.start(VENT_SPEC);
    const app = apps[0]!;
    const destroyedAtUnbind: number[] = [];
    const destroyedCount = (): number => app.textures.madeTextures.filter((texture) => texture.destroyed).length;
    app.unbindTextures = () => destroyedAtUnbind.push(destroyedCount());
    subject.destroy();
    expect(destroyedAtUnbind).toEqual([0]);
    expect(destroyedCount()).toBeGreaterThan(0);
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

  /**
   * §12.7: *time is monotonic and never wraps* — the clip tracker, the ghost registry and the sprint-ring tracker
   * key on `nowMs`, which `GameRenderer` derives from `timeSeconds`, which is this tick. A `show` that reset it
   * would leave any clip started before the swap with `nowMs - startMs` negative, so `isClipFinished` would never
   * be true and the instance would never be pruned. `show` therefore moves the scene's **phase**, not the clock.
   */
  it('restarts the scene’s loop on a phase change, never by moving the tick backwards', async () => {
    const { subject, apps, clock } = harness();
    await subject.start(VENT_SPEC);
    clock.advanceMilliseconds(2_000);
    apps[0]!.tick();
    const tickBeforeSwap = subject.lastRenderedTick!;
    expect(tickBeforeSwap).toBeGreaterThan(0);
    expect(subject.lastSceneTick).toBeCloseTo(tickBeforeSwap, 9);

    subject.show(VENT_SPEC);
    apps[0]!.tick();
    // The scene is back at the start of its loop...
    expect(subject.lastSceneTick).toBe(0);
    // ...and the tick the renderer sees has not gone back with it.
    expect(subject.lastRenderedTick!).toBeGreaterThanOrEqual(tickBeforeSwap);
    subject.destroy();
  });

  it('keeps the render tick climbing across many swaps, however often the scene restarts', async () => {
    const { subject, apps, clock } = harness();
    await subject.start(VENT_SPEC);
    const swaps = 5;
    const stepMs = 1_000;
    let previous = subject.lastRenderedTick ?? 0;
    for (let swap = 0; swap < swaps; swap += 1) {
      clock.advanceMilliseconds(stepMs);
      subject.show(swap % 2 === 0 ? SHALLOWS_SPEC : VENT_SPEC);
      apps[0]!.tick();
      expect(subject.lastSceneTick, `scene restarted on swap ${swap}`).toBe(0);
      expect(subject.lastRenderedTick!, `render tick monotonic across swap ${swap}`).toBeGreaterThan(previous);
      previous = subject.lastRenderedTick!;
    }
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
