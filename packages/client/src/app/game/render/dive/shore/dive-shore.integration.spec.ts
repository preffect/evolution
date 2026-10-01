// The shore band inside the dive (docs/rendering/opening-dive.md §4, ticket #801): the session, its upper stage, the
// shore band, its levels and its quad together, over fake Pixi apps and recording canvases (quick stand-in tiles, the
// real levels). What is checked is what the band table and the camera hand the shore, and what reaches its quad.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import { DIVE_SHORE_CANVAS_TEST_ID } from '../../constants/dive-shore';
import { fakeDiveBands, startedDiveSession } from '../../../../../testing/dive-session-harness';
import type { FakePixiApp } from '../../../../../testing/fake-pixi-app';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { QUICK_TILE_BAKES, TEST_SHORE_LAND } from '../../../../../testing/shore-paint-builder';
import type { DiveUpperBands } from '../dive-macro-band';
import { DiveShoreBand } from './dive-shore-band';
import { shoreLevelZoom } from './shore-lod';
import { SHORE_SHADER, SHORE_UNIFORM_GROUP } from './shore-shader-names';
import { ShoreTiles } from './shore-tiles';

function realShoreBands(): DiveUpperBands {
  const factory = createFakeShoreCanvasFactory();
  const tiles = new ShoreTiles(factory, QUICK_TILE_BAKES);
  return {
    mockup: fakeDiveBands(),
    shore: {
      createBand: (pixi, devicePixelRatio) =>
        new DiveShoreBand(pixi, { land: TEST_SHORE_LAND, tiles, factory }, devicePixelRatio),
    },
  };
}

async function openedDive() {
  const scheduler = new ManualScheduler();
  const harness = await startedDiveSession({ scheduler, loadUpperBands: () => Promise.resolve(realShoreBands()) });
  const shoreApp = harness.apps[1]!;
  const bakeFor = (milliseconds: number): void => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) scheduler.advanceMilliseconds(10);
  };
  bakeFor(DIVE_BAKE_START_DELAY_MS + 2000);
  return { ...harness, shoreApp, bakeFor };
}

function uniforms(shoreApp: FakePixiApp): Record<string, unknown> {
  const mesh = shoreApp.stage.children[0] as unknown as {
    shader: { resources: Record<string, { uniforms: Record<string, unknown> }> };
  };
  return mesh.shader.resources[SHORE_UNIFORM_GROUP]!.uniforms;
}

describe('the shore band in the dive', () => {
  it('opens on its own canvas between the planet’s and the kelp’s', async () => {
    const { subject, dependencies, apps } = await openedDive();
    const canvases = [...dependencies.host.children];
    expect(canvases).toHaveLength(3);
    expect(canvases[1]).toBe(apps[1]!.canvas);
    expect(apps[1]!.canvas.dataset['testid']).toBe(DIVE_SHORE_CANVAS_TEST_ID);
    subject.destroy();
  });

  it('shows in its band and draws the level the camera is in, faded in over the planet', async () => {
    const { subject, app, shoreApp, bakeFor } = await openedDive();
    subject.controls.scrub(4.6);
    app.tick();
    bakeFor(2000);
    subject.requestFrame();
    app.tick();
    expect(shoreApp.canvas.hidden).toBe(false);
    const drawn = uniforms(shoreApp);
    const bandAlpha = drawn[SHORE_SHADER.bandAlpha] as number;
    expect(bandAlpha).toBeGreaterThan(0);
    expect(bandAlpha).toBeLessThan(1);
    expect(shoreApp.stage.children[0]!.visible).toBe(true);
    subject.destroy();
  });

  it('crossfades to the next level as the camera falls through a step', async () => {
    const { subject, app, shoreApp, bakeFor } = await openedDive();
    subject.controls.scrub(shoreLevelZoom(12));
    app.tick();
    bakeFor(3000);
    subject.controls.scrub(shoreLevelZoom(12) - 0.1);
    app.tick();
    expect(uniforms(shoreApp)[SHORE_SHADER.fineWeight] as number).toBeCloseTo(0.1 / 0.15, 5);
    subject.destroy();
  });

  it('hides above its band and past its cut, and charges its frames to its own column', async () => {
    const { subject, app, shoreApp } = await openedDive();
    subject.controls.scrub(6);
    app.tick();
    expect(shoreApp.canvas.hidden).toBe(true);
    subject.controls.scrub(-2);
    app.tick();
    expect(shoreApp.canvas.hidden).toBe(true);
    subject.controls.scrub(2);
    subject.frameTimes.take();
    app.tick();
    expect(subject.frameTimes.take().frames).toBe(1);
    subject.destroy();
  });

  it('gives its app back with the dive', async () => {
    const { subject, shoreApp } = await openedDive();
    subject.destroy();
    expect(shoreApp.lifecycle.isDestroyed).toBe(true);
  });
});
