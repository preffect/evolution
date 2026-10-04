// The layers above the dish (docs/rendering/opening-dive.md §1, §4) with the shore band (ticket #801), the kelp band
// (ticket #802) and the slime band (ticket #803) in them, all on the dive's one Pixi stage: the shore's quad over the
// planet and the kelp's meshes over it, the slime over the kelp while the drop shows and at the bottom of the stage
// otherwise, their bakes started with the others and counted in `isBaked`, a fall held at the highest of their floors,
// the planet's forest test asked first so the shore knows whether the planet shows, and each band's time in its own
// column.

import { ManualClock, ManualScheduler } from '@evolution/shared';
import { Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { fakePlanetSource, fakeUpperBands } from '../../../../testing/dive-session-harness';
import { createFakePixiApp } from '../../../../testing/fake-pixi-app';
import { fakeForestTest, fakeKelpMaker } from '../../../../testing/fake-kelp-band';
import { fakeShoreMaker } from '../../../../testing/fake-shore-band';
import { fakeSlimeMaker } from '../../../../testing/fake-slime-band';
import { DIVE_BAKE_START_DELAY_MS } from '../constants';
import { DiveFrameTimes } from './dive-frame-times';
import { DiveUpperLayers } from './dive-upper-layers';
import { diveViewAt } from './dive-view';

function layers() {
  const game = createFakePixiApp();
  const shore = fakeShoreMaker();
  const kelp = fakeKelpMaker();
  const slime = fakeSlimeMaker();
  const forest = fakeForestTest();
  const stage = new Container();
  const gameRoot = new Container();
  stage.addChild(gameRoot);
  const clock = new ManualClock(0);
  const frameTimes = new DiveFrameTimes(clock);
  const subject = new DiveUpperLayers({
    bands: fakeUpperBands(fakePlanetSource(), shore, { kelp, slime, forest }),
    stage,
    clock,
    frameTimes,
    renderToTexture: (container, target) => game.renderToTexture(container, target),
    devicePixelRatio: 1,
  });
  return {
    subject,
    stage,
    gameRoot,
    band: shore.bands[0]!,
    kelp,
    kelpBand: kelp.bands[0]!,
    slime,
    slimeBand: slime.bands[0]!,
    forest,
    clock,
    frameTimes,
  };
}

const viewAt = (zoom: number) =>
  diveViewAt({ zoom, viewport: { width: 830, height: 467 }, timeSeconds: 0, isMoving: false, globeIdleSpinDegrees: 0 });

const FRAME = { screenRatio: 1, nowMs: 0, isMotionReduced: false };

describe('DiveUpperLayers’ shore, kelp and slime', () => {
  it('puts the shore’s quad over the planet and the kelp’s meshes over the shore, the slime under everything', () => {
    const { stage, band, kelpBand, slimeBand, gameRoot } = layers();
    expect(stage.children.at(-2)).toBe(band.view);
    expect(stage.children.at(-1)).toBe(kelpBand.view);
    expect(stage.children[0]).toBe(slimeBand.view);
    expect(stage.children[1]).toBe(gameRoot);
  });

  it('lays the slime over the kelp band while the drop shows, and back at the bottom under the dish', () => {
    const { subject, stage, kelpBand, slimeBand, gameRoot } = layers();
    const view = viewAt(-2.2);
    expect(view.bands.drop.isActive).toBe(true);
    expect(view.bands.slime.isActive).toBe(true);
    expect(subject.draw(view, FRAME)).toBe(true);
    expect(stage.children.at(-1)).toBe(slimeBand.view);
    expect(stage.children.indexOf(slimeBand.view)).toBeGreaterThan(stage.children.indexOf(kelpBand.view));
    expect(slimeBand.draws.at(-1)).toBe(view);
    expect(subject.draw(viewAt(-4.3), FRAME)).toBe(true);
    expect(stage.children[0]).toBe(slimeBand.view);
    expect(stage.children[1]).toBe(gameRoot);
  });

  it('answers that nothing shows on the Pixi canvas inside the dish, where only the dish draws', () => {
    const { subject } = layers();
    expect(subject.draw(viewAt(-4.75), FRAME)).toBe(false);
  });

  it('starts every band baking, and is baked only once all are ready', () => {
    const { subject, band, kelp, kelpBand, slime, slimeBand } = layers();
    const scheduler = new ManualScheduler();
    kelp.bakes.isBaked = false;
    slime.bakes.isBaked = false;
    subject.bakeOn(scheduler, () => undefined);
    scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    expect(band.bakes.started).toBe(1);
    expect(kelp.bakes.pumped).toBe(1);
    expect(subject.isBaked).toBe(false);
    kelp.bakes.isBaked = true;
    expect(subject.isBaked).toBe(false);
    slime.bakes.isBaked = true;
    expect(subject.isBaked).toBe(true);
    band.isReady = false;
    expect(subject.isBaked).toBe(false);
    band.isReady = true;
    kelpBand.isReady = false;
    expect(subject.isBaked).toBe(false);
    kelpBand.isReady = true;
    slimeBand.isReady = false;
    expect(subject.isBaked).toBe(false);
  });

  it('pumps the slime’s bakes after the kelp’s', () => {
    const { subject, kelp, slime } = layers();
    const scheduler = new ManualScheduler();
    kelp.bakes.isBaked = false;
    slime.bakes.isBaked = false;
    subject.bakeOn(scheduler, () => undefined);
    scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    expect([kelp.bakes.pumped, slime.bakes.pumped]).toEqual([1, 0]);
    kelp.bakes.isBaked = true;
    scheduler.advanceMilliseconds(DIVE_BAKE_START_DELAY_MS);
    expect(slime.bakes.pumped).toBeGreaterThan(0);
  });

  it('tells the labels the slime’s pictures have landed once its band is ready', () => {
    const { subject, slimeBand } = layers();
    expect(subject.hasSlimePictures).toBe(true);
    slimeBand.isReady = false;
    expect(subject.hasSlimePictures).toBe(false);
  });

  it('holds a fall at the highest of the shore’s, the kelp’s and the slime’s floors', () => {
    const { subject, band, kelpBand, slimeBand } = layers();
    band.fallFloorZoom = 0.5;
    kelpBand.fallFloorZoom = 2.4;
    slimeBand.fallFloorZoom = -1.95;
    expect(subject.fallFloorZoom).toBe(2.4);
    kelpBand.fallFloorZoom = Number.NEGATIVE_INFINITY;
    expect(subject.fallFloorZoom).toBe(0.5);
    band.fallFloorZoom = Number.NEGATIVE_INFINITY;
    expect(subject.fallFloorZoom).toBe(-1.95);
  });

  it('asks the forest test whether the planet shows and tells the shore', () => {
    const { subject, band, forest } = layers();
    const view = viewAt(2.6);
    subject.draw(view, FRAME);
    expect(forest.views).toEqual([view]);
    expect(band.draws).toEqual([{ view, isForestShown: true }]);
    forest.isShown = () => false;
    subject.draw(view, FRAME);
    expect(band.draws.at(-1)).toEqual({ view, isForestShown: false });
  });

  it('times the forest test as the upper bands, the shore, the kelp and the slime each in its own column', () => {
    const { subject, band, kelpBand, slimeBand, forest, clock, frameTimes } = layers();
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
    slimeBand.draw = () => {
      spend(7);
      return true;
    };
    subject.draw(viewAt(2.2), FRAME);
    frameTimes.endFrame();
    expect(frameTimes.take()).toMatchObject({ frames: 1, upperBandsMs: 2, shoreMs: 3, kelpMs: 5, slimeMs: 7 });
  });

  it('gives every part back on destroy', () => {
    const { subject, band, kelpBand, slimeBand } = layers();
    subject.destroy();
    expect(band.lifecycle.isDestroyed).toBe(true);
    expect(kelpBand.lifecycle.isDestroyed).toBe(true);
    expect(slimeBand.lifecycle.isDestroyed).toBe(true);
  });
});
