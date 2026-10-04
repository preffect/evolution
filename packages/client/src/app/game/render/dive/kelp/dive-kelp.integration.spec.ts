// The kelp band inside the dive (docs/rendering/opening-dive.md §4, ticket #802): the session, its upper layers and the
// real kelp band together, over the fake Pixi app and recording canvases (quick stand-in bakes and shore tiles).
// What is checked is that it draws on the dive's one Pixi app over the shore's quad, its bakes pumped by the dive and
// counted before the autoplay, its parts shown by the band table and the camera, the slime band over it in the drop,
// its own frame-time column, and its GPU objects given back with the dive.

import { ManualScheduler } from '@evolution/shared';
import { describe, expect, it } from 'vitest';
import { DIVE_BAKE_START_DELAY_MS } from '../../constants/dive';
import { fakePlanetSource, fakeUpperBands, startedDiveSession } from '../../../../../testing/dive-session-harness';
import { createFakeShoreCanvasFactory } from '../../../../../testing/fake-shore-canvas';
import { fakeShoreMaker } from '../../../../../testing/fake-shore-band';
import { fakeSlimeMaker } from '../../../../../testing/fake-slime-band';
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
  const slime = fakeSlimeMaker();
  const bands = fakeUpperBands(fakePlanetSource(), shore, { kelp, slime });
  const harness = await startedDiveSession({ scheduler, loadUpperBands: () => Promise.resolve(bands) });
  const bakeFor = (milliseconds: number): void => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 10) scheduler.advanceMilliseconds(10);
  };
  const scrubTo = (zoom: number): void => {
    harness.subject.controls.scrub(zoom);
    harness.app.tick();
  };
  return {
    ...harness,
    bakes,
    band: made[0]!,
    shoreBand: shore.bands[0]!,
    slimeBand: slime.bands[0]!,
    bakeFor,
    scrubTo,
  };
}

const opacityOf = (canvas: HTMLCanvasElement): number => Number(canvas.style.opacity);

describe('the kelp band in the dive', () => {
  it('draws on the dive’s one Pixi app, over the shore’s quad', async () => {
    const { subject, app, apps, band, shoreBand } = await openedDive();
    expect(apps).toHaveLength(1);
    const children = app.stage.children;
    expect(children.indexOf(band.view)).toBe(children.indexOf(shoreBand.view) + 1);
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

  it('shows its parts by the band table, the slime band over it in the drop, and nothing past the drop', async () => {
    const { subject, app, band, slimeBand, bakeFor, scrubTo } = await openedDive();
    bakeFor(DIVE_BAKE_START_DELAY_MS + 1000);
    scrubTo(1);
    expect(band.view.children[0]!.visible).toBe(true);
    scrubTo(-2.2);
    expect(band.view.children[4]!.visible).toBe(true);
    expect(opacityOf(app.canvas)).toBe(1);
    expect(app.stage.children.at(-1)).toBe(slimeBand.view);
    scrubTo(-3.3);
    expect(band.view.children.every((mesh) => !mesh.visible)).toBe(true);
    expect(app.stage.children[0]).toBe(slimeBand.view);
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
