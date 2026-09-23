// The preview's app pool (docs/architecture/encyclopedia.md §12.7, ticket #503) over the fake Pixi app, so no spec
// here touches WebGL. What is pinned is the thing the browser counts: how many apps (so contexts) exist across
// opens, and that a kept app carries nothing of the previous open into the next — no ticker callback, no stage
// child, no running ticker while nobody holds it.

import { DEFAULT_BALANCE, ManualClock, ZONE_ID } from '@evolution/shared';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from '../../../../testing/fake-pixi-app';
import type { PixiAppOptions } from '../pixi-app';
import { PreviewAppPool } from './preview-app-pool';
import { PreviewSession } from './preview-session';
import { PREVIEW_SCENE } from './preview-spec';

const LENS_SIDE_PX = 360;
const LENS_SIZE_PX = { width: LENS_SIDE_PX, height: LENS_SIDE_PX };
const RESIZED_SIZE_PX = { width: 180, height: 180 };
const RETINA_DEVICE_PIXEL_RATIO = 2;

interface Harness {
  readonly pool: PreviewAppPool;
  readonly apps: FakePixiApp[];
}

function harness(): Harness {
  const apps: FakePixiApp[] = [];
  const pool = new PreviewAppPool(() => {
    const app = createFakePixiApp({ ...LENS_SIZE_PX });
    apps.push(app);
    return Promise.resolve(app);
  });
  return { pool, apps };
}

function options(overrides: Partial<PixiAppOptions> = {}): PixiAppOptions {
  return {
    host: document.createElement('div'),
    devicePixelRatio: 1,
    fixedSize: LENS_SIZE_PX,
    shouldPreserveDrawingBuffer: false,
    ...overrides,
  };
}

describe('PreviewAppPool.acquire', () => {
  it('hands the released app back to the next open, re-hosted, resized and ticking', async () => {
    const { pool, apps } = harness();
    const first = await pool.acquire(options());
    first.app.ticker.add(() => undefined);
    first.destroy();
    expect(apps[0]!.ticking.isRunning).toBe(false);
    expect(first.canvas.parentElement).toBeNull();

    const secondHost = document.createElement('div');
    const second = await pool.acquire(options({ host: secondHost, fixedSize: RESIZED_SIZE_PX }));
    expect(apps).toHaveLength(1);
    expect(second.app).toBe(apps[0]!.app);
    expect(apps[0]!.lifecycle.isDestroyed).toBe(false);
    expect(second.canvas.parentElement).toBe(secondHost);
    expect(apps[0]!.screen).toEqual(RESIZED_SIZE_PX);
    expect(apps[0]!.ticking.isRunning).toBe(true);
  });

  it('empties the stage on release, so the next open starts on a bare stage', async () => {
    const { pool, apps } = harness();
    const first = await pool.acquire(options());
    const leftover = new Container();
    first.app.stage.addChild(leftover);
    first.destroy();
    expect(apps[0]!.stage.children).toHaveLength(0);
    expect(leftover.destroyed).toBe(true);
  });

  it('creates a new app for a different device pixel ratio or drawing-buffer mode, and destroys the kept one', async () => {
    const { pool, apps } = harness();
    (await pool.acquire(options())).destroy();
    (await pool.acquire(options({ devicePixelRatio: RETINA_DEVICE_PIXEL_RATIO }))).destroy();
    expect(apps).toHaveLength(2);
    expect(apps[0]!.lifecycle.isDestroyed).toBe(true);
    await pool.acquire(options({ devicePixelRatio: RETINA_DEVICE_PIXEL_RATIO, shouldPreserveDrawingBuffer: true }));
    expect(apps).toHaveLength(3);
    expect(apps[1]!.lifecycle.isDestroyed).toBe(true);
  });

  /** Two leases at once (an open that overlaps a close): each has its own app, and only one is kept. */
  it('creates a second app while the first is leased, and destroys the one released second', async () => {
    const { pool, apps } = harness();
    const first = await pool.acquire(options());
    const second = await pool.acquire(options());
    expect(apps).toHaveLength(2);
    first.destroy();
    second.destroy();
    expect(apps[0]!.lifecycle.isDestroyed).toBe(false);
    expect(apps[1]!.lifecycle.isDestroyed).toBe(true);
  });

  it('releases a lease once, however often it is destroyed', async () => {
    const { pool, apps } = harness();
    const first = await pool.acquire(options());
    first.destroy();
    const second = await pool.acquire(options());
    // A late second `destroy` on the first lease must not pull the app out from under the second.
    first.destroy();
    expect(apps[0]!.ticking.isRunning).toBe(true);
    expect(second.canvas.parentElement).not.toBeNull();
  });
});

describe('PreviewAppPool.dispose', () => {
  it('destroys the kept app, and every app released after it', async () => {
    const { pool, apps } = harness();
    (await pool.acquire(options())).destroy();
    const leased = await pool.acquire(options({ devicePixelRatio: RETINA_DEVICE_PIXEL_RATIO }));
    pool.dispose();
    expect(apps[0]!.lifecycle.isDestroyed).toBe(true);
    expect(apps[1]!.lifecycle.isDestroyed).toBe(false);
    leased.destroy();
    expect(apps[1]!.lifecycle.isDestroyed).toBe(true);
  });
});

describe('PreviewSession over the pool', () => {
  const opens = 2;

  /** The ticket's loss count, in the unit tier: two open and close cycles, one app, so one context. */
  it('opens twice on one app, with only the open session’s ticker callback on it', async () => {
    const { pool, apps } = harness();
    const clock = new ManualClock(0);
    const dependencies = {
      host: document.createElement('div'),
      clock,
      devicePixelRatio: 1,
      sizePx: LENS_SIZE_PX,
      createPixiApp: pool.acquire,
      balance: () => DEFAULT_BALANCE,
      shouldPreserveDrawingBuffer: false,
      noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    };
    for (let open = 0; open < opens; open += 1) {
      const session = new PreviewSession(dependencies);
      expect(await session.start({ scene: PREVIEW_SCENE.zone, zone: ZONE_ID.warmVent })).not.toBeNull();
      expect(apps).toHaveLength(1);
      expect(apps[0]!.tickerCallbacks).toHaveLength(1);
      const submitsBefore = apps[0]!.renderCalls.count;
      clock.advanceMilliseconds(1);
      apps[0]!.tick();
      expect(apps[0]!.renderCalls.count, `open ${open} draws on the kept app`).toBe(submitsBefore + 1);
      session.destroy();
      expect(apps[0]!.unbindCalls.count, `open ${open} unbinds before its bundle goes`).toBe(open + 1);
      expect(apps[0]!.tickerCallbacks).toHaveLength(0);
      expect(apps[0]!.stage.children).toHaveLength(0);
    }
    expect(apps[0]!.lifecycle.isDestroyed).toBe(false);
  });
});
