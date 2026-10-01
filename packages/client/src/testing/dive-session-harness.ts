// The dive session's spec harness (docs/rendering/opening-dive.md §7): a `DiveSession` over the fake Pixi app and a
// recording stand-in for the mockup's upper bands, on a manual clock and scheduler, for the session's two specs.

import { DEFAULT_BALANCE, ManualClock, ManualScheduler } from '@evolution/shared';
import { expect } from 'vitest';
import { DiveSession, type DiveSessionDependencies } from '../app/game/render/dive/dive-session';
import type { DiveView } from '../app/game/render/dive/dive-view';
import type { MockupBands, MockupFrame } from '../app/game/render/dive/mockup/dive-mockup-bands';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from './fake-pixi-app';

export interface FakeDiveBands extends MockupBands {
  readonly frames: MockupFrame[];
  readonly releases: { count: number };
  /** The world's coastline bake has landed; a spec clears it to show the fallback globe first. */
  isPlanetReady: boolean;
}

export function fakeDiveBands(): FakeDiveBands {
  const frames: MockupFrame[] = [];
  const releases = { count: 0 };
  const canvas = document.createElement('canvas');
  return {
    canvas,
    frames,
    releases,
    isBaked: true,
    isPlanetReady: true,
    draw: (frame) => frames.push(frame),
    pumpBakes: () => false,
    release: () => {
      releases.count += 1;
    },
  };
}

export interface DiveSessionHarness {
  readonly subject: DiveSession;
  readonly clock: ManualClock;
  readonly bands: FakeDiveBands;
  readonly apps: FakePixiApp[];
  readonly views: DiveView[];
  readonly motion: { isReduced: boolean };
  readonly dependencies: DiveSessionDependencies;
}

export function diveSessionHarness(overrides: Partial<DiveSessionDependencies> = {}): DiveSessionHarness {
  const clock = new ManualClock(0);
  const bands = fakeDiveBands();
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
export function tickUntilBuilt(app: FakePixiApp, subject: DiveSession): void {
  for (let frame = 0; frame < 200 && subject.isBuildingRenderer; frame += 1) app.tick();
  app.tick();
}

export async function startedDiveSession(
  overrides: Partial<DiveSessionDependencies> = {},
): Promise<DiveSessionHarness & { app: FakePixiApp }> {
  const parts = diveSessionHarness(overrides);
  expect(await parts.subject.start()).toBe(true);
  return { ...parts, app: parts.apps[0]! };
}
