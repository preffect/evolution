// The slime band inside the dive (docs/rendering/opening-dive.md §4, ticket #803): the session, its upper layers and
// the real slime band together, over the fake Pixi app and recording canvases (quick stand-in bakes and shore tiles).
// What is checked is that it draws on the dive's one Pixi app — over the kelp band while the drop shows, under the
// game's dish at the bottom of the stage, the dish fading in over it as a group of its own — its bakes pumped by the
// dive and counted before the autoplay, its parts shown by the band table and the camera, its own frame-time column,
// and its GPU objects given back with the dive.

import { ManualScheduler } from '@evolution/shared';
import { AlphaFilter, type Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import {
  fakePlanetSource,
  fakeUpperBands,
  startedDiveSession,
  tickUntilBuilt,
} from '../../../../../testing/dive-session-harness';
import { fakeKelpMaker } from '../../../../../testing/fake-kelp-band';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { SLIME_BAND_TEST_TIMEOUT_MS, quickSlimeBake, testSlimeScatters } from '../../../../../testing/slime-builder';
import type { RenderToTexture } from '../planet/dive-planet-mesh';
import { DiveSlimeBand } from './dive-slime-band';
import { SlimeBakes, slimeBaker } from './slime-bakes';

const BAKE_SLICES = 5;

function* quickScatters() {
  yield;
  return testSlimeScatters();
}

async function openedDive() {
  const scheduler = new ManualScheduler();
  const factory = createFakeShoreCanvasFactory();
  const bakes = new SlimeBakes({ factory, devicePixelRatio: 1 }, quickSlimeBake(BAKE_SLICES), quickScatters);
  const made: DiveSlimeBand[] = [];
  const kelp = fakeKelpMaker();
  const slime = {
    createBand: (renderToTexture: RenderToTexture, devicePixelRatio: number) => {
      const band = new DiveSlimeBand({ bakes, tiles: bakedTestTiles(), factory }, devicePixelRatio, renderToTexture);
      made.push(band);
      return { band, bakes: slimeBaker(bakes, () => 0) };
    },
  };
  const bands = fakeUpperBands(fakePlanetSource(), undefined, { kelp, slime });
  const harness = await startedDiveSession({ scheduler, loadUpperBands: () => Promise.resolve(bands) });
  const bakeFor = (milliseconds: number): void => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) scheduler.advanceMilliseconds(10);
  };
  const scrubTo = (zoom: number): void => {
    harness.subject.controls.scrub(zoom);
    harness.app.tick();
  };
  return { ...harness, bakes, band: made[0]!, kelpBand: kelp.bands[0]!, bakeFor, scrubTo };
}

/** The dish's group alpha: its root's alpha filter's, or 1 with none. */
function dishFadeOf(gameRoot: Container): number {
  const [filter] = (gameRoot.filters as readonly unknown[] | null | undefined) ?? [];
  return filter instanceof AlphaFilter ? filter.alpha : 1;
}

/** Whether the session's upper layers count the dive as baked (the autoplay waits on it). */
function isDiveBaked(subject: { readonly controls: unknown }): boolean {
  return (subject as unknown as { upper: { isBaked: boolean } }).upper.isBaked;
}

describe('the slime band in the dive', { timeout: SLIME_BAND_TEST_TIMEOUT_MS }, () => {
  it('draws on the dive’s one Pixi app: over the kelp band in the drop, under the dish at the bottom', async () => {
    const { subject, app, apps, band, kelpBand, bakeFor, scrubTo } = await openedDive();
    expect(apps).toHaveLength(1);
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    tickUntilBuilt(app, subject);
    scrubTo(-2.2);
    const children = app.stage.children;
    expect(children.at(-1)).toBe(band.view);
    expect(children.indexOf(band.view)).toBeGreaterThan(children.indexOf(kelpBand.view));
    scrubTo(-4.1);
    expect(children[0]).toBe(band.view);
    expect(children[1]!.visible).toBe(true);
    subject.destroy();
  });

  it('is baked by the dive’s pump, and the dive is not baked until it is', async () => {
    const { subject, bakes, bakeFor } = await openedDive();
    expect(bakes.isBaked).toBe(false);
    expect(isDiveBaked(subject)).toBe(false);
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    expect(bakes.isBaked).toBe(true);
    expect(isDiveBaked(subject)).toBe(true);
    subject.destroy();
  });

  it('shows its parts by the band table, and fades the dish in over it as a group as the dark field comes', async () => {
    const { subject, app, band, bakeFor, scrubTo } = await openedDive();
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    tickUntilBuilt(app, subject);
    scrubTo(-1.9);
    expect(band.view.children.every((child) => !child.visible)).toBe(true);
    scrubTo(-3.96);
    const [floor, , , , plankton, outside, rods] = band.view.children;
    expect([floor, plankton, outside, rods].every((child) => child!.visible)).toBe(true);
    const gameRoot = app.stage.children[1]!;
    expect(dishFadeOf(gameRoot)).toBeCloseTo(0.5, 6);
    expect(Number(app.canvas.style.opacity)).toBe(1);
    scrubTo(-4.75);
    expect(band.view.children.every((child) => !child.visible)).toBe(true);
    expect(dishFadeOf(gameRoot)).toBe(1);
    subject.destroy();
  });

  it('charges its frames to its own column, and gives its meshes back with the dive', async () => {
    const { subject, band, bakeFor, scrubTo } = await openedDive();
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    subject.frameTimes.take();
    scrubTo(-3);
    const report = subject.frameTimes.take();
    expect(report.frames).toBe(1);
    expect(report).toHaveProperty('slimeMs');
    subject.destroy();
    expect(band.view.destroyed).toBe(true);
  });
});
