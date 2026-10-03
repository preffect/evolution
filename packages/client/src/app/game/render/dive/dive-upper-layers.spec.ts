// The layers above the dish (docs/rendering/opening-dive.md §1, §4) with the shore band in them (ticket #801): its quad
// on the dive's one Pixi stage over the planet, the mockup's canvas over the Pixi canvas while the shore shows, its
// bake started with the others and counted in `isBaked`, the mockup drawn first so the shore knows whether the
// planet's forest shows, its time in its own column.

import { ManualClock, ManualScheduler } from '@evolution/shared';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { fakeDiveBands, fakePlanetSource, fakeUpperBands } from '../../../../testing/dive-session-harness';
import { createFakePixiApp } from '../../../../testing/fake-pixi-app';
import { fakeShoreMaker } from '../../../../testing/fake-shore-band';
import { DiveFrameTimes } from './dive-frame-times';
import { DiveUpperLayers } from './dive-upper-layers';
import { diveViewAt } from './dive-view';

function layers() {
  const host = document.createElement('div');
  const game = createFakePixiApp();
  host.append(game.canvas);
  const mockup = fakeDiveBands();
  const shore = fakeShoreMaker();
  const stage = new Container();
  const clock = new ManualClock(0);
  const frameTimes = new DiveFrameTimes(clock);
  const subject = new DiveUpperLayers({
    bands: fakeUpperBands(mockup, fakePlanetSource(), shore),
    host,
    stage,
    clock,
    frameTimes,
    renderToTexture: (container, target) => game.renderToTexture(container, target),
    devicePixelRatio: 1,
  });
  return { subject, host, game, stage, mockup, band: shore.bands[0]!, frameTimes };
}

const viewAt = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

const FRAME = { screenRatio: 1, nowMs: 0, isMotionReduced: false };

/** The stage's canvases, bottom to top, by identity: fake canvases are alike, so `toEqual` would pass any order. */
function expectStacked(host: HTMLElement, canvases: readonly HTMLCanvasElement[]): void {
  expect(host.children).toHaveLength(canvases.length);
  canvases.forEach((canvas, index) => expect(host.children[index]).toBe(canvas));
}

describe('DiveUpperLayers’ shore', () => {
  it('puts its quad on the dive’s own stage, over the planet', () => {
    const { stage, band } = layers();
    expect(stage.children.at(-1)).toBe(band.view);
    expect(stage.children.length).toBeGreaterThan(1);
  });

  it('shows the Pixi canvas under the mockup’s while only the shore shows, and lays it back over at the dish', () => {
    const { subject, host, game, mockup } = layers();
    const view = viewAt(0);
    expect(view.bands.planet.isActive).toBe(false);
    expect(subject.draw(view, FRAME)).toBe(true);
    expectStacked(host, [game.canvas, mockup.canvas]);
    expect(subject.draw(viewAt(-4.3), FRAME)).toBe(false);
    expectStacked(host, [mockup.canvas, game.canvas]);
  });

  it('starts the shore baking, and is baked only once the shore is ready too', () => {
    const { subject, band } = layers();
    subject.bakeOn(new ManualScheduler(), () => undefined);
    expect(band.bakes.started).toBe(1);
    expect(subject.isBaked).toBe(true);
    band.isReady = false;
    expect(subject.isBaked).toBe(false);
  });

  it('draws the mockup even with only the shore active, then the shore told whether the forest showed', () => {
    const { subject, mockup, band, frameTimes } = layers();
    const view = viewAt(2.6);
    expect(view.bands.kelp.isActive).toBe(false);
    subject.draw(view, FRAME);
    frameTimes.endFrame();
    expect(mockup.frames).toHaveLength(1);
    expect(band.draws).toEqual([{ view, isForestShown: true }]);
    expect(frameTimes.take().frames).toBe(1);
  });

  it('gives every part back on destroy', () => {
    const { subject, band, host, mockup } = layers();
    subject.destroy();
    expect(band.lifecycle.isDestroyed).toBe(true);
    expect(mockup.releases.count).toBe(1);
    expect(host.contains(mockup.canvas)).toBe(false);
  });
});
