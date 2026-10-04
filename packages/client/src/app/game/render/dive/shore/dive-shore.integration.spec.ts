// The shore band inside the dive (docs/rendering/opening-dive.md §4, ticket #801): the session, its upper layers, the
// shore band, its levels and its quad together, over the fake Pixi app and recording canvases (quick stand-in tiles,
// the real levels). What is checked is what the band table and the camera hand the shore, what reaches its quad, and
// that it draws on the dive's one Pixi app, under the kelp's meshes and the mockup's canvas.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import {
  fakeDiveBands,
  fakePlanetSource,
  fakeUpperBands,
  startedDiveSession,
} from '../../../../../testing/dive-session-harness';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import {
  QUICK_TILE_BAKES,
  SHORE_INTEGRATION_TEST_TIMEOUT_MS,
  TEST_SHORE_LAND,
} from '../../../../../testing/shore-paint-builder';
import { DiveShoreBand } from './dive-shore-band';
import { shoreLevelZoom } from './shore-lod';
import { SHORE_SHADER, SHORE_UNIFORM_GROUP } from './shore-shader-names';
import { ShoreTiles } from './shore-tiles';

function realShoreBands() {
  const factory = createFakeShoreCanvasFactory();
  const tiles = new ShoreTiles(factory, QUICK_TILE_BAKES);
  const made: DiveShoreBand[] = [];
  const bands = fakeUpperBands(fakeDiveBands(), fakePlanetSource(), {
    createBand: (renderToTexture, devicePixelRatio) => {
      const band = new DiveShoreBand({ land: TEST_SHORE_LAND, tiles, factory }, devicePixelRatio, renderToTexture);
      made.push(band);
      return band;
    },
  });
  return { bands, made };
}

async function openedDive() {
  const scheduler = new ManualScheduler();
  const upper = realShoreBands();
  const harness = await startedDiveSession({ scheduler, loadUpperBands: () => Promise.resolve(upper.bands) });
  const bakeFor = (milliseconds: number): void => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) scheduler.advanceMilliseconds(10);
  };
  harness.app.tick();
  bakeFor(DIVE_BAKE_START_DELAY_MS + 2000);
  const settleAt = (zoom: number): void => {
    harness.subject.controls.scrub(zoom);
    harness.app.tick();
    bakeFor(3000);
    harness.subject.requestFrame();
    harness.app.tick();
  };
  return { ...harness, mockup: upper.bands.mockup, band: upper.made[0]!, bakeFor, settleAt };
}

function uniforms(band: DiveShoreBand): Record<string, unknown> {
  const mesh = band.view as unknown as {
    shader: { resources: Record<string, { uniforms: Record<string, unknown> }> };
  };
  return mesh.shader.resources[SHORE_UNIFORM_GROUP]!.uniforms;
}

const opacityOf = (canvas: HTMLCanvasElement): number => Number(canvas.style.opacity);

describe('the shore band in the dive', { timeout: SHORE_INTEGRATION_TEST_TIMEOUT_MS }, () => {
  it('draws on the dive’s one Pixi app, over the planet and under the kelp, with the mockup’s canvas over it', async () => {
    const { subject, app, apps, band, mockup, dependencies, settleAt } = await openedDive();
    expect(apps).toHaveLength(1);
    expect(app.stage.children.at(-2)).toBe(band.view);
    // below the planet's band the game's canvas stays up, under the mockup's
    settleAt(0);
    expect(band.view.visible).toBe(true);
    expect(opacityOf(app.canvas)).toBe(1);
    expect(dependencies.host.lastElementChild).toBe(mockup.canvas);
    subject.destroy();
  });

  it('shows in its band and draws the level the camera is in, faded in over the planet', async () => {
    const { subject, band, settleAt } = await openedDive();
    settleAt(4.6);
    const bandAlpha = uniforms(band)[SHORE_SHADER.bandAlpha] as number;
    expect(bandAlpha).toBeGreaterThan(0);
    expect(bandAlpha).toBeLessThan(1);
    expect(band.view.visible).toBe(true);
    subject.destroy();
  });

  it('crossfades to the next level as the camera falls through a step', async () => {
    const { subject, app, band, settleAt } = await openedDive();
    settleAt(shoreLevelZoom(12));
    subject.controls.scrub(shoreLevelZoom(12) - 0.1);
    app.tick();
    expect(uniforms(band)[SHORE_SHADER.fineWeight] as number).toBeCloseTo(0.1 / 0.15, 5);
    subject.destroy();
  });

  it('hides above its band and past its cut, and charges its frames to its own column', async () => {
    const { subject, app, band } = await openedDive();
    subject.controls.scrub(6);
    app.tick();
    expect(band.view.visible).toBe(false);
    subject.controls.scrub(-2);
    app.tick();
    expect(band.view.visible).toBe(false);
    subject.controls.scrub(2);
    subject.frameTimes.take();
    app.tick();
    expect(subject.frameTimes.take().frames).toBe(1);
    subject.destroy();
  });

  it('gives its quad back with the dive', async () => {
    const { subject, band } = await openedDive();
    subject.destroy();
    expect(band.view.destroyed).toBe(true);
  });
});
