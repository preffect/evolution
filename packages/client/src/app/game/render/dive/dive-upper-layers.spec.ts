// The layers above the dish (docs/rendering/opening-dive.md §1, §4) with the shore band (ticket #801) and the kelp band
// (ticket #802) in them: the shore's quad over the planet and the kelp's meshes over it on the dive's one Pixi stage,
// the mockup's canvas over the Pixi canvas while any of them shows, their bakes started with the others and counted
// in `isBaked`, a fall held at the higher of their floors, the planet's forest test asked first so the shore knows
// whether the planet shows, and each band's time in its own column.

import { ManualClock, ManualScheduler } from '@evolution/shared';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { fakeDiveBands, fakePlanetSource, fakeUpperBands } from '../../../../testing/dive-session-harness';
import { createFakePixiApp } from '../../../../testing/fake-pixi-app';
import { fakeForestTest, fakeKelpMaker } from '../../../../testing/fake-kelp-band';
import { fakeShoreMaker } from '../../../../testing/fake-shore-band';
import { DIVE_BAKE_START_DELAY_MS } from '../constants';
import { DiveFrameTimes } from './dive-frame-times';
import { DiveUpperLayers } from './dive-upper-layers';
import { diveViewAt } from './dive-view';

function layers() {
  const host = document.createElement('div');
  const game = createFakePixiApp();
  host.append(game.canvas);
  const mockup = fakeDiveBands();
  const shore = fakeShoreMaker();
  const kelp = fakeKelpMaker();
  const forest = fakeForestTest();
  const stage = new Container();
  const clock = new ManualClock(0);
  const frameTimes = new DiveFrameTimes(clock);
  const subject = new DiveUpperLayers({
    bands: fakeUpperBands(mockup, fakePlanetSource(), shore, { kelp, forest }),
    host,
    stage,
    clock,
    frameTimes,
    renderToTexture: (container, target) => game.renderToTexture(container, target),
    devicePixelRatio: 1,
  });
  return {
    subject,
    host,
    game,
    stage,
    mockup,
    band: shore.bands[0]!,
    kelp,
    kelpBand: kelp.bands[0]!,
    forest,
    clock,
    frameTimes,
  };
}

const viewAt = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

const FRAME = { screenRatio: 1, nowMs: 0, isMotionReduced: false };

/** The stage's canvases, bottom to top, by identity: fake canvases are alike, so `toEqual` would pass any order. */
function expectStacked(host: HTMLElement, canvases: readonly HTMLCanvasElement[]): void {
  expect(host.children).toHaveLength(canvases.length);
  canvases.forEach((canvas, index) => expect(host.children[index]).toBe(canvas));
}

describe('DiveUpperLayers’ shore and kelp', () => {
  it('puts the shore’s quad over the planet and the kelp’s meshes over the shore, on the dive’s own stage', () => {
    const { stage, band, kelpBand } = layers();
    expect(stage.children.at(-2)).toBe(band.view);
    expect(stage.children.at(-1)).toBe(kelpBand.view);
    expect(stage.children.length).toBeGreaterThan(2);
  });

  it('shows the Pixi canvas under the mockup’s while only the shore shows, and lays it back over at the dish', () => {
    const { subject, host, game, mockup, kelpBand } = layers();
    kelpBand.draw = () => false;
    const view = viewAt(0);
    expect(view.bands.planet.isActive).toBe(false);
    expect(subject.draw(view, FRAME)).toBe(true);
    expectStacked(host, [game.canvas, mockup.canvas]);
    expect(subject.draw(viewAt(-4.3), FRAME)).toBe(false);
    expectStacked(host, [mockup.canvas, game.canvas]);
  });

  it('shows the Pixi canvas under the mockup’s while only the drop shows, past the shore’s cut', () => {
    const { subject, host, game, mockup, band } = layers();
    const view = viewAt(-2.2);
    expect(view.bands.shore.isActive).toBe(false);
    expect(view.bands.drop.isActive).toBe(true);
    expect(subject.draw(view, FRAME)).toBe(true);
    expect(band.draws.at(-1)!.view).toBe(view);
    expectStacked(host, [game.canvas, mockup.canvas]);
    // the slime draws over the drop, on the mockup's canvas
    expect(mockup.frames.at(-1)!.zoom).toBe(-2.2);
  });

  it('starts the shore and the kelp baking, and is baked only once both are ready', () => {
    const { subject, band, kelp, kelpBand } = layers();
    const scheduler = new ManualScheduler();
    kelp.bakes.isBaked = false;
    subject.bakeOn(scheduler, () => undefined);
    scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    expect(band.bakes.started).toBe(1);
    expect(kelp.bakes.pumped).toBe(1);
    expect(subject.isBaked).toBe(false);
    kelp.bakes.isBaked = true;
    expect(subject.isBaked).toBe(true);
    band.isReady = false;
    expect(subject.isBaked).toBe(false);
    band.isReady = true;
    kelpBand.isReady = false;
    expect(subject.isBaked).toBe(false);
  });

  it('holds a fall at the higher of the shore’s and the kelp’s floors', () => {
    const { subject, band, kelpBand } = layers();
    band.fallFloorZoom = 0.5;
    kelpBand.fallFloorZoom = 2.4;
    expect(subject.fallFloorZoom).toBe(2.4);
    kelpBand.fallFloorZoom = Number.NEGATIVE_INFINITY;
    expect(subject.fallFloorZoom).toBe(0.5);
  });

  it('asks the forest test whether the planet shows and tells the shore, with the mockup undrawn above the slime', () => {
    const { subject, mockup, band, forest } = layers();
    const view = viewAt(2.6);
    subject.draw(view, FRAME);
    expect(forest.views).toEqual([view]);
    expect(band.draws).toEqual([{ view, isForestShown: true }]);
    forest.isShown = () => false;
    subject.draw(view, FRAME);
    expect(band.draws.at(-1)).toEqual({ view, isForestShown: false });
    expect(mockup.frames).toHaveLength(0);
    expect(mockup.canvas.hidden).toBe(true);
  });

  it('times the forest test and the slime as the upper bands, the shore and the kelp each in its own column', () => {
    const { subject, band, kelpBand, forest, clock, frameTimes } = layers();
    const spend = (durationMs: number): void => clock.advanceMilliseconds(durationMs);
    forest.isShown = () => {
      spend(2);
      return true;
    };
    band.draw = () => {
      spend(3);
      return true;
    };
    kelpBand.draw = () => {
      spend(5);
      return true;
    };
    subject.draw(viewAt(2.2), FRAME);
    frameTimes.endFrame();
    expect(frameTimes.take()).toMatchObject({ frames: 1, upperBandsMs: 2, shoreMs: 3, kelpMs: 5 });
  });

  it('gives every part back on destroy', () => {
    const { subject, band, kelpBand, host, mockup } = layers();
    subject.destroy();
    expect(band.lifecycle.isDestroyed).toBe(true);
    expect(kelpBand.lifecycle.isDestroyed).toBe(true);
    expect(mockup.releases.count).toBe(1);
    expect(host.contains(mockup.canvas)).toBe(false);
  });
});
