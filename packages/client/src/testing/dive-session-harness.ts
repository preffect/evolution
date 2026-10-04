// The dive session's spec harness (docs/rendering/opening-dive.md §7): a `DiveSession` over a fake Pixi app, a planet
// whose coastline bakes are one texel each, and recording shore, kelp and slime bands and forest test, on a manual
// clock and scheduler, for the session's specs.

import { DEFAULT_BALANCE, ManualClock, ManualScheduler } from '@evolution/shared';
import type { Geometry, Mesh, Shader, UniformGroup } from 'pixi.js';
import { expect } from 'vitest';
import { DiveSession, type DiveSessionDependencies } from '../app/game/render/dive/dive-session';
import type { DiveView } from '../app/game/render/dive/dive-view';
import type {
  DiveForestTest,
  DiveUpperBands,
  KelpBandMaker,
  ShoreBandMaker,
  SlimeBandMaker,
} from '../app/game/render/dive/dive-band-loader';
import type { DivePlanetSource } from '../app/game/render/dive/dive-planet-band';
import type { DivePlanetBake, DivePlanetBakeJob } from '../app/game/render/dive/planet/dive-planet-bakes';
import { DIVE_PLANET_UNIFORM_GROUP } from '../app/game/render/dive/planet/dive-planet-shader';
import { DIVE_PLANET_OPEN_SEA_TEXEL } from '../app/game/render/constants';
import { TEST_NOISE_TILE_SIZE_PX, createFakePixiApp, type FakePixiApp } from './fake-pixi-app';
import { fakeForestTest, fakeKelpMaker, type FakeKelpMaker } from './fake-kelp-band';
import { fakeShoreMaker, type FakeShoreMaker } from './fake-shore-band';
import { fakeSlimeMaker, type FakeSlimeMaker } from './fake-slime-band';

const ONE_TEXEL = 1;

/** A bake job that yields `slices` times and then lands one texel of sea. */
export function* oneTexelBakeJob(slices = 1): DivePlanetBakeJob {
  for (let slice = 0; slice < slices; slice += 1) yield;
  const bake: DivePlanetBake = {
    width: ONE_TEXEL,
    height: ONE_TEXEL,
    data: new Uint8Array(DIVE_PLANET_OPEN_SEA_TEXEL),
    metresPerTexel: 1,
  };
  return bake;
}

/**
 * A planet whose three bakes each land a texel after `slices` yields. Kept (the default), they were all made on an
 * earlier open, so the planet is baked from the start; otherwise the dive bakes them on its scheduler.
 */
export function fakePlanetSource(
  options: { readonly isKept?: boolean; readonly slices?: number } = {},
): DivePlanetSource {
  const slices = options.slices ?? 1;
  const kept: DivePlanetSource['kept'] = new Map();
  if (options.isKept ?? true) {
    for (const slot of ['worldSdf', 'regionSdf'] as const) kept.set(slot, runToEnd(oneTexelBakeJob(0)));
  }
  return {
    plan: {
      regionBox: { west: -124, south: 48, east: -123, north: 49 },
      worldPreview: () => oneTexelBakeJob(slices),
      world: () => oneTexelBakeJob(slices),
      region: () => oneTexelBakeJob(slices),
    },
    kept,
  };
}

function runToEnd(job: DivePlanetBakeJob): DivePlanetBake {
  for (let step = job.next(); ; step = job.next()) if (step.done === true) return step.value;
}

/** What the lazy chunks would give the session: a planet of one-texel bakes, recording shore, kelp and slime bands. */
export function fakeUpperBands(
  planet = fakePlanetSource(),
  shore: ShoreBandMaker = fakeShoreMaker(),
  rest: { readonly kelp?: KelpBandMaker; readonly slime?: SlimeBandMaker; readonly forest?: DiveForestTest } = {},
): DiveUpperBands {
  return {
    planet,
    shore,
    kelp: rest.kelp ?? fakeKelpMaker(),
    slime: rest.slime ?? fakeSlimeMaker(),
    forest: rest.forest ?? fakeForestTest(),
  };
}

export interface DiveSessionHarness {
  readonly subject: DiveSession;
  readonly clock: ManualClock;
  readonly shore: FakeShoreMaker;
  readonly kelp: FakeKelpMaker;
  readonly slime: FakeSlimeMaker;
  readonly apps: FakePixiApp[];
  readonly views: DiveView[];
  readonly motion: { isReduced: boolean };
  readonly dependencies: DiveSessionDependencies;
}

export function diveSessionHarness(overrides: Partial<DiveSessionDependencies> = {}): DiveSessionHarness {
  const clock = new ManualClock(0);
  const shore = fakeShoreMaker();
  const kelp = fakeKelpMaker();
  const slime = fakeSlimeMaker();
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
    loadUpperBands: () => Promise.resolve(fakeUpperBands(fakePlanetSource(), shore, { kelp, slime })),
    balance: () => DEFAULT_BALANCE,
    isMotionReduced: () => motion.isReduced,
    onView: (view) => views.push(view),
    noiseTileSizePx: TEST_NOISE_TILE_SIZE_PX,
    ...overrides,
  };
  return { subject: new DiveSession(dependencies), clock, shore, kelp, slime, apps, views, motion, dependencies };
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

/** A uniform of the planet's last draw into its texture, as the app was handed it; `undefined` before any. */
export function planetUniformOf(app: FakePixiApp, name: string): unknown {
  const quad = app.textureRenders.at(-1)?.container as Mesh<Geometry, Shader> | undefined;
  const group = quad?.shader?.resources[DIVE_PLANET_UNIFORM_GROUP] as UniformGroup | undefined;
  return group?.uniforms[name];
}
