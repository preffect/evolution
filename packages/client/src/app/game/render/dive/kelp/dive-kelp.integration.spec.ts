// The kelp band inside the dive (docs/rendering/opening-dive.md §4, ticket #802): the session, its upper layers and the
// real kelp band together, over the fake Pixi app and recording canvases (quick stand-in bakes and shore tiles).
// What is checked is that it draws on the dive's one Pixi app over the shore's quad, its bakes pumped by the dive and
// counted before the autoplay, its parts shown by the band table and the camera, the mockup's slime canvas over it,
// its own frame-time column, and its GPU objects given back with the dive.

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
import { fakeShoreMaker } from '../../../../../testing/fake-shore-band';
import { quickKelpBake } from '../../../../../testing/kelp-builder';
import { TEST_SHORE_LAND, bakedTestTiles } from '../../../../../testing/shore-paint-builder';
import { DiveKelpBand } from './dive-kelp-band';
import { KelpBakes, kelpBaker } from './kelp-bakes';

const BAKE_SLICES = 5;

async function openedDive() {
  const scheduler = new ManualScheduler();
  const bakes = new KelpBakes(
    { land: TEST_SHORE_LAND, factory: createFakeShoreCanvasFactory() },
    quickKelpBake(BAKE_SLICES),
  );
  const made: DiveKelpBand[] = [];
  const shore = fakeShoreMaker();
  const kelp = {
    bakes: kelpBaker(bakes, () => 0),
    createBand: (renderToTexture: ConstructorParameters<typeof DiveKelpBand>[2], devicePixelRatio: number) => {
      const band = new DiveKelpBand({ bakes, tiles: bakedTestTiles() }, devicePixelRatio, renderToTexture);
      made.push(band);
      return band;
    },
  };
  const bands = fakeUpperBands(fakeDiveBands(), fakePlanetSource(), shore, { kelp });
  const harness = await startedDiveSession({ scheduler, loadUpperBands: () => Promise.resolve(bands) });
  const bakeFor = (milliseconds: number): void => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) scheduler.advanceMilliseconds(10);
  };
  const scrubTo = (zoom: number): void => {
    harness.subject.controls.scrub(zoom);
    harness.app.tick();
  };
  return { ...harness, bakes, mockup: bands.mockup, band: made[0]!, shoreBand: shore.bands[0]!, bakeFor, scrubTo };
}

const opacityOf = (canvas: HTMLCanvasElement): number => Number(canvas.style.opacity);

describe('the kelp band in the dive', () => {
  it('draws on the dive’s one Pixi app, over the shore’s quad', async () => {
    const { subject, app, apps, band, shoreBand } = await openedDive();
    expect(apps).toHaveLength(1);
    expect(app.stage.children.at(-1)).toBe(band.view);
    expect(app.stage.children.at(-2)).toBe(shoreBand.view);
    subject.destroy();
  });

  it('is baked by the dive’s pump, and the dive is not baked until it is', async () => {
    const { subject, bakes, bakeFor } = await openedDive();
    expect(bakes.isBaked).toBe(false);
    expect(isDiveBaked(subject)).toBe(false);
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    expect(bakes.isBaked).toBe(true);
    subject.destroy();
  });

  it('shows its parts by the band table, the slime’s canvas over it in the drop, and nothing past the drop', async () => {
    const { subject, app, band, mockup, dependencies, bakeFor, scrubTo } = await openedDive();
    dependencies.host.append(app.canvas);
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    scrubTo(1);
    expect(band.view.children[0]!.visible).toBe(true);
    scrubTo(-2.2);
    expect(band.view.children[4]!.visible).toBe(true);
    expect(opacityOf(app.canvas)).toBe(1);
    expect(dependencies.host.lastElementChild).toBe(mockup.canvas);
    scrubTo(-3.3);
    expect(band.view.children.every((mesh) => !mesh.visible)).toBe(true);
    expect(opacityOf(app.canvas)).toBe(0);
    subject.destroy();
  });

  it('charges its frames to its own column, and gives its meshes back with the dive', async () => {
    const { subject, band, bakeFor, scrubTo } = await openedDive();
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    subject.frameTimes.take();
    scrubTo(0.5);
    const report = subject.frameTimes.take();
    expect(report.frames).toBe(1);
    expect(report).toHaveProperty('kelpMs');
    subject.destroy();
    expect(band.view.destroyed).toBe(true);
  });
});

/** Whether the session's upper layers count the dive as baked (the autoplay waits on it). */
function isDiveBaked(subject: { readonly controls: unknown }): boolean {
  return (subject as unknown as { upper: { isBaked: boolean } }).upper.isBaked;
}
